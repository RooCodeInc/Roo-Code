import type { ModelInfo } from "../model.js"

export type WatsonxAIModelId = keyof typeof watsonxAiModels
export const watsonxAiDefaultModelId = ""

// Common model properties
export const baseModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 131072,
	supportsImages: false,
	supportsPromptCache: false,
}

export const watsonxAiModels = {
	// IBM Granite model
	"ibm/granite-3-3-8b-instruct": {
		...baseModelInfo,
	},
} as const satisfies Record<string, ModelInfo>
