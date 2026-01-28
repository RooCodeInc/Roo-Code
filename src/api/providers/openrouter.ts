import { Anthropic } from "@anthropic-ai/sdk"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { streamText, generateText } from "ai"

import {
	type ModelRecord,
	type ModelInfo,
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	ApiProviderError,
} from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import { BaseProvider } from "./base-provider"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import { getModelEndpoints } from "./fetchers/modelEndpointCache"
import { applyRouterToolPreferences } from "./utils/router-tool-preferences"
import { getModelParams } from "../transform/model-params"
import { convertToAiSdkMessages, convertToolsForAiSdk, processAiSdkStreamPart } from "../transform/ai-sdk"
import { generateImageWithProvider, ImageGenerationResult } from "./utils/image-generation"

import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import type { ApiStreamChunk, ApiStreamUsageChunk } from "../transform/stream"

/**
 * Reasoning detail structure for preserving reasoning context across multi-turn conversations.
 * Used by models like Gemini 3 that provide structured reasoning information.
 */
interface ReasoningDetail {
	type: string
	text?: string
	summary?: string
	data?: string
	id?: string | null
	format?: string
	signature?: string
	index: number
}

/**
 * OpenRouter handler using the Vercel AI SDK.
 * This provides a standardized interface following the AI SDK provider pattern.
 */
export class OpenRouterHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected models: ModelRecord = {}
	protected endpoints: ModelRecord = {}
	private readonly providerName = "OpenRouter"
	private currentReasoningDetails: ReasoningDetail[] = []

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

	/**
	 * Create the OpenRouter provider instance using the AI SDK
	 * @param reasoning - Optional reasoning parameters to pass via extraBody
	 */
	private createOpenRouterProvider(reasoning?: { effort?: string; max_tokens?: number; exclude?: boolean }) {
		const apiKey = this.options.openRouterApiKey ?? "not-provided"
		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"

		return createOpenRouter({
			apiKey,
			baseURL,
			...(reasoning && { extraBody: { reasoning } }),
		})
	}

	/**
	 * Get the accumulated reasoning details from the current streaming session.
	 * These details are used by Task.ts to preserve reasoning context across multi-turn
	 * conversations with models like Gemini 3.
	 *
	 * @returns Array of reasoning details if available, undefined otherwise
	 */
	getReasoningDetails(): ReasoningDetail[] | undefined {
		return this.currentReasoningDetails.length > 0 ? this.currentReasoningDetails : undefined
	}

	/**
	 * Normalize usage data from the AI SDK response into the ApiStreamUsageChunk format.
	 * Extracts detailed usage information including cache tokens, reasoning tokens, and calculates cost.
	 *
	 * @param usage - Basic usage from AI SDK (inputTokens, outputTokens)
	 * @param providerMetadata - Provider-specific metadata that may contain extended usage info
	 * @param modelInfo - Model information for cost calculation
	 * @returns Normalized ApiStreamUsageChunk with all available usage metrics
	 */
	private normalizeUsage(
		usage: { inputTokens: number; outputTokens: number },
		providerMetadata: Record<string, any> | undefined,
		modelInfo: ModelInfo,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens ?? 0
		const outputTokens = usage.outputTokens ?? 0

		// Extract OpenRouter-specific metadata
		// The AI SDK exposes provider metadata under the provider key
		const openrouterMeta = providerMetadata?.openrouter ?? {}

		// Extract cache tokens from various possible locations
		// OpenRouter AI SDK may provide: cachedInputTokens, cache_read_input_tokens, etc.
		const cacheReadTokens =
			openrouterMeta.cachedInputTokens ??
			openrouterMeta.cache_read_input_tokens ??
			openrouterMeta.cacheReadTokens ??
			openrouterMeta.cached_tokens ??
			0

		const cacheWriteTokens =
			openrouterMeta.cacheCreationInputTokens ??
			openrouterMeta.cache_creation_input_tokens ??
			openrouterMeta.cacheWriteTokens ??
			0

		// Extract reasoning tokens from output token details
		// OpenRouter AI SDK may provide: reasoningOutputTokens, output_tokens_details.reasoning_tokens
		const reasoningTokens =
			openrouterMeta.reasoningOutputTokens ??
			openrouterMeta.reasoning_tokens ??
			openrouterMeta.output_tokens_details?.reasoning_tokens ??
			undefined

		// Calculate cost using model pricing information
		// OpenRouter follows the OpenAI convention where input tokens include cached tokens
		const { totalCost } = calculateApiCostOpenAI(
			modelInfo,
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
		)

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			...(cacheWriteTokens > 0 ? { cacheWriteTokens } : {}),
			...(cacheReadTokens > 0 ? { cacheReadTokens } : {}),
			...(typeof reasoningTokens === "number" && reasoningTokens > 0 ? { reasoningTokens } : {}),
			totalCost,
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): AsyncGenerator<ApiStreamChunk> {
		// Reset reasoning details accumulator for this request
		this.currentReasoningDetails = []

		const model = await this.fetchModel()
		const { id: modelId, maxTokens, temperature, reasoning } = model

		// Pass reasoning parameters to extraBody when creating the provider
		const openrouter = this.createOpenRouterProvider(reasoning)
		const coreMessages = convertToAiSdkMessages(messages)
		const tools = convertToolsForAiSdk(metadata?.tools)

		// Build provider options for specific provider routing
		const providerOptions:
			| {
					openrouter?: {
						provider?: {
							order: string[]
							only: string[]
							allow_fallbacks: boolean
						}
					}
			  }
			| undefined =
			this.options.openRouterSpecificProvider &&
			this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME
				? {
						openrouter: {
							provider: {
								order: [this.options.openRouterSpecificProvider],
								only: [this.options.openRouterSpecificProvider],
								allow_fallbacks: false,
							},
						},
					}
				: undefined

		// Accumulator for reasoning text to build a single reasoning detail
		let accumulatedReasoningText = ""

		try {
			const result = streamText({
				model: openrouter.chat(modelId),
				system: systemPrompt,
				messages: coreMessages,
				maxOutputTokens: maxTokens && maxTokens > 0 ? maxTokens : undefined,
				temperature,
				tools,
				toolChoice: metadata?.tool_choice as any,
				providerOptions,
			})

			// Process the full stream for all event types
			for await (const part of result.fullStream) {
				// Capture reasoning text for accumulation
				if (part.type === "reasoning-delta") {
					accumulatedReasoningText += part.text
				}

				yield* processAiSdkStreamPart(part)
			}

			// After streaming completes, store accumulated reasoning as a detail
			if (accumulatedReasoningText) {
				this.currentReasoningDetails.push({
					type: "reasoning.text",
					text: accumulatedReasoningText,
					index: 0,
				})
			}

			// After streaming completes, yield usage information with detailed metrics
			const usage = await result.usage
			const totalUsage = await result.totalUsage
			// Access provider metadata for extended usage information (cache tokens, reasoning tokens, etc.)
			// The AI SDK provides this through providerMetadata or experimental_providerMetadata
			const providerMetadata =
				(await result.providerMetadata) ?? (await (result as any).experimental_providerMetadata)

			// Normalize and yield usage with all available metrics
			const usageChunk = this.normalizeUsage(
				{
					inputTokens: totalUsage.inputTokens ?? usage.inputTokens ?? 0,
					outputTokens: totalUsage.outputTokens ?? usage.outputTokens ?? 0,
				},
				providerMetadata,
				model.info,
			)
			yield usageChunk
		} catch (error: any) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "createMessage")
			TelemetryService.instance.captureException(apiError)
			yield {
				type: "error",
				error: "OpenRouterError",
				message: `${this.providerName} API Error: ${errorMessage}`,
			}
		}
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

	override getModel() {
		const id = this.options.openRouterModelId ?? openRouterDefaultModelId

		// First check instance models (populated by fetchModel)
		let info = this.models[id]

		if (!info) {
			// Fall back to global cache
			const cachedModels = getModelsFromCache("openrouter")
			if (cachedModels?.[id]) {
				this.models = cachedModels
				info = cachedModels[id]
			}
		}

		// If a specific provider is requested, use the endpoint for that provider
		if (this.options.openRouterSpecificProvider && this.endpoints[this.options.openRouterSpecificProvider]) {
			info = this.endpoints[this.options.openRouterSpecificProvider]
		}

		// Fall back to default if nothing found
		if (!info) {
			info = openRouterDefaultModelInfo
		}

		// Apply tool preferences for models accessed through routers
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

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, maxTokens, temperature, reasoning } = await this.fetchModel()

		// Pass reasoning parameters to extraBody when creating the provider
		const openrouter = this.createOpenRouterProvider(reasoning)

		// Build provider options for specific provider routing
		const providerOptions:
			| {
					openrouter?: {
						provider?: {
							order: string[]
							only: string[]
							allow_fallbacks: boolean
						}
					}
			  }
			| undefined =
			this.options.openRouterSpecificProvider &&
			this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME
				? {
						openrouter: {
							provider: {
								order: [this.options.openRouterSpecificProvider],
								only: [this.options.openRouterSpecificProvider],
								allow_fallbacks: false,
							},
						},
					}
				: undefined

		try {
			const result = await generateText({
				model: openrouter.chat(modelId),
				prompt,
				maxOutputTokens: maxTokens && maxTokens > 0 ? maxTokens : undefined,
				temperature,
				providerOptions,
			})

			return result.text
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "completePrompt")
			TelemetryService.instance.captureException(apiError)
			throw new Error(`${this.providerName} completion error: ${errorMessage}`)
		}
	}

	/**
	 * Generate an image using OpenRouter's image generation API (chat completions with modalities)
	 * Note: OpenRouter only supports the chat completions approach, not the /images/generations endpoint
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
