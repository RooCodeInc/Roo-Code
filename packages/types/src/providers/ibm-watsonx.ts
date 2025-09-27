import type { ModelInfo } from "../model.js"

export type WatsonxAIModelId = keyof typeof watsonxModels
export const watsonxDefaultModelId = "ibm/granite-3-3-8b-instruct"

// Common model properties
export const baseModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 131072,
	supportsImages: false,
	supportsPromptCache: false,
}

export const watsonxModels = {
	// IBM Granite model
	"ibm/granite-3-3-8b-instruct": {
		...baseModelInfo,
	},
} as const satisfies Record<string, ModelInfo>
