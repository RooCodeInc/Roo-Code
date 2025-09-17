import type { ModelInfo } from "../model.js"

// https://api.inference.wandb.ai/v1
export type WandbModelId = keyof typeof wandbModels

export const wandbDefaultModelId: WandbModelId = "zai-org/GLM-4.5"

export const wandbModels = {
	"openai/gpt-oss-120b": {
		maxTokens: 32766,
		contextWindow: 131000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 0.6,
		description:
			"Efficient Mixture-of-Experts model designed for high-reasoning, agentic and general-purpose use cases.",
	},
	"openai/gpt-oss-20b": {
		maxTokens: 32768,
		contextWindow: 131000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.05,
		outputPrice: 0.2,
		description:
			"Lower latency Mixture-of-Experts model trained on OpenAI's Harmony response format with reasoning capabilities.",
	},
	"zai-org/GLM-4.5": {
		maxTokens: 98304,
		contextWindow: 131000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.55,
		outputPrice: 2.0,
		description:
			"Mixture-of-Experts model with user-controllable thinking/non-thinking modes for strong reasoning, code generation, and agent alignment.",
	},
	"deepseek-ai/DeepSeek-V3.1": {
		maxTokens: 32768,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.55,
		outputPrice: 1.65,
		description: "A large hybrid model that supports both thinking and non-thinking modes via prompt templates.",
	},
	"meta-llama/Llama-3.1-8B-Instruct": {
		maxTokens: 8192,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.22,
		outputPrice: 0.22,
		description: "Efficient conversational model optimized for responsive multilingual chatbot interactions.",
	},
	"deepseek-ai/DeepSeek-V3-0324": {
		maxTokens: 32768,
		contextWindow: 161000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.14,
		outputPrice: 2.75,
		description:
			"Robust Mixture-of-Experts model tailored for high-complexity language processing and comprehensive document analysis.",
	},
	"meta-llama/Llama-3.3-70B-Instruct": {
		maxTokens: 32768,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.71,
		outputPrice: 0.71,
		description:
			"Multilingual model excelling in conversational tasks, detailed instruction-following, and coding.",
	},
	"deepseek-ai/DeepSeek-R1-0528": {
		maxTokens: 65536,
		contextWindow: 161000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.35,
		outputPrice: 5.4,
		description:
			"Optimized for precise reasoning tasks including complex coding, math, and structured document analysis.",
	},
	"moonshotai/Kimi-K2-Instruct": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.35,
		outputPrice: 4.0,
		description: "Mixture-of-Experts model optimized for complex tool use, reasoning, and code synthesis.",
	},
	"Qwen/Qwen3-Coder-480B-A35B-Instruct": {
		maxTokens: 32768,
		contextWindow: 262000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 1.5,
		description:
			"Mixture-of-Experts model optimized for agentic coding tasks such as function calling, tool use, and long-context reasoning.",
	},
	"meta-llama/Llama-4-Scout-17B-16E-Instruct": {
		maxTokens: 32768,
		contextWindow: 64000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.17,
		outputPrice: 0.66,
		description:
			"Multimodal model integrating text and image understanding, ideal for visual tasks and combined analysis.",
	},
	"Qwen/Qwen3-235B-A22B-Instruct-2507": {
		maxTokens: 32768,
		contextWindow: 262000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.1,
		outputPrice: 0.1,
		description:
			"Efficient multilingual, Mixture-of-Experts, instruction-tuned model, optimized for logical reasoning.",
	},
	"microsoft/Phi-4-mini-instruct": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.08,
		outputPrice: 0.35,
		description: "Compact, efficient model ideal for fast responses in resource-constrained environments.",
	},
	"Qwen/Qwen3-235B-A22B-Thinking-2507": {
		maxTokens: 32768,
		contextWindow: 262000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.1,
		outputPrice: 0.1,
		description:
			"High-performance Mixture-of-Experts model optimized for structured reasoning, math, and long-form generation.",
		supportsReasoningEffort: true,
	},
} as const satisfies Record<string, ModelInfo>
