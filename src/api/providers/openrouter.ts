import { Anthropic } from "@anthropic-ai/sdk"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { streamText, generateText } from "ai"

import {
	type ModelRecord,
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
	NATIVE_TOOL_DEFAULTS,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseProvider } from "./base-provider"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import { getModelEndpoints } from "./fetchers/modelEndpointCache"
import { applyRouterToolPreferences } from "./utils/router-tool-preferences"
import { getModelParams } from "../transform/model-params"
import { convertToAiSdkMessages, convertToolsForAiSdk, processAiSdkStreamPart } from "../transform/ai-sdk"
import { generateImageWithProvider, ImageGenerationResult } from "./utils/image-generation"

import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import type { ApiStreamChunk } from "../transform/stream"

/**
 * OpenRouter handler using the Vercel AI SDK.
 * This provides a standardized interface following the AI SDK provider pattern.
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

	/**
	 * Create the OpenRouter provider instance using the AI SDK
	 */
	private createOpenRouterProvider() {
		const apiKey = this.options.openRouterApiKey ?? "not-provided"
		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"

		return createOpenRouter({
			apiKey,
			baseURL,
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): AsyncGenerator<ApiStreamChunk> {
		const model = await this.fetchModel()
		const { id: modelId, maxTokens, temperature } = model

		const openrouter = this.createOpenRouterProvider()
		const coreMessages = convertToAiSdkMessages(messages)
		const tools = convertToolsForAiSdk(metadata?.tools)

		// Build provider options for specific provider routing
		const providerOptions =
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
				yield* processAiSdkStreamPart(part)
			}

			// After streaming completes, yield usage information
			const usage = await result.usage
			const totalUsage = await result.totalUsage

			yield {
				type: "usage",
				inputTokens: totalUsage.inputTokens ?? usage.inputTokens ?? 0,
				outputTokens: totalUsage.outputTokens ?? usage.outputTokens ?? 0,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
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
		info = applyRouterToolPreferences(id, { ...NATIVE_TOOL_DEFAULTS, ...info })

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
		const { id: modelId, maxTokens, temperature } = await this.fetchModel()

		const openrouter = this.createOpenRouterProvider()

		// Build provider options for specific provider routing
		const providerOptions =
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
