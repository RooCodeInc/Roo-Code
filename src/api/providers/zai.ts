import {
	internationalZAiModels,
	mainlandZAiModels,
	internationalZAiDefaultModelId,
	mainlandZAiDefaultModelId,
	ZAI_DEFAULT_TEMPERATURE,
	zaiApiLineConfigs,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import type { InternationalZAiModelId, MainlandZAiModelId, ModelInfo } from "@roo-code/types"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

type ZAiModelId = InternationalZAiModelId | MainlandZAiModelId

export class ZAiHandler extends BaseOpenAiCompatibleProvider<ZAiModelId> {
	constructor(options: ApiHandlerOptions) {
		const line = options.zaiApiLine ?? "international_coding"
		const { isChina, baseUrl } = zaiApiLineConfigs[line]

		const defaultModelId = isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId
		const providerModels = (isChina ? mainlandZAiModels : internationalZAiModels) as unknown as Record<
			ZAiModelId,
			ModelInfo
		>

		super({
			...options,
			providerName: "Z AI",
			baseURL: baseUrl,
			apiKey: options.zaiApiKey ?? "not-provided",
			defaultProviderModelId: defaultModelId,
			providerModels,
			defaultTemperature: ZAI_DEFAULT_TEMPERATURE,
		})
	}
}
