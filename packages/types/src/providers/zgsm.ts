import { ModelInfo } from "../model.js"

export const zgsmDefaultModelId = "glm45-fp8"

export const zgsmModels = {
	default: {
		maxTokens: 8192,
		contextWindow: 100_000,
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
