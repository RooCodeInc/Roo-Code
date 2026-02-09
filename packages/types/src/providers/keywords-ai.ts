import type { ModelInfo } from "../model.js"

// Keywords AI
// https://keywordsai.co
export const keywordsAiDefaultModelId = "gpt-4o"

export const keywordsAiDefaultModelInfo: ModelInfo = {
	maxTokens: 16384,
	contextWindow: 128_000,
	supportsImages: true,
	supportsPromptCache: false,
	inputPrice: 2.5,
	outputPrice: 10.0,
	description:
		"GPT-4o is OpenAI's most advanced multimodal model that's faster and cheaper than GPT-4 Turbo with stronger vision capabilities.",
}
