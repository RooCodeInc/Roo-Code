import { type AbliterationModelId, abliterationDefaultModelId, abliterationModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class AbliterationHandler extends BaseOpenAiCompatibleProvider<AbliterationModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "abliteration.ai",
			baseURL: "https://api.abliteration.ai/v1",
			apiKey: options.abliterationApiKey,
			defaultProviderModelId: abliterationDefaultModelId,
			providerModels: abliterationModels,
		})
	}
}
