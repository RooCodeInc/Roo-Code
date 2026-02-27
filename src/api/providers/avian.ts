import { type AvianModelId, avianDefaultModelId, avianModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class AvianHandler extends BaseOpenAiCompatibleProvider<AvianModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Avian",
			baseURL: "https://api.avian.io/v1",
			apiKey: options.avianApiKey,
			defaultProviderModelId: avianDefaultModelId,
			providerModels: avianModels,
		})
	}
}
