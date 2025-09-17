import type { ModelInfo } from "../model.js"

// IBM watsonx.ai models
// https://www.ibm.com/products/watsonx-ai
export type WatsonxModelId = keyof typeof watsonxModels

export const watsonxDefaultModelId: WatsonxModelId = "ibm/granite-3-8b-instruct"

export const watsonxModels = {
	// Granite models - IBM's foundation models
	"ibm/granite-3-8b-instruct": {
		maxTokens: 8192,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0002,
		outputPrice: 0.0006,
		description: "IBM Granite 3.0 8B Instruct - Optimized for enterprise tasks",
	},
	"ibm/granite-3-2b-instruct": {
		maxTokens: 4096,
		contextWindow: 4096,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0001,
		outputPrice: 0.0003,
		description: "IBM Granite 3.0 2B Instruct - Lightweight model for simple tasks",
	},
	"ibm/granite-20b-multilingual": {
		maxTokens: 8192,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0006,
		outputPrice: 0.0018,
		description: "IBM Granite 20B Multilingual - Supports multiple languages",
	},
	"ibm/granite-13b-chat-v2": {
		maxTokens: 8192,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0004,
		outputPrice: 0.0012,
		description: "IBM Granite 13B Chat v2 - Optimized for conversational AI",
	},
	"ibm/granite-13b-instruct-v2": {
		maxTokens: 8192,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0004,
		outputPrice: 0.0012,
		description: "IBM Granite 13B Instruct v2 - General purpose instruction following",
	},
	"ibm/granite-7b-lab": {
		maxTokens: 4096,
		contextWindow: 4096,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0002,
		outputPrice: 0.0006,
		description: "IBM Granite 7B Lab - Experimental model for research",
	},
	// Granite Code models - specialized for code generation
	"ibm/granite-34b-code-instruct": {
		maxTokens: 8192,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.001,
		outputPrice: 0.003,
		description: "IBM Granite 34B Code Instruct - Specialized for code generation and understanding",
	},
	"ibm/granite-20b-code-instruct": {
		maxTokens: 8192,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0006,
		outputPrice: 0.0018,
		description: "IBM Granite 20B Code Instruct - Code generation model",
	},
	"ibm/granite-8b-code-instruct": {
		maxTokens: 4096,
		contextWindow: 4096,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0002,
		outputPrice: 0.0006,
		description: "IBM Granite 8B Code Instruct - Lightweight code model",
	},
	"ibm/granite-3b-code-instruct": {
		maxTokens: 2048,
		contextWindow: 2048,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0001,
		outputPrice: 0.0003,
		description: "IBM Granite 3B Code Instruct - Fast code completion",
	},
	// Third-party models available on watsonx
	"meta-llama/llama-3-70b-instruct": {
		maxTokens: 8192,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0029,
		outputPrice: 0.0087,
		description: "Meta Llama 3 70B Instruct on watsonx",
	},
	"meta-llama/llama-3-8b-instruct": {
		maxTokens: 8192,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0002,
		outputPrice: 0.0006,
		description: "Meta Llama 3 8B Instruct on watsonx",
	},
	"mistralai/mixtral-8x7b-instruct-v01": {
		maxTokens: 4096,
		contextWindow: 32768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0005,
		outputPrice: 0.0015,
		description: "Mistral Mixtral 8x7B Instruct on watsonx",
	},
	"mistralai/mistral-large": {
		maxTokens: 8192,
		contextWindow: 32768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.003,
		outputPrice: 0.009,
		description: "Mistral Large on watsonx",
	},
} as const satisfies Record<string, ModelInfo>

export const watsonxModelInfoSaneDefaults: ModelInfo = {
	maxTokens: 4096,
	contextWindow: 8192,
	supportsImages: false,
	supportsPromptCache: false,
	inputPrice: 0,
	outputPrice: 0,
}
