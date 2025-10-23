import type { ModelInfo } from "../model.js"

// Minimax
// https://www.minimax.io/platform/document/text_api_intro
// https://www.minimax.io/platform/document/pricing
export type MinimaxModelId = keyof typeof minimaxModels
export const minimaxDefaultModelId: MinimaxModelId = "MiniMax-M1"

export const minimaxModels = {
	"MiniMax-M1": {
		maxTokens: 25_600,
		contextWindow: 1_000_192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 2.2,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0,
	},
} as const satisfies Record<string, ModelInfo>

export const MINIMAX_DEFAULT_TEMPERATURE = 1.0
