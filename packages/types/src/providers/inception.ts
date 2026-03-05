import type { ModelInfo } from "../model.js"

// https://docs.inceptionlabs.ai/get-started/models
export type InceptionModelId = keyof typeof inceptionModels

export const inceptionDefaultModelId: InceptionModelId = "mercury-2"

export const inceptionModels = {
	"mercury-2": {
		maxTokens: 10_000,
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.25,
		outputPrice: 0.75,
		cacheReadsPrice: 0.025,
		supportsTemperature: true,
		description: "Mercury 2: The fastest reasoning LLM and most powerful model for chat completions",
	},
	"mercury-edit": {
		maxTokens: 1_000,
		contextWindow: 32_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.25,
		outputPrice: 0.75,
		supportsTemperature: true,
		description: "Mercury Edit: A code editing LLM for autocomplete (FIM), apply edit, and next edit suggestions",
	},
} as const satisfies Record<string, ModelInfo>

export const inceptionModelInfoSaneDefaults: ModelInfo = {
	maxTokens: 10_000,
	contextWindow: 128_000,
	supportsImages: false,
	supportsPromptCache: true,
	inputPrice: 0.25,
	outputPrice: 0.75,
}

export const INCEPTION_DEFAULT_TEMPERATURE = 0.7
