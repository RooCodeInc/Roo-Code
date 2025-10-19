import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { AuthState, rooDefaultModelId, rooModels, type RooModelId, type ModelInfo } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { ApiStream } from "../transform/stream"

import type { ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import { getModels } from "../providers/fetchers/modelCache"

export class RooHandler extends BaseOpenAiCompatibleProvider<string> {
	private authStateListener?: (state: { state: AuthState }) => void
	private mergedModels: Record<string, ModelInfo> = rooModels as Record<string, ModelInfo>
	private modelsLoaded = false

	constructor(options: ApiHandlerOptions) {
		let sessionToken: string | undefined = undefined

		if (CloudService.hasInstance()) {
			sessionToken = CloudService.instance.authService?.getSessionToken()
		}

		const baseURL = process.env.ROO_CODE_PROVIDER_URL ?? "https://api.roocode.com/proxy"

		// Always construct the handler, even without a valid token.
		// The provider-proxy server will return 401 if authentication fails.
		super({
			...options,
			providerName: "Roo Code Cloud",
			baseURL,
			apiKey: sessionToken || "unauthenticated", // Use a placeholder if no token.
			defaultProviderModelId: rooDefaultModelId,
			providerModels: rooModels as Record<string, ModelInfo>,
			defaultTemperature: 0.7,
		})

		// Load dynamic models asynchronously
		this.loadDynamicModels(baseURL, sessionToken).catch((error) => {
			console.error("[RooHandler] Failed to load dynamic models:", error)
		})

		if (CloudService.hasInstance()) {
			const cloudService = CloudService.instance

			this.authStateListener = (state: { state: AuthState }) => {
				if (state.state === "active-session") {
					this.client = new OpenAI({
						baseURL: this.baseURL,
						apiKey: cloudService.authService?.getSessionToken() ?? "unauthenticated",
						defaultHeaders: DEFAULT_HEADERS,
					})
				} else if (state.state === "logged-out") {
					this.client = new OpenAI({
						baseURL: this.baseURL,
						apiKey: "unauthenticated",
						defaultHeaders: DEFAULT_HEADERS,
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
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
				}
			}
		}
	}

	private async loadDynamicModels(baseURL: string, apiKey?: string): Promise<void> {
		try {
			const dynamicModels = await getModels({
				provider: "roo",
				baseUrl: baseURL,
				apiKey,
			})
			this.modelsLoaded = true

			// Merge dynamic models with static models, preferring static model info
			this.mergedModels = { ...dynamicModels, ...rooModels } as Record<string, ModelInfo>
		} catch (error) {
			console.error("[RooHandler] Error loading dynamic models:", error)
			// Keep using static models as fallback
			this.modelsLoaded = false
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId || rooDefaultModelId

		// Try to find the model in the merged models (which includes both static and dynamic)
		const modelInfo = this.mergedModels[modelId]

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
