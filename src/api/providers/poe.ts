import { type PoeModelId, poeDefaultModelId, poeModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class PoeHandler extends BaseOpenAiCompatibleProvider<PoeModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Poe",
			baseURL: "https://api.poe.com/v1",
			apiKey: options.poeApiKey,
			defaultProviderModelId: poeDefaultModelId,
			providerModels: poeModels,
			defaultTemperature: 0.7,
		})
	}
}
