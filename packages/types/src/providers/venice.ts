import type { ModelInfo } from "../model.js"

// Venice AI
// https://docs.venice.ai/api-reference/chat-completions
export type VeniceModelId =
	| "glm-4-32b"
	| "trinity-v1"
	| "deepseek-r1-671b"
	| "deepseek-v3-0324"
	| "qwen-2.5-coder-32b"
	| "llama-3.3-70b"

export const veniceDefaultModelId: VeniceModelId = "glm-4-32b"

export const veniceDefaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 32768,
	supportsImages: false,
	supportsPromptCache: false,
	inputPrice: 0,
	outputPrice: 0,
	description: "GLM-4 32B model via Venice AI with private inference.",
}

export const veniceModels = {
	"glm-4-32b": {
		maxTokens: 8192,
		contextWindow: 32768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		description: "GLM-4 32B model via Venice AI with private inference.",
	},
	"trinity-v1": {
		maxTokens: 8192,
		contextWindow: 32768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		description: "Venice Trinity V1 model with private inference.",
	},
	"deepseek-r1-671b": {
		maxTokens: 8192,
		contextWindow: 65536,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningBudget: true,
		inputPrice: 0,
		outputPrice: 0,
		description: "DeepSeek R1 671B reasoning model via Venice AI.",
	},
	"deepseek-v3-0324": {
		maxTokens: 8192,
		contextWindow: 65536,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		description: "DeepSeek V3 0324 model via Venice AI.",
	},
	"qwen-2.5-coder-32b": {
		maxTokens: 8192,
		contextWindow: 32768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		description: "Qwen 2.5 Coder 32B model via Venice AI.",
	},
	"llama-3.3-70b": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		description: "Meta Llama 3.3 70B model via Venice AI.",
	},
} as const satisfies Record<string, ModelInfo>
