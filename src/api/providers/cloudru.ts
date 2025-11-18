import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk" // Keep for type usage only

import { cloudRuDefaultModelId, cloudRuDefaultModelInfo, ModelInfo } from "@roo-code/types"

import { ApiHandlerOptions } from "../../shared/api"

import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { calculateApiCostOpenAI } from "../../shared/cost"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { RouterProvider } from "./router-provider"
import { handleOpenAIError } from "./utils/openai-error-handler"

/**
 * Cloud.ru Foundation Models (CFM) provider handler
 * Supports GigaChat and Qwen models through OpenAI-compatible API
 * Models are fetched dynamically from the API
 */
export class CloudRuHandler extends RouterProvider implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		// Use custom base URL if provided, otherwise use default Cloud.ru API endpoint
		const baseURL = options.cloudRuBaseUrl || "https://foundation-models.api.cloud.ru/v1"

		// Use cloudRuApiKey if provided, otherwise fall back to generic apiKey
		const apiKey = options.cloudRuApiKey || options.apiKey

		if (!apiKey) {
			throw new Error("Cloud.ru API key is required")
		}

		super({
			options,
			name: "cloudru",
			baseURL,
			apiKey,
			modelId: options.apiModelId,
			defaultModelId: cloudRuDefaultModelId,
			defaultModelInfo: cloudRuDefaultModelInfo,
		})
	}

	override getModel(): { id: string; info: ModelInfo } {
		const model = super.getModel()

		// Allow user to override context window if specified
		if (this.options.cloudRuContextWindow && this.options.cloudRuContextWindow > 0) {
			return {
				...model,
				info: {
					...model.info,
					contextWindow: this.options.cloudRuContextWindow,
				},
			}
		}

		return model
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info } = await this.fetchModel()

		const openAiMessages = convertToOpenAiMessages(messages)

		const isGigaChat = modelId.startsWith("GigaChat/")
		const legacyFlag = (this.options as any).cloudRuLegacyFormat
		const useLegacyFormat = isGigaChat ? legacyFlag !== false : legacyFlag === true

		// For GigaChat models (and any other model when explicitly enabled),
		// use legacy OpenAI chat format where message content is a string,
		// not an array of parts. Otherwise use the standard OpenAI-compatible format.
		const messagesForRequest: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = useLegacyFormat
			? (openAiMessages as any).map((msg: any) => {
					const contentString =
						typeof msg.content === "string"
							? msg.content
							: (msg.content || [])
									.filter((part: any) => part?.type === "text" && typeof part.text === "string")
									.map((part: any) => part.text)
									.join("\n\n")

					return {
						role: msg.role,
						content: contentString,
					}
				})
			: (openAiMessages as any)

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			messages: [{ role: "system", content: systemPrompt }, ...messagesForRequest],
			stream: true,
		}

		if (this.supportsTemperature(modelId)) {
			requestOptions.temperature = this.options.modelTemperature ?? info.defaultTemperature ?? 0.7
		}

		const streamingEnabled = (this.options as any).cloudRuStreamingEnabled ?? true

		try {
			if (streamingEnabled) {
				const { data: completion } = await this.client.chat.completions.create(requestOptions).withResponse()

				let lastUsage

				for await (const chunk of completion) {
					const delta = chunk.choices[0]?.delta
					const usage = chunk.usage

					if (delta?.content) {
						yield { type: "text", text: delta.content }
					}

					if (usage) {
						lastUsage = usage
					}
				}

				if (lastUsage) {
					const cacheWriteTokens = (lastUsage as any).cache_creation_input_tokens || 0
					const cacheReadTokens = lastUsage.prompt_tokens_details?.cached_tokens || 0

					const { totalCost } = calculateApiCostOpenAI(
						info,
						lastUsage.prompt_tokens || 0,
						lastUsage.completion_tokens || 0,
						cacheWriteTokens,
						cacheReadTokens,
					)

					const usageData: ApiStreamUsageChunk = {
						type: "usage",
						inputTokens: lastUsage.prompt_tokens || 0,
						outputTokens: lastUsage.completion_tokens || 0,
						cacheWriteTokens: cacheWriteTokens > 0 ? cacheWriteTokens : undefined,
						cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : undefined,
						totalCost,
					}

					yield usageData
				}
			} else {
				// Non‑streaming path when streaming is disabled for Cloud.ru.
				const nonStreamingOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
					model: modelId,
					messages: requestOptions.messages,
				}

				if (this.supportsTemperature(modelId)) {
					nonStreamingOptions.temperature = this.options.modelTemperature ?? info.defaultTemperature ?? 0.7
				}

				const response = await this.client.chat.completions.create(nonStreamingOptions)

				const content = response.choices?.[0]?.message?.content
				if (content) {
					yield { type: "text", text: content }
				}

				const usage: any = (response as any).usage
				if (usage) {
					const cacheWriteTokens = (usage as any).cache_creation_input_tokens || 0
					const cacheReadTokens = usage.prompt_tokens_details?.cached_tokens || 0

					const { totalCost } = calculateApiCostOpenAI(
						info,
						usage.prompt_tokens || 0,
						usage.completion_tokens || 0,
						cacheWriteTokens,
						cacheReadTokens,
					)

					const usageData: ApiStreamUsageChunk = {
						type: "usage",
						inputTokens: usage.prompt_tokens || 0,
						outputTokens: usage.completion_tokens || 0,
						cacheWriteTokens: cacheWriteTokens > 0 ? cacheWriteTokens : undefined,
						cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : undefined,
						totalCost,
					}

					yield usageData
				}
			}
		} catch (error) {
			// Use shared OpenAI error handler to log details and return user‑friendly error.
			throw handleOpenAIError(error, "Cloud.ru")
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info } = await this.fetchModel()

		try {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			}

			if (this.supportsTemperature(modelId)) {
				requestOptions.temperature = this.options.modelTemperature ?? info.defaultTemperature ?? 0.7
			}

			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			// Use shared OpenAI error handler to log details and return user‑friendly error.
			throw handleOpenAIError(error, "Cloud.ru")
		}
	}
}
