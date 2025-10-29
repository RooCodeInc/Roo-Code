import type { ModelInfo } from "../model.js"

// Minimax
// https://www.minimax.io/platform/document/text_api_intro
// https://www.minimax.io/platform/document/pricing
export type MinimaxModelId = keyof typeof minimaxModels
export const minimaxDefaultModelId: MinimaxModelId = "MiniMax-M2"

export const minimaxModels = {
	"MiniMax-M2": {
		maxTokens: 128_000,
		contextWindow: 192_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 1.2,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0,
		description:
			"MiniMax M2, a model born for Agents and code. At only 8% of the price of Claude Sonnet and twice the speed, it's available for free for a limited time!",
	},
} as const satisfies Record<string, ModelInfo>

export const MINIMAX_DEFAULT_TEMPERATURE = 1.0
