import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { AuthState, rooDefaultModelId, type ModelInfo } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { ApiStream } from "../transform/stream"

import type { ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import { getModels, flushModels, getModelsFromCache } from "../providers/fetchers/modelCache"

// Extend OpenAI's CompletionUsage to include Roo specific fields
interface RooUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
	cost?: number
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
				if (state.state === "active-session") {
					const newToken = cloudService.authService?.getSessionToken()
					this.client = new OpenAI({
						baseURL: this.baseURL,
						apiKey: newToken ?? "unauthenticated",
						defaultHeaders: DEFAULT_HEADERS,
					})

					// Flush cache and reload models with the new auth token
					flushModels("roo")
						.then(() => {
							return this.loadDynamicModels(this.fetcherBaseURL, newToken)
						})
						.catch((error) => {
							console.error("[RooHandler] Failed to reload models after auth:", error)
						})
				} else if (state.state === "logged-out") {
					this.client = new OpenAI({
						baseURL: this.baseURL,
						apiKey: "unauthenticated",
						defaultHeaders: DEFAULT_HEADERS,
					})

					// Flush cache when logged out
					flushModels("roo").catch((error) => {
						console.error("[RooHandler] Failed to flush models on logout:", error)
					})
				}
			}

			cloudService.on("auth-state-changed", this.authStateListener)
		}
	}

	dispose() {
		if (this.authStateListener && CloudService.hasInstance()) {
			CloudService.instance.off("auth-state-changed", this.authStateListener)
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

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta) {
				if (delta.content) {
					yield {
						type: "text",
						text: delta.content,
					}
				}

				if ("reasoning_content" in delta && typeof delta.reasoning_content === "string") {
					yield {
						type: "reasoning",
						text: delta.reasoning_content,
					}
				}
			}

			if (chunk.usage) {
				const usage = chunk.usage as RooUsage
				yield {
					type: "usage",
					inputTokens: usage.prompt_tokens || 0,
					outputTokens: usage.completion_tokens || 0,
					cacheWriteTokens: usage.cache_creation_input_tokens,
					cacheReadTokens: usage.prompt_tokens_details?.cached_tokens,
					totalCost: usage.cost ?? 0,
				}
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
				supportsPromptCache: true,
				inputPrice: 0,
				outputPrice: 0,
			},
		}
	}
}
