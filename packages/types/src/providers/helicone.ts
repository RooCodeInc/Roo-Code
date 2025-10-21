import type { ModelInfo } from "../model.js"

// Helicone is OpenAI-compatible
export const heliconeDefaultModelId = "claude-4.5-sonnet"

export const heliconeDefaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 200_000,
	supportsImages: true,
	supportsComputerUse: true,
	supportsPromptCache: true,
	inputPrice: 3.0,
	outputPrice: 15.0,
	cacheWritesPrice: 3.75,
	cacheReadsPrice: 0.3,
	description: "Claude 4.5 Sonnet via Helicone AI Gateway.",
}
