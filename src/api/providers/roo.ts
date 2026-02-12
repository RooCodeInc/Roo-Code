import { Anthropic } from "@anthropic-ai/sdk"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { createGateway, streamText, generateText, type ModelMessage } from "ai"

import { rooDefaultModelId, getApiProtocol, type ImageGenerationApiMethod } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"

import { Package } from "../../shared/package"
import type { ApiHandlerOptions } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import {
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	handleAiSdkError,
	mapToolChoice,
	yieldResponseMessage,
} from "../transform/ai-sdk"
import { applyPromptCacheToMessages, mergeProviderOptions } from "../transform/prompt-cache"
import type { RooReasoningParams } from "../transform/reasoning"
import { getRooReasoning } from "../transform/reasoning"

import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import { BaseProvider } from "./base-provider"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import { generateImageWithProvider, generateImageWithImagesApi, ImageGenerationResult } from "./utils/image-generation"
import { normalizeProviderUsage } from "./utils/normalize-provider-usage"
import { t } from "../../i18n"
import type { RooMessage } from "../../core/task-persistence/rooMessage"

function getSessionToken(): string {
	const token = CloudService.hasInstance() ? CloudService.instance.authService?.getSessionToken() : undefined
	return token ?? "unauthenticated"
}

export class RooHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private fetcherBaseURL: string

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		let baseURL = process.env.ROO_CODE_PROVIDER_URL ?? "https://api.roocode.com/proxy"

		// Ensure baseURL ends with /v1 for API calls, but don't duplicate it
		if (!baseURL.endsWith("/v1")) {
			baseURL = `${baseURL}/v1`
		}

		// Strip /v1 from baseURL for fetcher
		this.fetcherBaseURL = baseURL.endsWith("/v1") ? baseURL.slice(0, -3) : baseURL

		const sessionToken = options.rooApiKey ?? getSessionToken()

		this.loadDynamicModels(this.fetcherBaseURL, sessionToken).catch((error) => {
			console.error("[RooHandler] Failed to load dynamic models:", error)
		})
	}

	private shouldUseGatewaySdk(): boolean {
		const envValue = process.env.ROO_CODE_ROUTER_USE_GATEWAY_SDK
		if (!envValue) {
			return false
		}

		return ["1", "true", "yes", "on"].includes(envValue.toLowerCase())
	}

	/**
	 * Per-request provider factory. Creates a fresh provider instance
	 * to ensure the latest session token is used for each request.
	 */
	private createRooProvider(options?: { reasoning?: RooReasoningParams; taskId?: string }) {
		const token = this.options.rooApiKey ?? getSessionToken()
		const headers: Record<string, string> = {
			"X-Roo-App-Version": Package.version,
		}
		if (options?.taskId) {
			headers["X-Roo-Task-ID"] = options.taskId
		}
		const reasoning = options?.reasoning
		return createOpenAICompatible({
			name: "roo",
			apiKey: token || "not-provided",
			baseURL: `${this.fetcherBaseURL}/v1`,
			headers,
			...(reasoning && {
				transformRequestBody: (body: Record<string, unknown>) => ({
					...body,
					reasoning,
				}),
			}),
		})
	}

	private createRooGatewayProvider(options?: { taskId?: string }) {
		const token = this.options.rooApiKey ?? getSessionToken()
		const headers: Record<string, string> = {
			"X-Roo-App-Version": Package.version,
		}
		if (options?.taskId) {
			headers["X-Roo-Task-ID"] = options.taskId
		}

		return createGateway({
			apiKey: token || "not-provided",
			baseURL: `${this.fetcherBaseURL}/v3/ai`,
			headers,
		})
	}

	override isAiSdkProvider() {
		return true as const
	}

	override async *createMessage(
		systemPrompt: string,
		messages: RooMessage[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()
		const { id: modelId, info } = model

		// Get model parameters including reasoning budget/effort
		const params = getModelParams({
			format: "openai",
			modelId,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		// Get Roo-specific reasoning parameters
		const reasoning = getRooReasoning({
			model: info,
			reasoningBudget: params.reasoningBudget,
			reasoningEffort: params.reasoningEffort,
			settings: this.options,
		})

		const maxTokens = params.maxTokens ?? undefined
		const temperature = params.temperature ?? 0

		// Create per-request provider with fresh session token.
		// Optional gateway mode can be enabled via ROO_CODE_ROUTER_USE_GATEWAY_SDK.
		const provider = this.shouldUseGatewaySdk()
			? this.createRooGatewayProvider({ taskId: metadata?.taskId })
			: this.createRooProvider({ reasoning, taskId: metadata?.taskId })

		// RooMessage[] is already AI SDK-compatible, cast directly
		const aiSdkMessages = messages as ModelMessage[]
		const promptCache = applyPromptCacheToMessages({
			adapter: "ai-sdk",
			overrideKey: "roo",
			messages: aiSdkMessages,
			modelInfo: {
				supportsPromptCache: info.supportsPromptCache,
				promptCacheRetention: "promptCacheRetention" in info ? info.promptCacheRetention : undefined,
			},
			settings: this.options,
		})
		const tools = convertToolsForAiSdk(this.convertToolsForOpenAI(metadata?.tools), {
			functionToolProviderOptions: promptCache.toolProviderOptions,
		})
		const providerOptions = mergeProviderOptions(undefined, promptCache.providerOptionsPatch)

		let lastStreamError: string | undefined

		try {
			const result = streamText({
				model: provider(modelId),
				system: promptCache.systemProviderOptions
					? ({
							role: "system",
							content: systemPrompt,
							providerOptions: promptCache.systemProviderOptions,
						} as any)
					: systemPrompt,
				messages: aiSdkMessages,
				maxOutputTokens: maxTokens && maxTokens > 0 ? maxTokens : undefined,
				temperature,
				tools,
				toolChoice: mapToolChoice(metadata?.tool_choice),
				...(providerOptions ? ({ providerOptions } as Record<string, unknown>) : {}),
			})

			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					if (chunk.type === "error") {
						lastStreamError = chunk.message
					}
					yield chunk
				}
			}

			// Check provider metadata for usage details
			const providerMetadata =
				(await result.providerMetadata) ?? (await (result as any).experimental_providerMetadata)
			// Process usage with shared protocol-aware normalization
			const usage = await result.usage
			type UsageLike = typeof usage & {
				details?: { cachedInputTokens?: number }
				cacheCreationInputTokens?: number
				cache_creation_input_tokens?: number
				cachedInputTokens?: number
				cached_tokens?: number
				raw?: Record<string, unknown>
			}
			const usageLike = usage as UsageLike
			const apiProtocol = getApiProtocol("roo", modelId)
			const normalizedUsage = normalizeProviderUsage({
				provider: "roo",
				usage: usageLike,
				apiProtocol,
				providerMetadata: providerMetadata as Record<string, unknown> | undefined,
				modelInfo: info,
				emitZeroCacheTokens: true,
			})

			const isFreeModel = info.isFree === true
			const totalCost = isFreeModel ? 0 : normalizedUsage.chunk.totalCost

			yield {
				type: "usage" as const,
				inputTokens: normalizedUsage.chunk.inputTokens,
				nonCachedInputTokens: normalizedUsage.chunk.nonCachedInputTokens,
				outputTokens: normalizedUsage.chunk.outputTokens,
				cacheWriteTokens: normalizedUsage.chunk.cacheWriteTokens,
				cacheReadTokens: normalizedUsage.chunk.cacheReadTokens,
				reasoningTokens: normalizedUsage.chunk.reasoningTokens,
				totalCost,
			}

			yield* yieldResponseMessage(result)
		} catch (error) {
			if (lastStreamError) {
				throw new Error(lastStreamError)
			}

			const errorContext = {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				modelId: this.options.apiModelId,
				hasTaskId: Boolean(metadata?.taskId),
			}

			console.error(`[RooHandler] Error during message streaming: ${JSON.stringify(errorContext)}`)

			throw handleAiSdkError(error, "Roo Code Cloud")
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId } = this.getModel()
		const provider = this.shouldUseGatewaySdk() ? this.createRooGatewayProvider() : this.createRooProvider()

		try {
			const result = await generateText({
				model: provider(modelId),
				prompt,
				temperature: this.options.modelTemperature ?? 0,
			})
			return result.text
		} catch (error) {
			throw handleAiSdkError(error, "Roo Code Cloud")
		}
	}

	private async loadDynamicModels(baseURL: string, apiKey?: string): Promise<void> {
		try {
			// Fetch models and cache them in the shared cache
			await getModels({
				provider: "roo",
				baseUrl: baseURL,
				apiKey,
			})
		} catch (error) {
			// Enhanced error logging with more context
			console.error("[RooHandler] Error loading dynamic models:", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				baseURL,
				hasApiKey: Boolean(apiKey),
			})
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId || rooDefaultModelId

		// Get models from shared cache (settings are already applied by the fetcher)
		const models = getModelsFromCache("roo") || {}
		const modelInfo = models[modelId]

		if (modelInfo) {
			return { id: modelId, info: modelInfo }
		}

		// Return the requested model ID even if not found, with fallback info.
		const fallbackInfo = {
			maxTokens: 16_384,
			contextWindow: 262_144,
			supportsImages: false,
			supportsReasoningEffort: false,
			supportsPromptCache: true,
			inputPrice: 0,
			outputPrice: 0,
			isFree: false,
		}

		return {
			id: modelId,
			info: fallbackInfo,
		}
	}

	/**
	 * Generate an image using Roo Code Cloud's image generation API
	 * @param prompt The text prompt for image generation
	 * @param model The model to use for generation
	 * @param inputImage Optional base64 encoded input image data URL
	 * @param apiMethod The API method to use (chat_completions or images_api)
	 * @returns The generated image data and format, or an error
	 */
	async generateImage(
		prompt: string,
		model: string,
		inputImage?: string,
		apiMethod?: ImageGenerationApiMethod,
	): Promise<ImageGenerationResult> {
		const sessionToken = this.options.rooApiKey ?? getSessionToken()

		if (!sessionToken || sessionToken === "unauthenticated") {
			return {
				success: false,
				error: t("tools:generateImage.roo.authRequired"),
			}
		}

		const baseURL = `${this.fetcherBaseURL}/v1`

		// Use the specified API method, defaulting to chat_completions for backward compatibility
		if (apiMethod === "images_api") {
			return generateImageWithImagesApi({
				baseURL,
				authToken: sessionToken,
				model,
				prompt,
				inputImage,
				outputFormat: "png",
			})
		}

		// Default to chat completions approach
		return generateImageWithProvider({
			baseURL,
			authToken: sessionToken,
			model,
			prompt,
			inputImage,
		})
	}
}
