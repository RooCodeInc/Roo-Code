import type { ModelInfo } from "../model.js"

export const POE_DEFAULT_BASE_URL = "https://api.poe.com/v1"

export const poeDefaultModelId = "claude-sonnet-4"

export const poeDefaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 200_000,
	supportsImages: true,
	supportsPromptCache: true,
	inputPrice: 3,
	outputPrice: 15,
	description: "Claude Sonnet 4 via Poe API",
}
