import { Anthropic } from "@anthropic-ai/sdk"
import { createHuggingFace } from "@ai-sdk/huggingface"
import { streamText, generateText, ToolSet } from "ai"

import type { ModelRecord, ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	createAiSdkToolStreamProcessor,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import { getHuggingFaceModels, getCachedHuggingFaceModels } from "./fetchers/huggingface"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

const HUGGINGFACE_DEFAULT_TEMPERATURE = 0.7

/**
 * HuggingFace provider using the dedicated @ai-sdk/huggingface package.
 * Provides native support for various models on HuggingFace Hub via the Responses API.
 */
export class HuggingFaceHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createHuggingFace>
	private modelCache: ModelRecord | null = null

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		if (!this.options.huggingFaceApiKey) {
			throw new Error("Hugging Face API key is required")
		}

		// Create the HuggingFace provider using AI SDK
		this.provider = createHuggingFace({
			baseURL: "https://router.huggingface.co/v1",
			apiKey: this.options.huggingFaceApiKey,
			headers: DEFAULT_HEADERS,
		})

		// Try to get cached models first
		this.modelCache = getCachedHuggingFaceModels()

		// Fetch models asynchronously
		this.fetchModels()
	}

	private async fetchModels() {
		try {
			this.modelCache = await getHuggingFaceModels()
		} catch (error) {
			console.error("Failed to fetch HuggingFace models:", error)
		}
	}

	override getModel(): { id: string; info: ModelInfo; maxTokens?: number; temperature?: number } {
		const id = this.options.huggingFaceModelId || "meta-llama/Llama-3.3-70B-Instruct"

		// Try to get model info from cache
		const cachedInfo = this.modelCache?.[id]

		const info: ModelInfo = cachedInfo || {
			maxTokens: 8192,
			contextWindow: 131072,
			supportsImages: false,
			supportsPromptCache: false,
		}

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: HUGGINGFACE_DEFAULT_TEMPERATURE,
		})

		return { id, info, ...params }
	}

	/**
	 * Get the language model for the configured model ID.
	 */
	protected getLanguageModel() {
		const { id } = this.getModel()
		return this.provider(id)
	}

	/**
	 * Process usage metrics from the AI SDK response.
	 */
	protected processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
			details?: {
				cachedInputTokens?: number
				reasoningTokens?: number
			}
		},
		providerMetadata?: {
			huggingface?: {
				promptCacheHitTokens?: number
				promptCacheMissTokens?: number
			}
		},
	): ApiStreamUsageChunk {
		// Extract cache metrics from HuggingFace's providerMetadata if available
		const cacheReadTokens = providerMetadata?.huggingface?.promptCacheHitTokens ?? usage.details?.cachedInputTokens
		const cacheWriteTokens = providerMetadata?.huggingface?.promptCacheMissTokens

		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			cacheReadTokens,
			cacheWriteTokens,
			reasoningTokens: usage.details?.reasoningTokens,
		}
	}

	/**
	 * Get the max tokens parameter to include in the request.
	 */
	protected getMaxOutputTokens(): number | undefined {
		const { info } = this.getModel()
		return this.options.modelMaxTokens || info.maxTokens || undefined
	}

	/**
	 * Create a message stream using the AI SDK.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { temperature } = this.getModel()
		const languageModel = this.getLanguageModel()

		// Convert messages to AI SDK format
		const aiSdkMessages = convertToAiSdkMessages(messages)

		// Convert tools to OpenAI format first, then to AI SDK format
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		// Build the request options
		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature: this.options.modelTemperature ?? temperature ?? HUGGINGFACE_DEFAULT_TEMPERATURE,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
		}

		// Use streamText for streaming responses
		const result = streamText(requestOptions)

		try {
			// Use the stateful processor to handle tool call deduplication
			// HuggingFace doesn't emit streaming tool events (tool-input-start/delta/end),
			// only the final tool-call event, so we need the processor to handle this
			const processStreamPart = createAiSdkToolStreamProcessor()
			for await (const part of result.fullStream) {
				for (const chunk of processStreamPart(part)) {
					yield chunk
				}
			}

			// Yield usage metrics at the end, including cache metrics from providerMetadata
			const usage = await result.usage
			const providerMetadata = await result.providerMetadata
			if (usage) {
				yield this.processUsageMetrics(usage, providerMetadata as any)
			}
		} catch (error) {
			// Handle AI SDK errors (AI_RetryError, AI_APICallError, etc.)
			throw handleAiSdkError(error, "HuggingFace")
		}
	}

	/**
	 * Complete a prompt using the AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		const { temperature } = this.getModel()
		const languageModel = this.getLanguageModel()

		const { text } = await generateText({
			model: languageModel,
			prompt,
			maxOutputTokens: this.getMaxOutputTokens(),
			temperature: this.options.modelTemperature ?? temperature ?? HUGGINGFACE_DEFAULT_TEMPERATURE,
		})

		return text
	}
}
