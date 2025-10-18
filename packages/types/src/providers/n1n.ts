import type { ModelInfo } from "../model.js"

// n1n.ai is an OpenAI-compatible API that provides access to 400+ models
// Since they have a large and dynamic model list, we'll fetch models dynamically
export type N1nModelId = string

export const n1nDefaultModelId = "gpt-4o-mini"

// Default model info for when dynamic fetching isn't available
export const n1nDefaultModelInfo: ModelInfo = {
	maxTokens: 16_384,
	contextWindow: 128_000,
	supportsImages: true,
	supportsPromptCache: false,
	inputPrice: 0.15,
	outputPrice: 0.6,
}

// Base URL for n1n.ai API
export const N1N_BASE_URL = "https://n1n.ai/v1"
