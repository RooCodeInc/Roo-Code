import type { ModelInfo } from "../model.js"

// https://kymaapi.com — OpenAI-compatible LLM gateway with 20+ open-source models
export type KymaModelId =
	| "qwen-3.6-plus"
	| "deepseek-v3"
	| "deepseek-r1"
	| "kimi-k2.5"
	| "gemma-4-31b"
	| "llama-3.3-70b"
	| "qwen-3-32b"
	| "minimax-m2.5"

export const kymaDefaultModelId: KymaModelId = "qwen-3.6-plus"

export const kymaModels = {
	"qwen-3.6-plus": {
		maxTokens: 8192,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 1.6,
		description: "Qwen 3.6 Plus — top-tier open model, best overall quality.",
	},
	"deepseek-v3": {
		maxTokens: 8192,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.26,
		outputPrice: 0.38,
		description: "DeepSeek V3 — GPT-4-class coding and reasoning at very low cost.",
	},
	"deepseek-r1": {
		maxTokens: 8192,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 2.18,
		description: "DeepSeek R1 — strong open reasoning model, 96% cheaper than o1.",
	},
	"kimi-k2.5": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 3.0,
		description: "Kimi K2.5 — multimodal agentic model optimized for tool use.",
	},
	"gemma-4-31b": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.0,
		outputPrice: 0.0,
		description: "Gemma 4 31B — Google's latest multimodal open model, free tier.",
	},
	"llama-3.3-70b": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.23,
		outputPrice: 0.4,
		description: "Llama 3.3 70B — most popular open model, great balance of speed and quality.",
	},
	"qwen-3-32b": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.2,
		outputPrice: 0.6,
		description: "Qwen 3 32B — top coding model, fast and accurate.",
	},
	"minimax-m2.5": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.8,
		outputPrice: 2.0,
		description: "MiniMax M2.5 — SWE-bench 80.2%, strong coding and agentic tasks.",
	},
} as const satisfies Record<string, ModelInfo>
