import type { ModelInfo } from "../model.js"

// Cloud.ru Foundation Models (CFM)
// https://cloud.ru/ai/foundation-models
// Models are fetched dynamically from the API

// Use a valid model ID as default. This will be overridden once models are fetched.
export const cloudRuDefaultModelId = "GigaChat/GigaChat-2-Max"

export const cloudRuDefaultModelInfo: ModelInfo = {
	maxTokens: 32768,
	contextWindow: 131072,
	supportsImages: false,
	supportsPromptCache: false,
	supportsTemperature: true,
	defaultTemperature: 0.7,
	description: "Cloud.ru Foundation Models - Default model",
}
