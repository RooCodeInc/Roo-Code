import {
	type ModelInfo,
	ioIntelligenceDefaultModelId,
	ioIntelligenceModels,
	type IOIntelligenceModelId,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class IOIntelligenceHandler extends BaseOpenAiCompatibleProvider<IOIntelligenceModelId> {
	constructor(options: ApiHandlerOptions) {
		if (!options.ioIntelligenceApiKey) {
			throw new Error("IO Intelligence API key is required")
		}

		super({
			...options,
			providerName: "IO Intelligence",
			baseURL: "https://api.intelligence.io.solutions/api/v1",
			defaultProviderModelId: ioIntelligenceDefaultModelId,
			providerModels: ioIntelligenceModels,
			defaultTemperature: 0.7,
			apiKey: options.ioIntelligenceApiKey,
		})
	}

	override getModel() {
		const modelId = this.options.ioIntelligenceModelId || (ioIntelligenceDefaultModelId as IOIntelligenceModelId)

		const modelInfo =
			this.providerModels[modelId as IOIntelligenceModelId] ?? this.providerModels[ioIntelligenceDefaultModelId]

		if (modelInfo) {
			// Apply model family defaults for consistent behavior across providers
			const info = this.applyModelDefaults(modelId, modelInfo)
			return { id: modelId as IOIntelligenceModelId, info }
		}

		// Return the requested model ID even if not found, with fallback info.
		let defaultInfo: ModelInfo = {
			maxTokens: 8192,
			contextWindow: 128000,
			supportsImages: false,
			supportsPromptCache: false,
		}

		// Apply model family defaults for consistent behavior across providers
		defaultInfo = this.applyModelDefaults(modelId, defaultInfo)

		return {
			id: modelId as IOIntelligenceModelId,
			info: defaultInfo,
		}
	}
}
