import {
	ioIntelligenceDefaultModelId,
	ioIntelligenceModels,
	type IOIntelligenceModelId,
	type ModelInfo,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { OpenAICompatibleHandler, type OpenAICompatibleConfig } from "./openai-compatible"

export class IOIntelligenceHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		if (!options.ioIntelligenceApiKey) {
			throw new Error("IO Intelligence API key is required")
		}

		const modelId = options.ioIntelligenceModelId ?? ioIntelligenceDefaultModelId
		const modelInfo: ModelInfo = ioIntelligenceModels[modelId as IOIntelligenceModelId] ??
			ioIntelligenceModels[ioIntelligenceDefaultModelId] ?? {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: false,
			}

		const config: OpenAICompatibleConfig = {
			providerName: "IO Intelligence",
			baseURL: "https://api.intelligence.io.solutions/api/v1",
			apiKey: options.ioIntelligenceApiKey,
			modelId,
			modelInfo,
			modelMaxTokens: options.modelMaxTokens ?? undefined,
			temperature: options.modelTemperature ?? 0.7,
		}

		super(options, config)
	}

	override getModel() {
		const modelId = this.options.ioIntelligenceModelId ?? ioIntelligenceDefaultModelId
		const modelInfo: ModelInfo = ioIntelligenceModels[modelId as IOIntelligenceModelId] ??
			ioIntelligenceModels[ioIntelligenceDefaultModelId] ?? {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: false,
			}

		const params = getModelParams({
			format: "openai",
			modelId,
			model: modelInfo,
			settings: this.options,
			defaultTemperature: 0.7,
		})

		return { id: modelId, info: modelInfo, ...params }
	}
}
