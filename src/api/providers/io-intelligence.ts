import { ioIntelligenceDefaultModelId, ioIntelligenceModels, type IOIntelligenceModelId } from "@roo-code/types"
import { Anthropic } from "@anthropic-ai/sdk"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import { getModels } from "./fetchers/modelCache"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream } from "../transform/stream"

export class IOIntelligenceHandler extends BaseOpenAiCompatibleProvider<string> {
	protected models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		if (!options.ioIntelligenceApiKey) {
			throw new Error("IO Intelligence API key is required")
		}

		super({
			...options,
			providerName: "IO Intelligence",
			baseURL: "https://api.intelligence.io.solutions/api/v1",
			defaultProviderModelId: ioIntelligenceDefaultModelId,
			providerModels: ioIntelligenceModels as Record<string, any>,
			defaultTemperature: 0.7,
			apiKey: options.ioIntelligenceApiKey,
		})
	}

	public async fetchModel() {
		try {
			this.models = await getModels({
				provider: "io-intelligence",
				apiKey: this.options.ioIntelligenceApiKey,
			})
		} catch (error) {
			console.error("Failed to fetch IO Intelligence models, falling back to default models:", error)
			// Fallback to default models if API fails
			this.models = ioIntelligenceModels as ModelRecord
		}
		return this.getModel()
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Ensure we have up-to-date model metadata by fetching models dynamically
		await this.fetchModel()

		// Now call the parent implementation which will use our updated models
		yield* super.createMessage(systemPrompt, messages, metadata)
	}

	override getModel() {
		const modelId = this.options.ioIntelligenceModelId || ioIntelligenceDefaultModelId

		// Try to get from fetched models first
		let modelInfo = this.models[modelId]

		// If not found in fetched models, try fallback models
		if (!modelInfo) {
			modelInfo = this.providerModels[modelId] ?? this.providerModels[ioIntelligenceDefaultModelId]
		}

		if (modelInfo) {
			return { id: modelId, info: modelInfo }
		}

		// Return the requested model ID even if not found, with fallback info
		return {
			id: modelId,
			info: {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: false,
			},
		}
	}
}
