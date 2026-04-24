import { type VeniceModelId, veniceDefaultModelId, veniceModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class VeniceHandler extends BaseOpenAiCompatibleProvider<VeniceModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Venice",
			baseURL: "https://api.venice.ai/api/v1",
			apiKey: options.veniceApiKey,
			defaultProviderModelId: veniceDefaultModelId,
			providerModels: veniceModels,
		})
	}
}
