import type { ModelInfo } from "../model.js"

// https://llm.chutes.ai/v1 (OpenAI compatible)
export const chutesDefaultModelId = "deepseek-ai/DeepSeek-R1-0528"

export const chutesDefaultModelInfo: ModelInfo = {
	maxTokens: 32768,
	contextWindow: 163840,
	supportsImages: false,
	supportsPromptCache: false,
	inputPrice: 0,
	outputPrice: 0,
	description: "DeepSeek R1 0528 model.",
}
