import type { ModelInfo } from "../model.js"

// NVIDIA NIM API model IDs
// Reference: https://build.nvidia.com/explore/discover/models
export type NvidiaModelId =
	| "deepseek-ai/deepseek-r1"
	| "google/gemma-4-31b-it"
	| "meta/llama-3.1-405b-instruct"
	| "meta/llama-3.3-70b-instruct"
	| "z-ai/glm5"
	| "qwen/qwen3.5-397b-a17b"
	| "qwen/qwen3.5-122b-a10b"

export const nvidiaDefaultModelId: NvidiaModelId = "deepseek-ai/deepseek-r1"

export const nvidiaModels = {
	// DeepSeek R1 - reasoning model with enable_thinking support
	"deepseek-ai/deepseek-r1": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		// Critical: This flag enables the reasoning toggle in UI
		supportsReasoningBinary: true,
		inputPrice: 0.0, // NVIDIA NIM pricing varies by deployment
		outputPrice: 0.0,
		description:
			"DeepSeek R1 reasoning model via NVIDIA NIM API. Supports chain-of-thought reasoning with enable_thinking parameter.",
	},
	// Google Gemma 4 - reasoning model with enable_thinking support
	"google/gemma-4-31b-it": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningBinary: true,
		inputPrice: 0.0,
		outputPrice: 0.0,
		description:
			"Google Gemma 4 31B reasoning model via NVIDIA NIM API. Supports chain-of-thought reasoning with enable_thinking parameter.",
	},
	// Llama models - no reasoning support, included for completeness
	"meta/llama-3.1-405b-instruct": {
		maxTokens: 8192,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.0,
		outputPrice: 0.0,
		description: "Meta Llama 3.1 405B Instruct model via NVIDIA NIM API.",
	},
	"meta/llama-3.3-70b-instruct": {
		maxTokens: 8192,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.0,
		outputPrice: 0.0,
		description: "Meta Llama 3.3 70B Instruct model via NVIDIA NIM API.",
	},
	// GLM5 - Z.AI reasoning model with enable_thinking support
	"z-ai/glm5": {
		maxTokens: 32768,
		contextWindow: 204800,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningBinary: true,
		inputPrice: 1.0,
		outputPrice: 3.2,
		description: "Z.AI GLM5 reasoning model via NVIDIA NIM API. Supports chain-of-thought reasoning.",
	},
	// Qwen 3.5 models - reasoning models with enable_thinking support
	"qwen/qwen3.5-397b-a17b": {
		maxTokens: 32768,
		contextWindow: 262144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningBinary: true,
		inputPrice: 0.0,
		outputPrice: 0.0,
		description: "Qwen 3.5 397B reasoning model via NVIDIA NIM API. Supports chain-of-thought reasoning.",
	},
	"qwen/qwen3.5-122b-a10b": {
		maxTokens: 32768,
		contextWindow: 262144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningBinary: true,
		inputPrice: 0.0,
		outputPrice: 0.0,
		description: "Qwen 3.5 122B reasoning model via NVIDIA NIM API. Supports chain-of-thought reasoning.",
	},
} as const satisfies Record<string, ModelInfo>
