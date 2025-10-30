import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type XAIModelId, xaiDefaultModelId, xaiModels, type ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { calculateApiCostOpenAI } from "../../shared/cost"
import type { ModelRecord } from "../../shared/api"
import { getModels } from "./fetchers/modelCache"

const XAI_DEFAULT_TEMPERATURE = 0

export class XAIHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private readonly providerName = "xAI"
	protected models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const apiKey = this.options.xaiApiKey ?? "not-provided"

		this.client = new OpenAI({
			baseURL: "https://api.x.ai/v1",
			apiKey: apiKey,
			defaultHeaders: DEFAULT_HEADERS,
		})
	}

	override getModel() {
		// Allow any model ID (dynamic discovery) and augment with static info when available
		const id = this.options.apiModelId ?? xaiDefaultModelId

		const staticInfo = (xaiModels as Record<string, any>)[id as any]
		const dynamicInfo = this.models?.[id as any]

		// Build complete ModelInfo using dynamic pricing/capabilities when available
		const info: ModelInfo = {
			contextWindow: this.options.xaiModelContextWindow ?? staticInfo?.contextWindow,
			maxTokens: staticInfo?.maxTokens ?? undefined,
			supportsPromptCache: dynamicInfo?.supportsPromptCache ?? false,
			supportsImages: dynamicInfo?.supportsImages,
			inputPrice: dynamicInfo?.inputPrice,
			outputPrice: dynamicInfo?.outputPrice,
			cacheReadsPrice: dynamicInfo?.cacheReadsPrice,
			cacheWritesPrice: dynamicInfo?.cacheWritesPrice,
			description: staticInfo?.description,
			supportsReasoningEffort:
				staticInfo && "supportsReasoningEffort" in staticInfo ? staticInfo.supportsReasoningEffort : undefined,
		}

		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	private async loadDynamicModels(): Promise<void> {
		try {
			this.models = await getModels({
				provider: "xai",
				apiKey: this.options.xaiApiKey,
				baseUrl: (this.client as any).baseURL || "https://api.x.ai/v1",
			})
		} catch (error) {
			console.error("[XAI] Error loading dynamic models:", error)
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.loadDynamicModels()
		const { id: modelId, info: modelInfo, reasoning } = this.getModel()

		// Use the OpenAI-compatible API.
		let stream
		try {
			stream = await this.client.chat.completions.create({
				model: modelId,
				max_tokens: modelInfo.maxTokens,
				temperature: this.options.modelTemperature ?? XAI_DEFAULT_TEMPERATURE,
				messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
				stream: true,
				stream_options: { include_usage: true },
				...(reasoning && reasoning),
			})
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: delta.reasoning_content as string,
				}
			}

			if (chunk.usage) {
				// Extract detailed token information if available
				// First check for prompt_tokens_details structure (real API response)
				const promptDetails = "prompt_tokens_details" in chunk.usage ? chunk.usage.prompt_tokens_details : null
				const cachedTokens = promptDetails && "cached_tokens" in promptDetails ? promptDetails.cached_tokens : 0

				// Fall back to direct fields in usage (used in test mocks)
				const readTokens =
					cachedTokens ||
					("cache_read_input_tokens" in chunk.usage ? (chunk.usage as any).cache_read_input_tokens : 0)
				const writeTokens =
					"cache_creation_input_tokens" in chunk.usage ? (chunk.usage as any).cache_creation_input_tokens : 0

				const totalCost = calculateApiCostOpenAI(
					modelInfo,
					chunk.usage.prompt_tokens || 0,
					chunk.usage.completion_tokens || 0,
					writeTokens || 0,
					readTokens || 0,
				)

				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
					cacheReadTokens: readTokens,
					cacheWriteTokens: writeTokens,
					totalCost,
				}
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, reasoning } = this.getModel()

		try {
			const response = await this.client.chat.completions.create({
				model: modelId,
				messages: [{ role: "user", content: prompt }],
				...(reasoning && reasoning),
			})

			return response.choices[0]?.message.content || ""
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}
}
