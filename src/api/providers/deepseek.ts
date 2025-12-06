import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	deepSeekModels,
	deepSeekDefaultModelId,
	deepSeekModelAliases,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	type ModelInfo,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import type { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { convertToOpenAiMessages } from "../transform/openai-format"

import { OpenAiHandler } from "./openai"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { XmlMatcher } from "../../utils/xml-matcher"

/**
 * Maps a user-provided model ID to the official DeepSeek API model name.
 * The DeepSeek API uses specific model names (deepseek-chat, deepseek-reasoner),
 * but users may use alternative names like deepseek-v3, deepseek-3.2, etc.
 */
function getApiModelId(modelId: string): string {
	return deepSeekModelAliases[modelId] ?? modelId
}

/**
 * Checks if a model is a DeepSeek V3/Chat model (not a reasoner model).
 * V3/Chat models support thinking mode with tool calling via the "thinking" parameter.
 */
function isDeepSeekV3Model(modelId: string): boolean {
	// Map alias to actual model ID for checking
	const actualModelId = getApiModelId(modelId)
	// V3/Chat models use deepseek-chat, not deepseek-reasoner
	return actualModelId === "deepseek-chat"
}

export class DeepSeekHandler extends OpenAiHandler {
	constructor(options: ApiHandlerOptions) {
		const userModelId = options.apiModelId ?? deepSeekDefaultModelId
		// Map the user's model ID to the official API model name
		const apiModelId = getApiModelId(userModelId)

		super({
			...options,
			openAiApiKey: options.deepSeekApiKey ?? "not-provided",
			openAiModelId: apiModelId, // Use the mapped API model ID
			openAiBaseUrl: options.deepSeekBaseUrl ?? "https://api.deepseek.com",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})

		// Store the original user model ID for getModel()
		this.userModelId = userModelId
	}

	// Store the user's original model ID (before alias mapping)
	private userModelId: string

	override getModel() {
		// Use the user's original model ID for info lookup (so they see the model they selected)
		const id = this.userModelId
		const info = deepSeekModels[id as keyof typeof deepSeekModels] || deepSeekModels[deepSeekDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	/**
	 * Override createMessage to add DeepSeek V3.2 thinking mode support.
	 * When enableReasoningEffort is true and the model is a V3/Chat model,
	 * we add the thinking parameter to enable thinking mode with tool calling.
	 * See: https://api-docs.deepseek.com/guides/thinking_mode
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { info: modelInfo } = this.getModel()
		const modelId = this.options.openAiModelId ?? ""

		// Check if thinking mode should be enabled for DeepSeek V3 models
		// Cast to ModelInfo to access optional supportsReasoningBinary property
		const shouldEnableThinking =
			this.options.enableReasoningEffort &&
			(modelInfo as ModelInfo).supportsReasoningBinary &&
			isDeepSeekV3Model(this.userModelId)

		// If thinking mode is not enabled, use the default OpenAI handler behavior
		if (!shouldEnableThinking) {
			yield* super.createMessage(systemPrompt, messages, metadata)
			return
		}

		// For DeepSeek V3 with thinking mode enabled, we need to:
		// 1. Add the thinking parameter to the request
		// 2. Handle reasoning_content in the response
		// 3. Preserve reasoning_content in conversation history (handled by openai-format.ts)

		const temperature = this.options.modelTemperature ?? DEEP_SEEK_DEFAULT_TEMPERATURE

		// Convert messages to OpenAI format, preserving reasoning_content
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// Build the request with thinking mode enabled
		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & {
			thinking?: { type: string }
		} = {
			model: modelId,
			temperature,
			messages: openAiMessages,
			stream: true as const,
			stream_options: { include_usage: true },
			// Enable thinking mode for DeepSeek V3.2
			// See: https://api-docs.deepseek.com/guides/thinking_mode
			thinking: { type: "enabled" },
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
		}

		// Add max_tokens if needed
		if (this.options.includeMaxTokens && modelInfo.maxTokens) {
			requestOptions.max_completion_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}

		// Create the stream using the protected client from OpenAiHandler
		// We need to access the client directly since we're overriding the method
		const client = (this as any).client as OpenAI
		const stream = await client.chat.completions.create(requestOptions)

		const matcher = new XmlMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		let lastUsage: any

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta ?? {}

			if (delta.content) {
				for (const processedChunk of matcher.update(delta.content)) {
					yield processedChunk
				}
			}

			// Handle reasoning_content from DeepSeek thinking mode
			if ("reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: (delta.reasoning_content as string | undefined) || "",
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

		for (const chunk of matcher.final()) {
			yield chunk
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage)
		}
	}

	// Override to handle DeepSeek's usage metrics, including caching.
	protected override processUsageMetrics(usage: any): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.prompt_tokens_details?.cache_miss_tokens,
			cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens,
		}
	}
}
