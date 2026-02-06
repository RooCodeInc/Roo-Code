import type { ModelInfo } from "../model.js"

export type AlibabaModelId =
	| "qwen-max"
	| "qwen-max-latest"
	| "qwen-plus"
	| "qwen-plus-latest"
	| "qwen-turbo"
	| "qwen-turbo-latest"
	| "qwen2.5-72b-instruct"
	| "qwen2.5-32b-instruct"
	| "qwen2.5-14b-instruct"
	| "qwen2.5-7b-instruct"
	| "qwen2.5-14b-instruct-1m"
	| "qwen3-235b-a22b"
	| "qwen3-max"
	| "qwen-vl-max"
	| "qwen-vl-plus"

export const alibabaDefaultModelId: AlibabaModelId = "qwen-plus"

export const alibabaModels = {
	"qwen-max": {
		maxTokens: 8_192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: true,
		supportsReasoningBudget: true,
		inputPrice: 2.0,
		outputPrice: 6.0,
		description: "Qwen Max - Most capable model, best for complex reasoning and generation tasks",
	},
	"qwen-max-latest": {
		maxTokens: 8_192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: true,
		supportsReasoningBudget: true,
		inputPrice: 2.0,
		outputPrice: 6.0,
		description: "Qwen Max Latest - Latest version of Qwen Max with most recent improvements",
	},
	"qwen-plus": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.4,
		outputPrice: 1.2,
		description: "Qwen Plus - Balanced performance and cost for general tasks",
	},
	"qwen-plus-latest": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.4,
		outputPrice: 1.2,
		description: "Qwen Plus Latest - Latest version of Qwen Plus",
	},
	"qwen-turbo": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.06,
		outputPrice: 0.24,
		description: "Qwen Turbo - Fastest and most cost-effective for simple tasks",
	},
	"qwen-turbo-latest": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.06,
		outputPrice: 0.24,
		description: "Qwen Turbo Latest - Latest version of Qwen Turbo",
	},
	"qwen2.5-72b-instruct": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.8,
		outputPrice: 2.4,
		description: "Qwen 2.5 72B Instruct - Large open model with strong performance",
	},
	"qwen2.5-32b-instruct": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.4,
		outputPrice: 1.2,
		description: "Qwen 2.5 32B Instruct - Medium-sized model with good balance",
	},
	"qwen2.5-14b-instruct": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.28,
		outputPrice: 0.84,
		description: "Qwen 2.5 14B Instruct - Efficient model for various tasks",
	},
	"qwen2.5-7b-instruct": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.14,
		outputPrice: 0.42,
		description: "Qwen 2.5 7B Instruct - Lightweight model for fast inference",
	},
	"qwen2.5-14b-instruct-1m": {
		maxTokens: 8_192,
		contextWindow: 1_000_000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.28,
		outputPrice: 0.84,
		description: "Qwen 2.5 14B Instruct 1M - Extended 1M context window variant",
	},
	"qwen3-235b-a22b": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		supportsReasoningBudget: true,
		inputPrice: 0.8,
		outputPrice: 2.4,
		description: "Qwen 3 235B A22B - Largest Qwen 3 model with 235B parameters in MoE architecture",
	},
	"qwen3-max": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: true,
		supportsReasoningBudget: true,
		inputPrice: 1.6,
		outputPrice: 4.8,
		description: "Qwen 3 Max - Most capable Qwen 3 model with thinking mode support",
	},
	"qwen-vl-max": {
		maxTokens: 8_192,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 3.0,
		outputPrice: 9.0,
		description: "Qwen VL Max - Best vision model, supports images and video understanding",
	},
	"qwen-vl-plus": {
		maxTokens: 8_192,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 1.2,
		outputPrice: 3.6,
		description: "Qwen VL Plus - Balanced vision model for image understanding tasks",
	},
} as const satisfies Record<AlibabaModelId, ModelInfo>

export const alibabaDefaultModelInfo: ModelInfo = alibabaModels[alibabaDefaultModelId]

// International endpoint (default)
export const ALIBABA_API_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

// China domestic endpoint
export const ALIBABA_API_BASE_URL_CHINA = "https://dashscope.aliyuncs.com/compatible-mode/v1"
