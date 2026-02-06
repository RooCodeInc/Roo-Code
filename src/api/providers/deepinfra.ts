import { Anthropic } from "@anthropic-ai/sdk"
import { createDeepInfra } from "@ai-sdk/deepinfra"
import { streamText, generateText, ToolSet } from "ai"

import { deepInfraDefaultModelId, deepInfraDefaultModelInfo, type ModelInfo, type ModelRecord } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"

const DEEPINFRA_DEFAULT_BASE_URL = "https://api.deepinfra.com/v1/openai"

const DEEPINFRA_HEADERS = {
	"X-Deepinfra-Source": "roo-code",
	"X-Deepinfra-Version": "2025-08-25",
}

/**
 * DeepInfra provider using the official @ai-sdk/deepinfra package.
 * Supports dynamic model fetching, reasoning_effort, prompt caching, and custom cost calculation.
 */
export class DeepInfraHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected provider: ReturnType<typeof createDeepInfra>
	protected models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Create the DeepInfra provider once in the constructor (cached)
		this.provider = createDeepInfra({
			apiKey: this.options.deepInfraApiKey ?? "not-provided",
			baseURL: this.options.deepInfraBaseUrl || DEEPINFRA_DEFAULT_BASE_URL,
			headers: {
				...DEFAULT_HEADERS,
				...DEEPINFRA_HEADERS,
			},
		})
	}

	/**
	 * Fetch models dynamically from the DeepInfra API and return the resolved model.
	 */
	async fetchModel() {
		this.models = await getModels({
			provider: "deepinfra",
			apiKey: this.options.deepInfraApiKey,
			baseUrl: this.options.deepInfraBaseUrl || DEEPINFRA_DEFAULT_BASE_URL,
		})
		return this.getModel()
	}

	override getModel() {
		const cachedModels = getModelsFromCache("deepinfra")
		if (cachedModels) {
			this.models = cachedModels
		}

		const id = this.options.deepInfraModelId ?? deepInfraDefaultModelId
		const info = this.models[id] ?? deepInfraDefaultModelInfo

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		return { id, info, ...params }
	}

	/**
	 * Get the language model for the given model ID.
	 */
	protected getLanguageModel(modelId: string) {
		return this.provider(modelId)
	}

	/**
	 * Process usage metrics with DeepInfra-specific cost calculation using calculateApiCostOpenAI.
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
		providerMetadata?: Record<string, any>,
		modelInfo?: ModelInfo,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens || 0
		const outputTokens = usage.outputTokens || 0

		const cacheWriteTokens = providerMetadata?.deepinfra?.cacheWriteTokens ?? undefined
		const cacheReadTokens =
			providerMetadata?.deepinfra?.cachedTokens ?? usage.details?.cachedInputTokens ?? undefined

		const { totalCost } = modelInfo
			? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
			: { totalCost: 0 }

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens: cacheWriteTokens || undefined,
			cacheReadTokens: cacheReadTokens || undefined,
			totalCost,
		}
	}

	/**
	 * Get the max output tokens parameter, only when includeMaxTokens is enabled.
	 */
	protected getMaxOutputTokens(): number | undefined {
		const { info } = this.getModel()
		if (this.options.includeMaxTokens !== true || !info.maxTokens) {
			return undefined
		}
		return this.options.modelMaxTokens || info.maxTokens
	}

	/**
	 * Create a message stream using the AI SDK.
	 * Handles dynamic model fetching, reasoning_effort, prompt caching, and custom cost metrics.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info, temperature, reasoningEffort } = await this.fetchModel()
		const languageModel = this.getLanguageModel(modelId)

		const aiSdkMessages = convertToAiSdkMessages(messages)

		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		// Build DeepInfra-specific provider options
		const deepinfraProviderOptions: Record<string, string> = {}
		if (reasoningEffort) {
			deepinfraProviderOptions.reasoningEffort = reasoningEffort
		}
		if (info.supportsPromptCache && metadata?.taskId) {
			deepinfraProviderOptions.promptCacheKey = metadata.taskId
		}

		const requestOptions: Parameters<typeof streamText>[0] = {
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature,
			maxOutputTokens: this.getMaxOutputTokens(),
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			...(Object.keys(deepinfraProviderOptions).length > 0 && {
				providerOptions: { deepinfra: deepinfraProviderOptions },
			}),
		}

		const result = streamText(requestOptions)

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			const usage = await result.usage
			const providerMetadata = await result.providerMetadata
			if (usage) {
				yield this.processUsageMetrics(usage, providerMetadata as any, info)
			}
		} catch (error) {
			throw handleAiSdkError(error, "DeepInfra")
		}
	}

	/**
	 * Complete a prompt using AI SDK generateText.
	 */
	async completePrompt(prompt: string): Promise<string> {
		await this.fetchModel()
		const { id: modelId, temperature } = this.getModel()
		const languageModel = this.getLanguageModel(modelId)

		const { text } = await generateText({
			model: languageModel,
			prompt,
			maxOutputTokens: this.getMaxOutputTokens(),
			temperature,
		})

		return text
	}

	override isAiSdkProvider(): boolean {
		return true
	}
}
