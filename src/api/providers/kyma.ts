import { type KymaModelId, kymaDefaultModelId, kymaModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class KymaHandler extends BaseOpenAiCompatibleProvider<KymaModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Kyma API",
			baseURL: "https://kymaapi.com/v1",
			apiKey: options.kymaApiKey,
			defaultProviderModelId: kymaDefaultModelId,
			providerModels: kymaModels,
		})
	}
}
