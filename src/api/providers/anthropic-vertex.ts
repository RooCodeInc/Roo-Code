import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic"
import { streamText } from "ai"

import {
	type ModelInfo,
	type VertexModelId,
	vertexDefaultModelId,
	vertexModels,
	VERTEX_1M_CONTEXT_MODEL_IDS,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseAnthropicAiSdkHandler } from "./base-anthropic-ai-sdk-handler"

// https://docs.anthropic.com/en/api/claude-on-vertex-ai
export class AnthropicVertexHandler extends BaseAnthropicAiSdkHandler {
	protected options: ApiHandlerOptions
	protected readonly providerName = "Vertex (Anthropic)"
	private provider: ReturnType<typeof createVertexAnthropic>

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#regions
		const projectId = this.options.vertexProjectId ?? "not-provided"
		const region = this.options.vertexRegion ?? "us-east5"

		// Build googleAuthOptions based on provided credentials
		let googleAuthOptions: { credentials?: object; keyFile?: string } | undefined
		if (options.vertexJsonCredentials) {
			try {
				googleAuthOptions = { credentials: JSON.parse(options.vertexJsonCredentials) }
			} catch {
				// If JSON parsing fails, ignore and try other auth methods
			}
		} else if (options.vertexKeyFile) {
			googleAuthOptions = { keyFile: options.vertexKeyFile }
		}

		// Build beta headers for 1M context support
		const modelId = options.apiModelId
		const betas: string[] = []

		if (modelId) {
			const supports1MContext = VERTEX_1M_CONTEXT_MODEL_IDS.includes(
				modelId as (typeof VERTEX_1M_CONTEXT_MODEL_IDS)[number],
			)
			if (supports1MContext && options.vertex1MContext) {
				betas.push("context-1m-2025-08-07")
			}
		}

		this.provider = createVertexAnthropic({
			project: projectId,
			location: region,
			googleAuthOptions,
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
		let id = modelId && modelId in vertexModels ? (modelId as VertexModelId) : vertexDefaultModelId
		let info: ModelInfo = vertexModels[id]

		// Check if 1M context beta should be enabled for supported models
		const supports1MContext = VERTEX_1M_CONTEXT_MODEL_IDS.includes(
			id as (typeof VERTEX_1M_CONTEXT_MODEL_IDS)[number],
		)
		const enable1MContext = supports1MContext && this.options.vertex1MContext

		// If 1M context beta is enabled, update the model info with tier pricing
		if (enable1MContext) {
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

		// Build betas array for request headers (kept for backward compatibility / testing)
		const betas: string[] = []

		if (enable1MContext) {
			betas.push("context-1m-2025-08-07")
		}

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Anthropic's API does not have this
		// suffix.
		return {
			id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id,
			info,
			betas: betas.length > 0 ? betas : undefined,
			...params,
		}
	}
}
