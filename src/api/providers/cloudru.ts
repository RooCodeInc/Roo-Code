import type { CloudRuModelId, ModelInfo } from "@roo-code/types"
import { cloudRuModels, cloudRuDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

/**
 * Cloud.ru Foundation Models (CFM) provider handler
 * Supports GigaChat and Qwen models through OpenAI-compatible API
 */
export class CloudRuHandler extends BaseOpenAiCompatibleProvider<CloudRuModelId> {
	constructor(options: ApiHandlerOptions) {
		// Use custom base URL if provided, otherwise use default Cloud.ru API endpoint
		const baseURL = options.cloudRuBaseUrl || "https://api.cloud.ru/v1"

		// Use cloudRuApiKey if provided, otherwise fall back to generic apiKey
		const apiKey = options.cloudRuApiKey || options.apiKey

		if (!apiKey) {
			throw new Error("Cloud.ru API key is required")
		}

		super({
			providerName: "Cloud.ru",
			baseURL,
			defaultProviderModelId: cloudRuDefaultModelId,
			providerModels: cloudRuModels as Record<CloudRuModelId, ModelInfo>,
			defaultTemperature: 0.7,
			...options,
			apiKey,
		})
	}
}
