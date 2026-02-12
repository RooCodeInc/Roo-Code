import { Anthropic } from "@anthropic-ai/sdk"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { streamText, generateText } from "ai"

import { rooDefaultModelId, getApiProtocol, type ImageGenerationApiMethod } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"

import { Package } from "../../shared/package"
import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"
import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import {
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	handleAiSdkError,
	mapToolChoice,
	yieldResponseMessage,
} from "../transform/ai-sdk"
import { applyToolCacheOptions } from "../transform/cache-breakpoints"
import type { RooReasoningParams } from "../transform/reasoning"
import { getRooReasoning } from "../transform/reasoning"

import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import { BaseProvider } from "./base-provider"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"
import { generateImageWithProvider, generateImageWithImagesApi, ImageGenerationResult } from "./utils/image-generation"
import { t } from "../../i18n"
import type { RooMessage } from "../../core/task-persistence/rooMessage"
import { sanitizeMessagesForProvider } from "../transform/sanitize-messages"

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

		// Create per-request provider with fresh session token
		const provider = this.createRooProvider({ reasoning, taskId: metadata?.taskId })

		// Sanitize messages for the provider API (allowlist: role, content, providerOptions).
		const aiSdkMessages = sanitizeMessagesForProvider(messages)
		const tools = convertToolsForAiSdk(this.convertToolsForOpenAI(metadata?.tools))
		applyToolCacheOptions(tools as Parameters<typeof applyToolCacheOptions>[0], metadata?.toolProviderOptions)

		let lastStreamError: string | undefined

		try {
			const result = streamText({
				model: provider(modelId),
				system: systemPrompt || undefined,
				messages: aiSdkMessages,
				maxOutputTokens: maxTokens && maxTokens > 0 ? maxTokens : undefined,
				temperature,
				tools,
				toolChoice: mapToolChoice(metadata?.tool_choice),
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
			const rooMeta = providerMetadata?.roo as Record<string, any> | undefined

			// Process usage with protocol-aware normalization
			const usage = await result.usage
			const promptTokens = usage.inputTokens ?? 0
			const completionTokens = usage.outputTokens ?? 0

			// Extract cache tokens from provider metadata
			const cacheCreation = (rooMeta?.cache_creation_input_tokens as number) ?? 0
			const cacheRead = (rooMeta?.cache_read_input_tokens as number) ?? (rooMeta?.cached_tokens as number) ?? 0

			// Protocol-aware token normalization:
			// - OpenAI protocol expects TOTAL input tokens (cached + non-cached)
			// - Anthropic protocol expects NON-CACHED input tokens (caches passed separately)
			const apiProtocol = getApiProtocol("roo", modelId)
			const nonCached = Math.max(0, promptTokens - cacheCreation - cacheRead)
			const inputTokens = apiProtocol === "anthropic" ? nonCached : promptTokens

			// Cost: prefer server-side cost, fall back to client-side calculation
			const isFreeModel = info.isFree === true
			const serverCost = rooMeta?.cost as number | undefined
			const { totalCost: calculatedCost } = calculateApiCostOpenAI(
				info,
				promptTokens,
				completionTokens,
				cacheCreation,
				cacheRead,
			)
			const totalCost = isFreeModel ? 0 : (serverCost ?? calculatedCost)

			yield {
				type: "usage" as const,
				inputTokens,
				outputTokens: completionTokens,
				cacheWriteTokens: cacheCreation,
				cacheReadTokens: cacheRead,
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
		const provider = this.createRooProvider()

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
