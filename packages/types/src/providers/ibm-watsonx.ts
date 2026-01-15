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

/**
 * Models that don't support tool_calls (native tools).
 */
export const WATSONX_NON_TOOL_CALLS_MODELS = [
	"ibm/granite-3-2-8b-instruct",
	"ibm/granite-3-3-8b-instruct",
	"ibm/granite-3-3-8b-instruct-np",
	"ibm/granite-3-8b-instruct",
	"mistral-large-2512",
	"mistralai/mistral-medium-2505",
	"mistralai/mistral-small-3-1-24b-instruct-2503",
] as const

export type WatsonxAIModelId = keyof typeof watsonxModels
export const watsonxDefaultModelId = "ibm/granite-4-h-small"

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
	"ibm/granite-4-h-small": {
		...baseModelInfo,
	},
} as const satisfies Record<string, ModelInfo>
