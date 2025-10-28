import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { AuthState, rooDefaultModelId, type ModelInfo } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import { convertToOpenAiMessages } from "../transform/openai-format"
import type { RooReasoningParams } from "../transform/reasoning"
import { getRooReasoning } from "../transform/reasoning"

import type { ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import { getModels, flushModels, getModelsFromCache } from "../providers/fetchers/modelCache"
import { handleOpenAIError } from "./utils/openai-error-handler"

// Extend OpenAI's CompletionUsage to include Roo specific fields
interface RooUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
	cost?: number
}

// Add custom interface for Roo params to support reasoning
type RooChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
	reasoning?: RooReasoningParams
}

export class RooHandler extends BaseOpenAiCompatibleProvider<string> {
	private authStateListener?: (state: { state: AuthState }) => void
	private fetcherBaseURL: string

	constructor(options: ApiHandlerOptions) {
		let sessionToken: string | undefined = undefined

		if (CloudService.hasInstance()) {
			sessionToken = CloudService.instance.authService?.getSessionToken()
		}

		let baseURL = process.env.ROO_CODE_PROVIDER_URL ?? "https://api.roocode.com/proxy"

		// Ensure baseURL ends with /v1 for OpenAI client, but don't duplicate it
		if (!baseURL.endsWith("/v1")) {
			baseURL = `${baseURL}/v1`
		}

		// Always construct the handler, even without a valid token.
		// The provider-proxy server will return 401 if authentication fails.
		super({
			...options,
			providerName: "Roo Code Cloud",
			baseURL, // Already has /v1 suffix
			apiKey: sessionToken || "unauthenticated", // Use a placeholder if no token.
			defaultProviderModelId: rooDefaultModelId,
			providerModels: {},
			defaultTemperature: 0.7,
		})

		// Load dynamic models asynchronously - strip /v1 from baseURL for fetcher
		this.fetcherBaseURL = baseURL.endsWith("/v1") ? baseURL.slice(0, -3) : baseURL
		this.loadDynamicModels(this.fetcherBaseURL, sessionToken).catch((error) => {
			console.error("[RooHandler] Failed to load dynamic models:", error)
		})

		if (CloudService.hasInstance()) {
			const cloudService = CloudService.instance

			this.authStateListener = (state: { state: AuthState }) => {
				// Update OpenAI client with current auth token
				// Note: Model cache flush/reload is handled by extension.ts authStateChangedHandler
				const newToken = cloudService.authService?.getSessionToken()
				this.client = new OpenAI({
					baseURL: this.baseURL,
					apiKey: newToken ?? "unauthenticated",
					defaultHeaders: DEFAULT_HEADERS,
				})
			}

			cloudService.on("auth-state-changed", this.authStateListener)
		}
	}

	dispose() {
		if (this.authStateListener && CloudService.hasInstance()) {
			CloudService.instance.off("auth-state-changed", this.authStateListener)
		}
	}

	protected override createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	) {
		const { id: model, info } = this.getModel()

		// Get model parameters including reasoning
		const params = getModelParams({
			format: "openai",
			modelId: model,
			model: info,
			settings: this.options,
			defaultTemperature: this.defaultTemperature,
		})

		// Get Roo-specific reasoning parameters
		const reasoning = getRooReasoning({
			model: info,
			reasoningBudget: params.reasoningBudget,
			reasoningEffort: params.reasoningEffort,
			settings: this.options,
		})

		const max_tokens = params.maxTokens ?? undefined
		const temperature = params.temperature ?? this.defaultTemperature

		const rooParams: RooChatCompletionParams = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
			...(reasoning && { reasoning }),
		}

		try {
			return this.client.chat.completions.create(rooParams, requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const stream = await this.createStream(
			systemPrompt,
			messages,
			metadata,
			metadata?.taskId ? { headers: { "X-Roo-Task-ID": metadata.taskId } } : undefined,
		)

		let lastUsage: RooUsage | undefined = undefined

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta) {
				// Check for reasoning content (similar to OpenRouter)
				if ("reasoning" in delta && delta.reasoning && typeof delta.reasoning === "string") {
					yield {
						type: "reasoning",
						text: delta.reasoning,
					}
				}

				// Also check for reasoning_content for backward compatibility
				if ("reasoning_content" in delta && typeof delta.reasoning_content === "string") {
					yield {
						type: "reasoning",
						text: delta.reasoning_content,
					}
				}

				if (delta.content) {
					yield {
						type: "text",
						text: delta.content,
					}
				}
			}

			if (chunk.usage) {
				lastUsage = chunk.usage as RooUsage
			}
		}

		if (lastUsage) {
			// Check if the current model is marked as free
			const model = this.getModel()
			const isFreeModel = model.info.isFree ?? false

			yield {
				type: "usage",
				inputTokens: lastUsage.prompt_tokens || 0,
				outputTokens: lastUsage.completion_tokens || 0,
				cacheWriteTokens: lastUsage.cache_creation_input_tokens,
				cacheReadTokens: lastUsage.prompt_tokens_details?.cached_tokens,
				totalCost: isFreeModel ? 0 : (lastUsage.cost ?? 0),
			}
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
			console.error("[RooHandler] Error loading dynamic models:", error)
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId || rooDefaultModelId

		// Get models from shared cache
		const models = getModelsFromCache("roo") || {}
		const modelInfo = models[modelId]

		if (modelInfo) {
			return { id: modelId, info: modelInfo }
		}

		// Return the requested model ID even if not found, with fallback info.
		return {
			id: modelId,
			info: {
				maxTokens: 16_384,
				contextWindow: 262_144,
				supportsImages: false,
				supportsReasoningEffort: false,
				supportsPromptCache: true,
				inputPrice: 0,
				outputPrice: 0,
			},
		}
	}
}
