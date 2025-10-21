import type { ModelInfo } from "../model.js"

// Helicone is OpenAI-compatible and uses name/provider model IDs.
// TODO [HELICONE]: change this to claude-4.5-sonnet/anthropic as Roo Code is optimized for that
export const heliconeDefaultModelId = "gpt-4o/openai"

export const heliconeDefaultModelInfo: ModelInfo = {
	maxTokens: 16_384,
	contextWindow: 128_000,
	supportsImages: true,
	supportsPromptCache: true,
	inputPrice: 5.0,
	outputPrice: 20.0,
	cacheReadsPrice: 2.5,
	description: "GPT-4o via Helicone AI Gateway.",
}

export const heliconeModels = {
	"gpt-4o/openai": heliconeDefaultModelInfo,
} as const
