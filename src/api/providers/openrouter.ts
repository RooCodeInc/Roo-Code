import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { streamText, generateText, ToolSet, type SystemModelMessage } from "ai"

import {
	type ModelRecord,
	type ModelInfo,
	ApiProviderError,
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
	OPEN_ROUTER_PROMPT_CACHING_MODELS,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
} from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { NeutralMessageParam } from "../../core/task-persistence"
import type { ApiHandlerOptions } from "../../shared/api"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import type { OpenRouterReasoningParams } from "../transform/reasoning"
import { getModelParams } from "../transform/model-params"
import { buildCachedSystemMessage, applyCacheBreakpoints } from "../transform/caching"

import { getModels } from "./fetchers/modelCache"
import { getModelEndpoints } from "./fetchers/modelEndpointCache"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import { generateImageWithProvider, ImageGenerationResult } from "./utils/image-generation"
import { applyRouterToolPreferences } from "./utils/router-tool-preferences"

/**
 * OpenRouter provider using the AI SDK (@openrouter/ai-sdk-provider).
 * Supports routing across multiple upstream providers with provider-specific features.
 */
export class OpenRouterHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected models: ModelRecord = {}
	protected endpoints: ModelRecord = {}
	private readonly providerName = "OpenRouter"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Load models asynchronously to populate cache before getModel() is called
		this.loadDynamicModels().catch((error) => {
			console.error("[OpenRouterHandler] Failed to load dynamic models:", error)
		})
	}

	private async loadDynamicModels(): Promise<void> {
		try {
			const [models, endpoints] = await Promise.all([
				getModels({ provider: "openrouter" }),
				getModelEndpoints({
					router: "openrouter",
					modelId: this.options.openRouterModelId,
					endpoint: this.options.openRouterSpecificProvider,
				}),
			])

			this.models = models
			this.endpoints = endpoints
		} catch (error) {
			console.error("[OpenRouterHandler] Error loading dynamic models:", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})
		}
	}

	override isAiSdkProvider(): boolean {
		return true
	}

	/**
	 * Create the AI SDK OpenRouter provider with appropriate configuration.
	 */
	protected createProvider() {
		const baseURL = this.options.openRouterBaseUrl || undefined
		const apiKey = this.options.openRouterApiKey ?? "not-provided"

		return createOpenRouter({
			apiKey,
			baseURL: baseURL || undefined,
			headers: { ...DEFAULT_HEADERS },
			compatibility: "strict",
		})
	}

	override getModel() {
		const id = this.options.openRouterModelId ?? openRouterDefaultModelId
		let info: ModelInfo = this.models[id] ?? openRouterDefaultModelInfo

		// If a specific provider is requested, use the endpoint for that provider.
		if (this.options.openRouterSpecificProvider && this.endpoints[this.options.openRouterSpecificProvider]) {
			info = this.endpoints[this.options.openRouterSpecificProvider]
		}

		// Apply tool preferences for models accessed through routers (OpenAI, Gemini)
		info = applyRouterToolPreferences(id, info)

		const isDeepSeekR1 = id.startsWith("deepseek/deepseek-r1") || id === "perplexity/sonar-reasoning"

		const params = getModelParams({
			format: "openrouter",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0,
		})

		return { id, info, topP: isDeepSeekR1 ? 0.95 : undefined, ...params }
	}

	public async fetchModel() {
		const [models, endpoints] = await Promise.all([
			getModels({ provider: "openrouter" }),
			getModelEndpoints({
				router: "openrouter",
				modelId: this.options.openRouterModelId,
				endpoint: this.options.openRouterSpecificProvider,
			}),
		])

		this.models = models
		this.endpoints = endpoints

		return this.getModel()
	}

	/**
	 * Build OpenRouter provider options for routing, reasoning, and usage accounting.
	 */
	private buildProviderOptions(modelId: string, reasoning: OpenRouterReasoningParams | undefined) {
		const openrouterOptions: Record<string, unknown> = {}

		// Provider routing
		if (
			this.options.openRouterSpecificProvider &&
			this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME
		) {
			openrouterOptions.provider = {
				order: [this.options.openRouterSpecificProvider],
				only: [this.options.openRouterSpecificProvider],
				allow_fallbacks: false,
			}
		}

		// Reasoning configuration
		if (reasoning) {
			openrouterOptions.reasoning = reasoning
		}

		// Usage accounting
		openrouterOptions.usage = { include: true }

		return { openrouter: openrouterOptions }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = await this.fetchModel()
		let { id: modelId, info: modelInfo, maxTokens, temperature, topP, reasoning } = model

		// OpenRouter sends reasoning tokens by default for Gemini 2.5 Pro models
		// even if you don't request them. Explicitly disable them unless the user
		// has explicitly configured reasoning.
		if (
			(modelId === "google/gemini-2.5-pro-preview" || modelId === "google/gemini-2.5-pro") &&
			typeof reasoning === "undefined"
		) {
			reasoning = { exclude: true }
		}

		const provider = this.createProvider()
		const languageModel = provider.chat(modelId)

		// Convert messages and tools
		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		// Build system prompt with optional cache control for prompt caching models
		let system: string | SystemModelMessage = systemPrompt

		if (OPEN_ROUTER_PROMPT_CACHING_MODELS.has(modelId)) {
			system = buildCachedSystemMessage(systemPrompt, "openrouter")

			if (modelId.startsWith("google")) {
				applyCacheBreakpoints(aiSdkMessages, "openrouter", { style: "every-nth", frequency: 10 })
			} else {
				applyCacheBreakpoints(aiSdkMessages, "openrouter")
			}
		}

		// Build provider options for routing, reasoning, and usage
		const providerOptions = this.buildProviderOptions(modelId, reasoning)

		// Add Anthropic beta header for fine-grained tool streaming when using Anthropic models
		const headers = modelId.startsWith("anthropic/")
			? { "x-anthropic-beta": "fine-grained-tool-streaming-2025-05-14" }
			: undefined

		const result = streamText({
			model: languageModel,
			system,
			messages: aiSdkMessages,
			temperature,
			topP,
			maxOutputTokens: maxTokens && maxTokens > 0 ? maxTokens : undefined,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
			providerOptions: providerOptions as any,
			headers,
		})

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			const usage = await result.usage
			const providerMetadata = await result.providerMetadata
			if (usage) {
				yield this.processUsageMetrics(
					usage,
					providerMetadata as Record<string, Record<string, unknown>> | undefined,
				)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "createMessage")
			TelemetryService.instance.captureException(apiError)
			throw handleAiSdkError(error, this.providerName)
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const model = await this.fetchModel()
		const { id: modelId, maxTokens, temperature, reasoning } = model

		const provider = this.createProvider()
		const languageModel = provider.chat(modelId)

		// Build provider options for routing, reasoning, and usage
		const providerOptions = this.buildProviderOptions(modelId, reasoning)

		try {
			const { text } = await generateText({
				model: languageModel,
				prompt,
				temperature,
				maxOutputTokens: maxTokens || undefined,
				providerOptions: providerOptions as any,
			})
			return text
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "completePrompt")
			TelemetryService.instance.captureException(apiError)
			throw handleAiSdkError(error, this.providerName)
		}
	}

	/**
	 * Process usage metrics from the AI SDK response, including OpenRouter cost information.
	 * @see https://openrouter.ai/docs/use-cases/usage-accounting
	 */
	protected processUsageMetrics(
		usage: {
			inputTokens?: number
			outputTokens?: number
		},
		providerMetadata?: Record<string, Record<string, unknown>>,
	): ApiStreamUsageChunk {
		const openrouterMeta = providerMetadata?.openrouter as Record<string, unknown> | undefined
		const usageAccounting = openrouterMeta?.usage as Record<string, unknown> | undefined

		// Extract detailed token info from OpenRouter usage accounting
		const promptTokensDetails = usageAccounting?.promptTokensDetails as { cachedTokens?: number } | undefined
		const completionTokensDetails = usageAccounting?.completionTokensDetails as
			| { reasoningTokens?: number }
			| undefined
		const cost = usageAccounting?.cost as number | undefined
		const costDetails = usageAccounting?.costDetails as { upstreamInferenceCost?: number } | undefined

		return {
			type: "usage",
			inputTokens: usage.inputTokens || 0,
			outputTokens: usage.outputTokens || 0,
			cacheReadTokens: promptTokensDetails?.cachedTokens,
			reasoningTokens: completionTokensDetails?.reasoningTokens,
			totalCost: (costDetails?.upstreamInferenceCost || 0) + (cost || 0),
		}
	}

	/**
	 * Generate an image using OpenRouter's image generation API (chat completions with modalities).
	 * Note: OpenRouter only supports the chat completions approach, not the /images/generations endpoint.
	 * @param prompt The text prompt for image generation
	 * @param model The model to use for generation
	 * @param apiKey The OpenRouter API key (must be explicitly provided)
	 * @param inputImage Optional base64 encoded input image data URL
	 * @returns The generated image data and format, or an error
	 */
	async generateImage(
		prompt: string,
		model: string,
		apiKey: string,
		inputImage?: string,
	): Promise<ImageGenerationResult> {
		if (!apiKey) {
			return {
				success: false,
				error: "OpenRouter API key is required for image generation",
			}
		}

		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"

		// OpenRouter only supports chat completions approach for image generation
		return generateImageWithProvider({
			baseURL,
			authToken: apiKey,
			model,
			prompt,
			inputImage,
		})
	}
}
