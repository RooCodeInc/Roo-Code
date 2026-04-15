import { type ModelInfo, type VertexModelId, vertexDefaultModelId, vertexModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { GeminiHandler } from "./gemini"
import { SingleCompletionHandler } from "../index"

export class VertexHandler extends GeminiHandler implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		super({ ...options, isVertex: true })
	}

	override getModel() {
		const modelId = this.options.apiModelId

		let id: string
		let info: ModelInfo

		if (modelId && modelId in vertexModels) {
			// Known Vertex model -- use its curated ModelInfo.
			id = modelId as VertexModelId
			info = vertexModels[id as VertexModelId]
		} else if (modelId) {
			// Custom / third-party MaaS model.
			// Users may supply either a bare model name (e.g. "gpt-oss-120b-maas")
			// or a fully-qualified publisher path
			// (e.g. "publishers/openai/models/gpt-oss-120b-maas").
			// Both forms are passed through as-is; the @google/genai SDK and
			// Vertex AI API accept full resource names directly.
			id = modelId
			info = {
				maxTokens: 8192,
				contextWindow: 128_000,
				supportsImages: true,
				supportsPromptCache: false,
			}
		} else {
			// No model specified -- fall back to the default.
			id = vertexDefaultModelId
			info = vertexModels[vertexDefaultModelId]
		}

		const params = getModelParams({
			format: "gemini",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: info.defaultTemperature ?? 1,
		})

		// Vertex Gemini models perform better with the edit tool instead of apply_diff.
		info = {
			...info,
			excludedTools: [...new Set([...(info.excludedTools || []), "apply_diff"])],
			includedTools: [...new Set([...(info.includedTools || []), "edit"])],
		}

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Gemini's API does not have this
		// suffix.
		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}
}
