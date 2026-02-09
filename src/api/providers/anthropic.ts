import { createAnthropic } from "@ai-sdk/anthropic"
import { streamText } from "ai"

import { type ModelInfo, type AnthropicModelId, anthropicDefaultModelId, anthropicModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseAnthropicAiSdkHandler } from "./base-anthropic-ai-sdk-handler"

export class AnthropicHandler extends BaseAnthropicAiSdkHandler {
	protected options: ApiHandlerOptions
	protected readonly providerName = "Anthropic"
	private provider: ReturnType<typeof createAnthropic>

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const useAuthToken = Boolean(options.anthropicBaseUrl && options.anthropicUseAuthToken)

		// Build beta headers for model-specific features
		const betas: string[] = []
		const modelId = options.apiModelId

		if (modelId === "claude-3-7-sonnet-20250219:thinking") {
			betas.push("output-128k-2025-02-19")
		}

		if (
			(modelId === "claude-sonnet-4-20250514" ||
				modelId === "claude-sonnet-4-5" ||
				modelId === "claude-opus-4-6") &&
			options.anthropicBeta1MContext
		) {
			betas.push("context-1m-2025-08-07")
		}

		this.provider = createAnthropic({
			baseURL: options.anthropicBaseUrl || undefined,
			...(useAuthToken ? { authToken: options.apiKey } : { apiKey: options.apiKey }),
			headers: {
				...DEFAULT_HEADERS,
				...(betas.length > 0 ? { "anthropic-beta": betas.join(",") } : {}),
			},
		})
	}

	protected getProviderModel(id: string): Parameters<typeof streamText>[0]["model"] {
		return this.provider(id)
	}

	getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in anthropicModels ? (modelId as AnthropicModelId) : anthropicDefaultModelId
		let info: ModelInfo = anthropicModels[id]

		// If 1M context beta is enabled for supported models, update the model info
		if (
			(id === "claude-sonnet-4-20250514" || id === "claude-sonnet-4-5" || id === "claude-opus-4-6") &&
			this.options.anthropicBeta1MContext
		) {
			const tier = info.tiers?.[0]
			if (tier) {
				info = {
					...info,
					contextWindow: tier.contextWindow,
					inputPrice: tier.inputPrice,
					outputPrice: tier.outputPrice,
					cacheWritesPrice: tier.cacheWritesPrice,
					cacheReadsPrice: tier.cacheReadsPrice,
				}
			}
		}

		const params = getModelParams({
			format: "anthropic",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Anthropic's API does not have this
		// suffix.
		return {
			id: id === "claude-3-7-sonnet-20250219:thinking" ? "claude-3-7-sonnet-20250219" : id,
			info,
			...params,
		}
	}
}
