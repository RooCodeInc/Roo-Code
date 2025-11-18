import type { ModelInfo } from "../model.js"

// Ford LLM models available through Ford's internal API
export type FordLlmModelId = keyof typeof fordllmModels

export const fordllmDefaultModelId: FordLlmModelId = "gemini-2.5-pro"

export const fordllmModels = {
	"gemini-2.5-pro": {
		maxTokens: 65_536,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningEffort: ["low", "high"],
		reasoningEffort: "low",
		supportsTemperature: true,
		defaultTemperature: 1,
		inputPrice: 0, // Internal Ford API - no direct cost
		outputPrice: 0,
	},
	"gemini-2.0-flash-exp": {
		maxTokens: 8192,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningEffort: ["low", "high"],
		reasoningEffort: "low",
		supportsTemperature: true,
		defaultTemperature: 1,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-1.5-pro": {
		maxTokens: 8192,
		contextWindow: 2_097_152,
		supportsImages: true,
		supportsPromptCache: true,
		supportsTemperature: true,
		defaultTemperature: 1,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-1.5-flash": {
		maxTokens: 8192,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsTemperature: true,
		defaultTemperature: 1,
		inputPrice: 0,
		outputPrice: 0,
	},
} satisfies Record<string, ModelInfo>
