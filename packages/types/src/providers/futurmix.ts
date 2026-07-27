import type { ModelInfo } from "../model.js"

// FuturMix
// https://futurmix.ai
export const futurmixDefaultModelId = "claude-sonnet-4-20250514"

export const futurmixDefaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 200_000,
	supportsImages: true,
	supportsPromptCache: true,
	inputPrice: 3.0,
	outputPrice: 15.0,
	cacheWritesPrice: 3.75,
	cacheReadsPrice: 0.3,
}
