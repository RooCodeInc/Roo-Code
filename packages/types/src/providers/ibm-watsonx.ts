import type { ModelInfo } from "../model.js"

export const REGION_TO_URL: Record<string, string> = {
	"us-south": "https://us-south.ml.cloud.ibm.com",
	"eu-de": "https://eu-de.ml.cloud.ibm.com",
	"eu-gb": "https://eu-gb.ml.cloud.ibm.com",
	"jp-tok": "https://jp-tok.ml.cloud.ibm.com",
	"au-syd": "https://au-syd.ml.cloud.ibm.com",
	"ca-tor": "https://ca-tor.ml.cloud.ibm.com",
	"ap-south-1": "https://ap-south-1.aws.wxai.ibm.com",
}

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
