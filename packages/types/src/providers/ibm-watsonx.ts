import type { ModelInfo } from "../model.js"

export const REGION_TO_URL: Record<string, string> = {
	Dallas: "https://us-south.ml.cloud.ibm.com",
	Frankfurt: "https://eu-de.ml.cloud.ibm.com",
	London: "https://eu-gb.ml.cloud.ibm.com",
	Tokyo: "https://jp-tok.ml.cloud.ibm.com",
	Sydney: "https://au-syd.ml.cloud.ibm.com",
	Toronto: "https://ca-tor.ml.cloud.ibm.com",
	Mumbai: "https://ap-south-1.aws.wxai.ibm.com",
}

/**
 * Models that are not suitable for general text inference tasks.
 * These are typically guard/safety models used for content moderation.
 */
export const WATSONX_NON_INFERENCE_MODELS = [
	"meta-llama/llama-guard-3-11b-vision",
	"ibm/granite-guardian-3-8b",
	"ibm/granite-guardian-3-2b",
] as const

export type WatsonxAIModelId = keyof typeof watsonxModels
export const watsonxDefaultModelId = "ibm/granite-3-3-8b-instruct"

// Common model properties
export const baseModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 128000,
	supportsImages: false,
	supportsPromptCache: false,
	supportsNativeTools: true,
	defaultToolProtocol: "native",
}

export const watsonxModels = {
	// IBM Granite model
	"ibm/granite-3-3-8b-instruct": {
		...baseModelInfo,
	},
} as const satisfies Record<string, ModelInfo>
