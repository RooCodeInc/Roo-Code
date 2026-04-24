import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	deepSeekModels,
	deepSeekDefaultModelId,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	OPENAI_AZURE_AI_INFERENCE_PATH,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { convertToR1Format } from "../transform/r1-format"

import { OpenAiHandler } from "./openai"
import type { ApiHandlerCreateMessageMetadata } from "../index"

// Custom interface for DeepSeek params to support thinking mode
type DeepSeekChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
	thinking?: { type: "enabled" | "disabled" }
	reasoning_effort?: "high" | "max"
}

export class DeepSeekHandler extends OpenAiHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.deepSeekApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? deepSeekDefaultModelId,
			openAiBaseUrl: options.deepSeekBaseUrl || "https://api.deepseek.com",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? deepSeekDefaultModelId
		const info = deepSeekModels[id as keyof typeof deepSeekModels] || deepSeekModels[deepSeekDefaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: DEEP_SEEK_DEFAULT_TEMPERATURE,
		})
		return { id, info, ...params }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const modelId = this.options.apiModelId ?? deepSeekDefaultModelId
		const { info: modelInfo } = this.getModel()

		// Whether the model inherently supports thinking mode via preserveReasoning
		const hasThinkingCapability = modelInfo.preserveReasoning || modelId.includes("deepseek-v4-pro") || modelId.includes("deepseek-reasoner")
		// Respect user's toggle: enableReasoningEffort=false means disable thinking entirely
		// reasoningEffort="disable" also turns off thinking
		const isThinkingDisabled = this.options.enableReasoningEffort === false || (this.options as any).reasoningEffort === "disable"
		const isThinkingModel = hasThinkingCapability && !isThinkingDisabled

		// Convert messages to R1 format (merges consecutive same-role messages)
		// This is required for DeepSeek which does not support successive messages with the same role
		// For thinking models, enable mergeToolResultText to preserve reasoning_content
		// during tool call sequences. Without this, environment_details text after tool_results would
		// create user messages that cause DeepSeek to drop all previous reasoning_content.
		// See: https://api-docs.deepseek.com/guides/thinking_mode
		const convertedMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages], {
			mergeToolResultText: isThinkingModel,
		})

		// Pre-flight check: ensure reasoning_content is preserved on assistant messages
		// when thinking mode is enabled. DeepSeek requires reasoning_content from previous
		// turns to be passed back, otherwise it returns 400 error.
		// See: https://api-docs.deepseek.com/guides/thinking_mode
		if (isThinkingModel) {
			ensureReasoningContentPreserved(convertedMessages, messages)
		}

		const requestOptions: DeepSeekChatCompletionParams = {
			model: modelId,
			temperature: this.options.modelTemperature ?? DEEP_SEEK_DEFAULT_TEMPERATURE,
			messages: convertedMessages,
			stream: true as const,
			stream_options: { include_usage: true },
			// Enable thinking mode for thinking-enabled models (respects user toggle)
			...(isThinkingModel && { thinking: { type: "enabled" } }),
			// Add reasoning_effort for v4 models (can be "high" or "max")
			// Only sent when thinking is enabled; user can set to "max" via settings
			...((modelId.includes("deepseek-v4-flash") || modelId.includes("deepseek-v4-pro")) && isThinkingModel && {
				reasoning_effort: (this.options as any).reasoningEffort === "max" ? "max" : "high",
			}),
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}

		// Add max_tokens if needed
		this.addMaxTokensIfNeeded(requestOptions, modelInfo)

		// Check if base URL is Azure AI Inference (for DeepSeek via Azure)
		const isAzureAiInference = this._isAzureAiInference(this.options.deepSeekBaseUrl)

		let stream
		try {
			stream = await this.client.chat.completions.create(
				requestOptions,
				isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
			)
		} catch (error) {
			// Attempt graceful degradation for thinking-mode reasoning_content errors.
			// This happens when DeepSeek requires reasoning_content to be passed back
			// but it was lost during message conversion (e.g., after conversation condense).
			// We retry without thinking enabled as a safe fallback.
			const errorMessage = String(error)
			if (
				isThinkingModel &&
				errorMessage.includes("reasoning_content") &&
				errorMessage.includes("must be passed back")
			) {
				console.warn("[DeepSeek] reasoning_content missing, retrying without thinking mode")
				const retryOptions: DeepSeekChatCompletionParams = {
					...requestOptions,
					thinking: undefined,
				}
				stream = await this.client.chat.completions.create(
					retryOptions,
					isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
			} else {
				const { handleOpenAIError } = await import("./utils/openai-error-handler")
				throw handleOpenAIError(error, "DeepSeek")
			}
		}

		let lastUsage

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta ?? {}

			// Handle regular text content
			if (delta.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			// Handle reasoning_content from DeepSeek's interleaved thinking
			// This is the proper way DeepSeek sends thinking content in streaming
			if ("reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: (delta.reasoning_content as string) || "",
				}
			}

			// Handle tool calls
			if (delta.tool_calls) {
				for (const toolCall of delta.tool_calls) {
					yield {
						type: "tool_call_partial",
						index: toolCall.index,
						id: toolCall.id,
						name: toolCall.function?.name,
						arguments: toolCall.function?.arguments,
					}
				}
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, modelInfo)
		}
	}

	// Override to handle DeepSeek's usage metrics, including caching.
	protected override processUsageMetrics(usage: any, _modelInfo?: any): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.prompt_tokens_details?.cache_miss_tokens,
			cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens,
		}
	}
}

/**
	* Pre-flight validation: ensures converted OpenAI messages retain reasoning_content
	* from source Anthropic messages when thinking mode is enabled.
	*
	* DeepSeek's thinking mode requires reasoning_content from previous assistant
	* responses to be passed back in subsequent requests within the same turn.
	* If convertToR1Format failed to preserve it (e.g., edge cases with nested
	* tool calls or conversation condense), we patch it here as a safety net.
	*
	* @param convertedMessages - The messages after convertToR1Format (will be mutated)
	* @param sourceMessages - The original Anthropic messages before conversion
	*/
function ensureReasoningContentPreserved(
	convertedMessages: OpenAI.Chat.ChatCompletionMessageParam[],
	sourceMessages: Anthropic.Messages.MessageParam[],
): void {
	// Scan source messages for any assistant message that had reasoning
	const sourceReasoning = extractReasoningFromMessages(sourceMessages)
	if (!sourceReasoning) {
		return // No reasoning in source, nothing to preserve
	}

	// Check if converted assistant messages already have reasoning_content
	const assistantMsgs = convertedMessages.filter((m) => m.role === "assistant")
	const hasReasoningInConverted = assistantMsgs.some(
		(msg: any) => typeof msg.reasoning_content === "string" && msg.reasoning_content.trim().length > 0,
	)

	if (hasReasoningInConverted) {
		return // Already preserved correctly
	}

	// Reasoning was lost during conversion — patch it onto the last assistant
	// message that has tool_calls (this is the one DeepSeek requires it on).
	const lastToolAssistant = [...assistantMsgs].reverse().find((msg: any) => msg.tool_calls)
	if (lastToolAssistant) {
		;(lastToolAssistant as any).reasoning_content = sourceReasoning
	}
}

/**
	* Extracts reasoning_content from Anthropic messages.
	* Checks both message-level reasoning_content and content blocks with type "reasoning".
	*/
function extractReasoningFromMessages(
	messages: Anthropic.Messages.MessageParam[],
): string | undefined {
	for (const msg of messages) {
		if (msg.role !== "assistant") continue

		// Check message-level reasoning_content (set by some providers directly)
		const msgReasoning = (msg as any).reasoning_content
		if (typeof msgReasoning === "string" && msgReasoning.trim().length > 0) {
			return msgReasoning
		}

		// Check content blocks for reasoning type (Task.ts stores it this way)
		if (Array.isArray(msg.content)) {
			for (const block of msg.content as any[]) {
				if (block.type === "reasoning" && typeof block.text === "string" && block.text.trim().length > 0) {
					return block.text
				}
			}
		}
	}

	return undefined
}