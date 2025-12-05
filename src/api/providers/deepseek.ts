import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { deepSeekModels, deepSeekDefaultModelId, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import type { ApiStreamUsageChunk, ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { XmlMatcher } from "../../utils/xml-matcher"

import { OpenAiHandler } from "./openai"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { handleOpenAIError } from "./utils/openai-error-handler"

export class DeepSeekHandler extends OpenAiHandler {
	private deepSeekClient: OpenAI

	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.deepSeekApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? deepSeekDefaultModelId,
			openAiBaseUrl: options.deepSeekBaseUrl ?? "https://api.deepseek.com",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})

		// Create our own OpenAI client since the parent's is private
		this.deepSeekClient = new OpenAI({
			baseURL: options.deepSeekBaseUrl ?? "https://api.deepseek.com",
			apiKey: options.deepSeekApiKey ?? "not-provided",
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const modelId = this.options.apiModelId ?? deepSeekDefaultModelId
		const isReasoner = modelId === "deepseek-reasoner"
		const useNativeTools = metadata?.toolProtocol === "native"

		// If it's deepseek-reasoner with native tools, use OpenAI format for proper tool handling
		if (isReasoner && useNativeTools) {
			yield* this.createMessageWithNativeTools(systemPrompt, messages, metadata)
		} else {
			// Otherwise, use the parent implementation (which uses R1 format for reasoner)
			yield* super.createMessage(systemPrompt, messages, metadata)
		}
	}

	private async *createMessageWithNativeTools(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { info: modelInfo } = this.getModel()
		const modelId = this.options.apiModelId ?? deepSeekDefaultModelId

		// Convert messages to OpenAI format to properly handle tool messages
		const convertedMessages = [
			{ role: "user" as const, content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature: this.options.modelTemperature ?? DEEP_SEEK_DEFAULT_TEMPERATURE,
			messages: convertedMessages,
			stream: true as const,
			stream_options: { include_usage: true },
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
			parallel_tool_calls: metadata?.parallelToolCalls ?? false,
		}

		// Add max_tokens if needed
		if (this.options.includeMaxTokens === true) {
			requestOptions.max_completion_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}

		let stream
		try {
			stream = await this.deepSeekClient.chat.completions.create(requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, "DeepSeek")
		}

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

			if (delta.content) {
				for (const chunk of matcher.update(delta.content)) {
					yield chunk
				}
			}

			// Handle reasoning_content for DeepSeek Reasoner
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

	// Helper method to convert tools to OpenAI format
	protected override convertToolsForOpenAI(tools: any[]): any[] | undefined {
		// This method is inherited from BaseProvider
		return super.convertToolsForOpenAI(tools)
	}

	override getModel() {
		const id = this.options.apiModelId ?? deepSeekDefaultModelId
		const info = deepSeekModels[id as keyof typeof deepSeekModels] || deepSeekModels[deepSeekDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
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
