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

import { getModelParams } from "../transform/model-params"
import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	yieldResponseMessage,
} from "../transform/ai-sdk"
import { applyToolCacheOptions, applySystemPromptCaching } from "../transform/cache-breakpoints"

import { BaseProvider } from "./base-provider"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import { getModelEndpoints } from "./fetchers/modelEndpointCache"
import { applyRouterToolPreferences } from "./utils/router-tool-preferences"
import { generateImageWithProvider, ImageGenerationResult } from "./utils/image-generation"

import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import type { ApiStreamChunk, ApiStreamUsageChunk } from "../transform/stream"
import type { RooMessage } from "../../core/task-persistence/rooMessage"
import { sanitizeMessagesForProvider } from "../transform/sanitize-messages"

export class OpenRouterHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected models: ModelRecord = {}
	protected endpoints: ModelRecord = {}
	private readonly providerName = "OpenRouter"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
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

	private createOpenRouterProvider(options?: {
		reasoning?: { effort?: string; max_tokens?: number; exclude?: boolean }
		headers?: Record<string, string>
	}) {
		const apiKey = this.options.openRouterApiKey ?? "not-provided"
		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
		const extraBody: Record<string, unknown> = {}
		if (options?.reasoning) {
			extraBody.reasoning = options.reasoning
		}
		return createOpenRouter({
			apiKey,
			baseURL,
			...(Object.keys(extraBody).length > 0 && { extraBody }),
			...(options?.headers && { headers: options.headers }),
		})
	}

	private normalizeUsage(
		usage: { inputTokens: number; outputTokens: number },
		providerMetadata: Record<string, any> | undefined,
		modelInfo: ModelInfo,
	): ApiStreamUsageChunk {
		const inputTokens = usage.inputTokens ?? 0
		const outputTokens = usage.outputTokens ?? 0
		const openrouterMeta = providerMetadata?.openrouter ?? {}
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
		const reasoningTokens =
			openrouterMeta.reasoningOutputTokens ??
			openrouterMeta.reasoning_tokens ??
			openrouterMeta.output_tokens_details?.reasoning_tokens ??
			undefined
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
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): AsyncGenerator<ApiStreamChunk> {
		const model = await this.fetchModel()
		let { id: modelId, maxTokens, temperature, topP, reasoning } = model

		if (
			(modelId === "google/gemini-2.5-pro-preview" || modelId === "google/gemini-2.5-pro") &&
			typeof reasoning === "undefined"
		) {
			reasoning = { exclude: true }
		}

		const isAnthropic = modelId.startsWith("anthropic/")
		const headers: Record<string, string> | undefined = isAnthropic
			? { "x-anthropic-beta": "fine-grained-tool-streaming-2025-05-14" }
			: undefined

		// Sanitize messages for the provider API (allowlist: role, content, providerOptions).
		const aiSdkMessages = sanitizeMessagesForProvider(messages)

		const openrouter = this.createOpenRouterProvider({ reasoning, headers })

		const tools = convertToolsForAiSdk(metadata?.tools)
		applyToolCacheOptions(tools as Parameters<typeof applyToolCacheOptions>[0], metadata?.toolProviderOptions)

		const providerOptions:
			| {
					openrouter?: {
						provider?: { order: string[]; only: string[]; allow_fallbacks: boolean }
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

		// Breakpoint 1: System prompt caching — inject as cached system message
		// OpenRouter routes to Anthropic models that benefit from cache annotations
		const effectiveSystemPrompt = applySystemPromptCaching(
			systemPrompt,
			aiSdkMessages,
			metadata?.systemProviderOptions,
		)

		try {
			const result = streamText({
				model: openrouter.chat(modelId),
				system: effectiveSystemPrompt,
				messages: aiSdkMessages,
				maxOutputTokens: maxTokens && maxTokens > 0 ? maxTokens : undefined,
				temperature,
				topP,
				tools,
				toolChoice: metadata?.tool_choice as any,
				providerOptions,
			})

			for await (const part of result.fullStream) {
				yield* processAiSdkStreamPart(part)
			}

			const providerMetadata =
				(await result.providerMetadata) ?? (await (result as any).experimental_providerMetadata)

			const usage = await result.usage
			const totalUsage = await result.totalUsage
			const usageChunk = this.normalizeUsage(
				{
					inputTokens: totalUsage.inputTokens ?? usage.inputTokens ?? 0,
					outputTokens: totalUsage.outputTokens ?? usage.outputTokens ?? 0,
				},
				providerMetadata,
				model.info,
			)
			yield usageChunk

			yield* yieldResponseMessage(result)
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
		let info = this.models[id]
		if (!info) {
			const cachedModels = getModelsFromCache("openrouter")
			if (cachedModels?.[id]) {
				this.models = cachedModels
				info = cachedModels[id]
			}
		}
		if (this.options.openRouterSpecificProvider && this.endpoints[this.options.openRouterSpecificProvider]) {
			info = this.endpoints[this.options.openRouterSpecificProvider]
		}
		if (!info) {
			info = openRouterDefaultModelInfo
		}
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
		let { id: modelId, maxTokens, temperature, topP, reasoning } = await this.fetchModel()

		if (
			(modelId === "google/gemini-2.5-pro-preview" || modelId === "google/gemini-2.5-pro") &&
			typeof reasoning === "undefined"
		) {
			reasoning = { exclude: true }
		}

		const isAnthropic = modelId.startsWith("anthropic/")
		const headers: Record<string, string> | undefined = isAnthropic
			? { "x-anthropic-beta": "fine-grained-tool-streaming-2025-05-14" }
			: undefined

		const openrouter = this.createOpenRouterProvider({ reasoning, headers })

		const providerOptions:
			| {
					openrouter?: {
						provider?: { order: string[]; only: string[]; allow_fallbacks: boolean }
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
				topP,
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
		return generateImageWithProvider({
			baseURL,
			authToken: apiKey,
			model,
			prompt,
			inputImage,
		})
	}
}
