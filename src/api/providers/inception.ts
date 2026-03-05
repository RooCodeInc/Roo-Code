import { inceptionModels, inceptionDefaultModelId, type ModelInfo } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../shared/api"
import { getModelParams } from "../transform/model-params"
import { OpenAICompatibleHandler, OpenAICompatibleConfig } from "./openai-compatible"

export class InceptionHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		const modelId = options.apiModelId ?? inceptionDefaultModelId
		const modelInfo = inceptionModels[modelId as keyof typeof inceptionModels] || inceptionModels[inceptionDefaultModelId]

		const config: OpenAICompatibleConfig = {
			providerName: "inception",
			baseURL: options.inceptionBaseUrl || "https://api.inceptionlabs.ai/v1",
			apiKey: options.inceptionApiKey ?? "not-provided",
			modelId,
			modelInfo,
			modelMaxTokens: options.modelMaxTokens ?? undefined,
			temperature: options.modelTemperature ?? undefined,
		}

		super(options, config)
	}

	override getModel() {
		const id = this.options.apiModelId ?? inceptionDefaultModelId
		const info = inceptionModels[id as keyof typeof inceptionModels] || inceptionModels[inceptionDefaultModelId]

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0.7,
		})

		return { id, info, ...params }
	}
}
