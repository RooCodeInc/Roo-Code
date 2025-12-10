import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { deepSeekModels, deepSeekDefaultModelId, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { convertToR1Format } from "../transform/r1-format"
import { XmlMatcher } from "../../utils/xml-matcher"

import { OpenAiHandler } from "./openai"
import type { ApiHandlerCreateMessageMetadata } from "../index"

// Custom interface for DeepSeek params to support thinking mode
type DeepSeekChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
	thinking?: { type: "enabled" | "disabled" }
}

export class DeepSeekHandler extends OpenAiHandler {
	private currentReasoningContent: string = ""

	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.deepSeekApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? deepSeekDefaultModelId,
			openAiBaseUrl: options.deepSeekBaseUrl ?? "https://api.deepseek.com",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	/**
	 * Returns the accumulated reasoning content from the last API call.
	 * This is used for interleaved thinking with tool calls - the reasoning_content
	 * needs to be passed back to the API in subsequent requests within the same turn.
	 */
	getReasoningContent(): string | undefined {
		return this.currentReasoningContent || undefined
	}

	override getModel() {
		const id = this.options.apiModelId ?? deepSeekDefaultModelId
		const info = deepSeekModels[id as keyof typeof deepSeekModels] || deepSeekModels[deepSeekDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const modelId = this.options.apiModelId ?? deepSeekDefaultModelId
		const { info: modelInfo } = this.getModel()

		// Check if this is a thinking-enabled model (deepseek-reasoner)
		const isThinkingModel = modelId.includes("deepseek-reasoner")

		// Reset reasoning content accumulator for this request
		this.currentReasoningContent = ""

		// Convert messages to R1 format (merges consecutive same-role messages)
		// This is required for DeepSeek which does not support successive messages with the same role
		const convertedMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])

		const requestOptions: DeepSeekChatCompletionParams = {
			model: modelId,
			temperature: this.options.modelTemperature ?? DEEP_SEEK_DEFAULT_TEMPERATURE,
			messages: convertedMessages,
			stream: true as const,
			stream_options: { include_usage: true },
			// Enable thinking mode for deepseek-reasoner or when tools are used with thinking model
			...(isThinkingModel && { thinking: { type: "enabled" } }),
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
			...(metadata?.toolProtocol === "native" && {
				parallel_tool_calls: metadata.parallelToolCalls ?? false,
			}),
		}

		// Add max_tokens if needed
		this.addMaxTokensIfNeeded(requestOptions, modelInfo)

		let stream
		try {
			stream = await this.getClient().chat.completions.create(requestOptions)
		} catch (error) {
			const { handleOpenAIError } = await import("./utils/openai-error-handler")
			throw handleOpenAIError(error, "DeepSeek")
		}

		// XmlMatcher for <think> tags (used by some DeepSeek models)
		const matcher = new XmlMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		let lastUsage

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta ?? {}

			// Handle regular content with <think> tag detection
			if (delta.content) {
				for (const matchedChunk of matcher.update(delta.content)) {
					yield matchedChunk
				}
			}

			// Handle reasoning_content from DeepSeek's interleaved thinking
			// This is the proper way DeepSeek sends thinking content in streaming
			if ("reasoning_content" in delta && delta.reasoning_content) {
				const reasoningText = (delta.reasoning_content as string) || ""
				// Accumulate reasoning content for potential tool call continuation
				this.currentReasoningContent += reasoningText
				yield {
					type: "reasoning",
					text: reasoningText,
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

		// Flush any remaining content from the XML matcher
		for (const matchedChunk of matcher.final()) {
			yield matchedChunk
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, modelInfo)
		}
	}

	/**
	 * Get the OpenAI client instance for making API calls.
	 * This is needed because the client is private in the parent class.
	 */
	private getClient(): OpenAI {
		// Access the client through the parent class
		// @ts-ignore - accessing private member for necessary functionality
		return this.client
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
