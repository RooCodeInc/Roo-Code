import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { streamText, generateText, ToolSet } from "ai"

import { rooDefaultModelId, getApiProtocol, type ImageGenerationApiMethod } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"

import { Package } from "../../shared/package"
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
import { getModelParams } from "../transform/model-params"
import { getRooReasoning } from "../transform/reasoning"

import { OpenAICompatibleHandler, type OpenAICompatibleConfig } from "./openai-compatible"
import { DEFAULT_HEADERS } from "./constants"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { getModels, getModelsFromCache } from "../providers/fetchers/modelCache"
import { generateImageWithProvider, generateImageWithImagesApi, ImageGenerationResult } from "./utils/image-generation"
import { t } from "../../i18n"

function getSessionToken(): string {
	const token = CloudService.hasInstance() ? CloudService.instance.authService?.getSessionToken() : undefined
	return token ?? "unauthenticated"
}

const FALLBACK_MODEL_INFO = {
	maxTokens: 16_384,
	contextWindow: 262_144,
	supportsImages: false,
	supportsReasoningEffort: false,
	supportsPromptCache: true,
	inputPrice: 0,
	outputPrice: 0,
	isFree: false,
}

export class RooHandler extends OpenAICompatibleHandler {
	private fetcherBaseURL: string

	constructor(options: ApiHandlerOptions) {
		const sessionToken = options.rooApiKey ?? getSessionToken()

		let baseURL = process.env.ROO_CODE_PROVIDER_URL ?? "https://api.roocode.com/proxy"

		// Ensure baseURL ends with /v1 for OpenAI client, but don't duplicate it
		if (!baseURL.endsWith("/v1")) {
			baseURL = `${baseURL}/v1`
		}

		const modelId = options.apiModelId || rooDefaultModelId
		const models = getModelsFromCache("roo") || {}
		const modelInfo = models[modelId] || FALLBACK_MODEL_INFO

		const config: OpenAICompatibleConfig = {
			providerName: "roo",
			baseURL,
			apiKey: sessionToken,
			modelId,
			modelInfo,
		}

		super(options, config)

		// Load dynamic models asynchronously - strip /v1 from baseURL for fetcher
		this.fetcherBaseURL = baseURL.endsWith("/v1") ? baseURL.slice(0, -3) : baseURL

		this.loadDynamicModels(this.fetcherBaseURL, sessionToken).catch((error) => {
			console.error("[RooHandler] Failed to load dynamic models:", error)
		})
	}

	// ── Auth & Provider recreation ─────────────────────────────────

	/**
	 * Refresh the session token and recreate the AI SDK provider with
	 * up-to-date credentials and per-request custom headers.
	 * `createOpenAICompatible()` captures baseURL/apiKey at creation time,
	 * so the provider must be recreated for dynamic credentials.
	 */
	private refreshProvider(taskId?: string): void {
		const sessionToken = this.options.rooApiKey ?? getSessionToken()
		this.config.apiKey = sessionToken

		const headers: Record<string, string> = {
			...DEFAULT_HEADERS,
			"X-Roo-App-Version": Package.version,
		}

		if (taskId) {
			headers["X-Roo-Task-ID"] = taskId
		}

		this.provider = createOpenAICompatible({
			name: this.config.providerName,
			baseURL: this.config.baseURL,
			apiKey: this.config.apiKey,
			headers,
		})
	}

	// ── Model resolution ───────────────────────────────────────────

	override getModel() {
		const modelId = this.options.apiModelId || rooDefaultModelId

		// Get models from shared cache (settings are already applied by the fetcher)
		const models = getModelsFromCache("roo") || {}
		const modelInfo = models[modelId]

		if (modelInfo) {
			return { id: modelId, info: modelInfo }
		}

		// Return the requested model ID even if not found, with fallback info.
		return { id: modelId, info: FALLBACK_MODEL_INFO }
	}

	private async loadDynamicModels(baseURL: string, apiKey?: string): Promise<void> {
		try {
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

	// ── API methods ────────────────────────────────────────────────

	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Refresh auth and recreate provider with custom headers
		this.refreshProvider(metadata?.taskId)

		const { id: modelId, info } = this.getModel()

		// Get model parameters including reasoning settings
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

		// Create language model with transformRequestBody for reasoning params
		const languageModel = this.provider.languageModel(modelId, {
			transformRequestBody: (body: Record<string, unknown>) => {
				const modified = { ...body }
				if (reasoning) {
					modified.reasoning = reasoning as any
				}
				return modified
			},
		})

		// Convert messages and tools to AI SDK format
		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools) as ToolSet | undefined

		const result = streamText({
			model: languageModel,
			system: systemPrompt,
			messages: aiSdkMessages,
			temperature: params.temperature ?? 0,
			maxOutputTokens: params.maxTokens ?? undefined,
			tools: aiSdkTools,
			toolChoice: mapToolChoice(metadata?.tool_choice),
		})

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			const usage = await result.usage
			if (usage) {
				yield this.processUsageMetrics(usage)
			}
		} catch (error) {
			throw handleAiSdkError(error, this.config.providerName)
		}
	}

	override async completePrompt(prompt: string): Promise<string> {
		// Refresh auth and recreate provider
		this.refreshProvider()

		const { id: modelId, info } = this.getModel()

		const params = getModelParams({
			format: "openai",
			modelId,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		const languageModel = this.provider.languageModel(modelId)

		const { text } = await generateText({
			model: languageModel,
			prompt,
			maxOutputTokens: params.maxTokens ?? undefined,
			temperature: params.temperature ?? 0,
		})

		return text
	}

	// ── Usage metrics ──────────────────────────────────────────────

	protected override processUsageMetrics(usage: {
		inputTokens?: number
		outputTokens?: number
		details?: { cachedInputTokens?: number; reasoningTokens?: number }
		raw?: Record<string, unknown>
	}): ApiStreamUsageChunk {
		const model = this.getModel()
		const isFreeModel = (model.info as any).isFree ?? false

		const rawUsage = usage.raw as RooRawUsage | undefined

		// Normalize input tokens based on protocol expectations:
		// - OpenAI protocol expects TOTAL input tokens (cached + non-cached)
		// - Anthropic protocol expects NON-CACHED input tokens (caches passed separately)
		const apiProtocol = getApiProtocol("roo", model.id)

		const promptTokens = rawUsage?.prompt_tokens || usage.inputTokens || 0
		const cacheWrite = rawUsage?.cache_creation_input_tokens || 0
		const cacheRead = rawUsage?.prompt_tokens_details?.cached_tokens || usage.details?.cachedInputTokens || 0
		const nonCached = Math.max(0, promptTokens - cacheWrite - cacheRead)

		const inputTokensForDownstream = apiProtocol === "anthropic" ? nonCached : promptTokens
		const outputTokens = usage.outputTokens || 0

		return {
			type: "usage",
			inputTokens: inputTokensForDownstream,
			outputTokens,
			cacheWriteTokens: cacheWrite > 0 ? cacheWrite : undefined,
			cacheReadTokens: cacheRead > 0 ? cacheRead : undefined,
			totalCost: isFreeModel ? 0 : (rawUsage?.cost ?? 0),
		}
	}

	// ── Image generation ───────────────────────────────────────────

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

/** Roo proxy raw usage data with cache-related and cost fields */
interface RooRawUsage {
	prompt_tokens?: number
	completion_tokens?: number
	cache_creation_input_tokens?: number
	prompt_tokens_details?: { cached_tokens?: number }
	cost?: number
}
