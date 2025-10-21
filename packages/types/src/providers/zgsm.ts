import { ModelInfo } from "../model.js"

export const zgsmDefaultModelId = "GLM-4.5"

export const zgsmModels = {
	default: {
		maxTokens: 8192,
		contextWindow: 128_000,
		maxTokensKey: undefined,
		supportsImages: false,
		supportsComputerUse: false,
		supportsPromptCache: true,
		supportsReasoningBudget: false,
		requiredReasoningBudget: false,
		minTokensPerCachePoint: undefined,
		maxCachePoints: undefined,
		cachableFields: undefined,
		description: undefined,
	} as ModelInfo,
} as const satisfies Record<string, ModelInfo>
