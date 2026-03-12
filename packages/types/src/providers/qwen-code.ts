import type { ModelInfo } from "../model.js"

export type QwenCodeModelId = "qwen3-coder-plus" | "qwen3-coder-flash" | "coder-model"

export const qwenCodeDefaultModelId: QwenCodeModelId = "coder-model"

export const qwenCodeModels = {
	"qwen3-coder-plus": {
		maxTokens: 65_536,
		contextWindow: 1_000_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0,
		description: "Qwen3 Coder Plus - High-performance coding model with 1M context window for large codebases",
	},
	"qwen3-coder-flash": {
		maxTokens: 65_536,
		contextWindow: 1_000_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0,
		description: "Qwen3 Coder Flash - Fast coding model with 1M context window optimized for speed",
	},
	"coder-model": {
		maxTokens: 65_536,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0,
		description: "Qwen 3.5 Plus - efficient hybrid model with leading coding performance",
	},
} as const satisfies Record<QwenCodeModelId, ModelInfo>
