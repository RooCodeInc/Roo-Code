import { basetenModels, basetenDefaultModelId, type BasetenModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { OpenAICompatibleHandler, type OpenAICompatibleConfig } from "./openai-compatible"

export class BasetenHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		const modelId = options.apiModelId ?? basetenDefaultModelId
		const modelInfo = basetenModels[modelId as keyof typeof basetenModels] || basetenModels[basetenDefaultModelId]

		const config: OpenAICompatibleConfig = {
			providerName: "Baseten",
			baseURL: "https://inference.baseten.co/v1",
			apiKey: options.basetenApiKey ?? "not-provided",
			modelId,
			modelInfo,
			modelMaxTokens: options.modelMaxTokens ?? undefined,
			temperature: options.modelTemperature ?? 0.5,
		}

		super(options, config)
	}

	override getModel() {
		const id = this.options.apiModelId ?? basetenDefaultModelId
		const info = basetenModels[id as keyof typeof basetenModels] || basetenModels[basetenDefaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0.5,
		})
		return { id, info, ...params }
	}
}
