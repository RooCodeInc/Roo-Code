import type { ModelInfo } from "../model.js"

// https://docs.abliteration.ai/models
export type AbliterationModelId = "abliterated-model"

export const abliterationDefaultModelId: AbliterationModelId = "abliterated-model"

export const abliterationModels = {
	"abliterated-model": {
		maxTokens: 8192,
		contextWindow: 150_000,
		supportsImages: true,
		supportsPromptCache: false,
		description:
			"Default abliteration.ai model. Supports OpenAI-compatible chat completions, streaming, tool calling, and vision.",
	},
} as const satisfies Record<string, ModelInfo>
