import { inceptionModels, inceptionDefaultModelId, inceptionModelInfoSaneDefaults, INCEPTION_DEFAULT_TEMPERATURE, type ModelInfo } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../shared/api"
import { getModelParams } from "../transform/model-params"
import { OpenAICompatibleHandler, OpenAICompatibleConfig } from "./openai-compatible"

export class InceptionHandler extends OpenAICompatibleHandler {
	constructor(options: ApiHandlerOptions) {
		const modelId = options.apiModelId ?? inceptionDefaultModelId
		const modelInfo = inceptionModels[modelId as keyof typeof inceptionModels] || inceptionModelInfoSaneDefaults

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
		const info = inceptionModels[id as keyof typeof inceptionModels] || inceptionModelInfoSaneDefaults

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: INCEPTION_DEFAULT_TEMPERATURE,
		})

		return { id, info, ...params }
	}
}
