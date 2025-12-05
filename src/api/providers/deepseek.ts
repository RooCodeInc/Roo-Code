import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { deepSeekModels, deepSeekDefaultModelId, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { XmlMatcher } from "../../utils/xml-matcher"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream, type ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import type { ApiHandlerCreateMessageMetadata } from "../index"

import { OpenAiHandler } from "./openai"
import { DEFAULT_HEADERS } from "./constants"
import { getApiRequestTimeout } from "./utils/timeout-config"

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

		// Create our own client for native tool calling support
		this.deepSeekClient = new OpenAI({
			baseURL: options.deepSeekBaseUrl ?? "https://api.deepseek.com",
			apiKey: options.deepSeekApiKey ?? "not-provided",
			defaultHeaders: DEFAULT_HEADERS,
			timeout: getApiRequestTimeout(),
		})
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
		const { id: modelId, info: modelInfo } = this.getModel()
		const isDeepSeekReasoner = modelId.includes("deepseek-reasoner")

		// Only handle deepseek-reasoner with native tool protocol specially
		// For other cases, delegate to parent implementation
		if (!isDeepSeekReasoner || metadata?.toolProtocol !== "native") {
			yield* super.createMessage(systemPrompt, messages, metadata)
			return
		}

		// For deepseek-reasoner with native tools, use OpenAI format
		// which properly handles tool_calls and tool role messages
		// Reference: https://api-docs.deepseek.com/zh-cn/guides/thinking_mode#工具调用
		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
			role: "system",
			content: systemPrompt,
		}

		const convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature: this.options.modelTemperature ?? DEEP_SEEK_DEFAULT_TEMPERATURE,
			messages: convertedMessages,
			stream: true as const,
			stream_options: { include_usage: true },
			...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
			parallel_tool_calls: metadata.parallelToolCalls ?? false,
		}

		// Add max_tokens if needed
		if (this.options.includeMaxTokens === true) {
			requestOptions.max_completion_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}

		const stream = await this.deepSeekClient.chat.completions.create(requestOptions)

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
				for (const c of matcher.update(delta.content)) {
					yield c
				}
			}

			// Handle reasoning_content from DeepSeek's thinking mode
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

		for (const c of matcher.final()) {
			yield c
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
