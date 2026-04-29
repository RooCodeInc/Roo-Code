import type { ModelInfo } from "../model.js"

// Perplexity
// https://docs.perplexity.ai/docs/getting-started
// https://docs.perplexity.ai/guides/pricing
export type PerplexityModelId = keyof typeof perplexityModels

export const perplexityDefaultModelId: PerplexityModelId = "sonar-pro"

export const perplexityModels = {
	sonar: {
		maxTokens: 8192,
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 1.0,
		description:
			"Lightweight, cost-effective model with built-in web search grounding. Best for quick lookups and short answers.",
	},
	"sonar-pro": {
		maxTokens: 8192,
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 3.0,
		outputPrice: 15.0,
		description:
			"Perplexity's flagship model with built-in web search grounding. Best for complex queries that benefit from up-to-date information.",
	},
	"sonar-reasoning": {
		maxTokens: 8192,
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 5.0,
		description: "Reasoning model with chain-of-thought and built-in web search grounding.",
	},
	"sonar-reasoning-pro": {
		maxTokens: 8192,
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.0,
		outputPrice: 8.0,
		description:
			"Reasoning model with extended chain-of-thought reasoning and built-in web search grounding for complex multi-step problems.",
	},
} as const satisfies Record<string, ModelInfo>
