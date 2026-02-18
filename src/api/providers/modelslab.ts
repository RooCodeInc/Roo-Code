import { type ModelsLabModelId, modelsLabDefaultModelId, modelsLabModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

/**
 * ModelsLabHandler — provides access to ModelsLab's uncensored Llama-based LLMs.
 *
 * ModelsLab (https://modelslab.com) exposes an OpenAI-compatible chat endpoint,
 * so this handler is a thin wrapper around BaseOpenAiCompatibleProvider — identical
 * in structure to FireworksHandler and MistralHandler.
 *
 * Supported models:
 *   - llama-3.1-8b-uncensored  (128K context, fast)
 *   - llama-3.1-70b-uncensored (128K context, higher quality)
 *
 * API key: modelsLabApiKey option (or MODELSLAB_API_KEY env var via settings UI)
 * API docs: https://docs.modelslab.com
 */
export class ModelsLabHandler extends BaseOpenAiCompatibleProvider<ModelsLabModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "ModelsLab",
			baseURL: "https://modelslab.com/api/uncensored-chat/v1",
			apiKey: options.modelsLabApiKey,
			defaultProviderModelId: modelsLabDefaultModelId,
			providerModels: modelsLabModels,
		})
	}
}
