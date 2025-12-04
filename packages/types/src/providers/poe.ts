import type { ModelInfo } from "../model.js"

// https://creator.poe.com/docs/external-applications/openai-compatible-api
export type PoeModelId =
	| "gpt-4o"
	| "gpt-4o-mini"
	| "gpt-4-turbo"
	| "gpt-3.5-turbo"
	| "claude-3-5-sonnet"
	| "claude-3-5-haiku"
	| "claude-3-opus"
	| "claude-3-sonnet"
	| "claude-3-haiku"
	| "claude-instant"
	| "gemini-1.5-pro"
	| "gemini-1.5-flash"
	| "llama-3.1-405b"
	| "llama-3.1-70b"
	| "llama-3.1-8b"
	| "mistral-large"
	| "mixtral-8x7b"
	| "qwen-2.5-72b"
	| "solar-mini"

export const poeDefaultModelId: PoeModelId = "claude-3-5-sonnet"

export const poeModels = {
	// GPT Models
	"gpt-4o": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 2.5,
		outputPrice: 10,
		description: "OpenAI's most advanced model with vision capabilities",
	},
	"gpt-4o-mini": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 0.6,
		description: "Affordable and intelligent small model for fast, lightweight tasks",
	},
	"gpt-4-turbo": {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 10,
		outputPrice: 30,
		description: "GPT-4 Turbo with vision capabilities",
	},
	"gpt-3.5-turbo": {
		maxTokens: 4096,
		contextWindow: 16385,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.5,
		description: "Fast and efficient model for most tasks",
	},
	// Claude Models
	"claude-3-5-sonnet": {
		maxTokens: 8192,
		contextWindow: 200000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 3,
		outputPrice: 15,
		description: "Most intelligent Claude model with vision capabilities",
	},
	"claude-3-5-haiku": {
		maxTokens: 4096,
		contextWindow: 200000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.25,
		outputPrice: 1.25,
		description: "Fast and efficient Claude model",
	},
	"claude-3-opus": {
		maxTokens: 4096,
		contextWindow: 200000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 15,
		outputPrice: 75,
		description: "Most powerful Claude 3 model with vision capabilities",
	},
	"claude-3-sonnet": {
		maxTokens: 4096,
		contextWindow: 200000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 3,
		outputPrice: 15,
		description: "Balanced Claude 3 model with vision capabilities",
	},
	"claude-3-haiku": {
		maxTokens: 4096,
		contextWindow: 200000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.25,
		outputPrice: 1.25,
		description: "Fast and lightweight Claude 3 model with vision capabilities",
	},
	"claude-instant": {
		maxTokens: 4096,
		contextWindow: 100000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.8,
		outputPrice: 2.4,
		description: "Fast Claude model for simple tasks",
	},
	// Gemini Models
	"gemini-1.5-pro": {
		maxTokens: 8192,
		contextWindow: 2000000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 3.5,
		outputPrice: 10.5,
		description: "Google's most capable model with 2M context window",
	},
	"gemini-1.5-flash": {
		maxTokens: 8192,
		contextWindow: 1000000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.075,
		outputPrice: 0.3,
		description: "Fast and efficient Gemini model with 1M context window",
	},
	// Llama Models
	"llama-3.1-405b": {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.7,
		outputPrice: 2.7,
		description: "Meta's largest open model with 405B parameters",
	},
	"llama-3.1-70b": {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.59,
		outputPrice: 0.79,
		description: "Powerful open model with 70B parameters",
	},
	"llama-3.1-8b": {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.05,
		outputPrice: 0.08,
		description: "Efficient open model with 8B parameters",
	},
	// Mistral Models
	"mistral-large": {
		maxTokens: 4096,
		contextWindow: 32000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2,
		outputPrice: 6,
		description: "Mistral's flagship model",
	},
	"mixtral-8x7b": {
		maxTokens: 4096,
		contextWindow: 32000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.24,
		outputPrice: 0.24,
		description: "Mixture of experts model with 8x7B parameters",
	},
	// Other Models
	"qwen-2.5-72b": {
		maxTokens: 4096,
		contextWindow: 32000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.35,
		outputPrice: 0.4,
		description: "Alibaba's Qwen 2.5 model with 72B parameters",
	},
	"solar-mini": {
		maxTokens: 4096,
		contextWindow: 32000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.06,
		outputPrice: 0.06,
		description: "Small and efficient model",
	},
} as const satisfies Record<string, ModelInfo>
