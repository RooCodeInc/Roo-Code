import type { ModelInfo } from "../model.js"

export const doubaoDefaultModelId = "doubao-seed-1-8-251228"

export const doubaoModels = {
	"doubao-seed-code-preview-251028": {
		maxTokens: 32_768,
		contextWindow: 256_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.1944, // $0.1944 per million tokens (1.4 CNY/M)
		outputPrice: 1.6667, // $1.6667 per million tokens (12 CNY/M)
		cacheWritesPrice: 0.1944, // $0.1944 per million tokens (1.4 CNY/M)
		cacheReadsPrice: 0.0333, // $0.0333 per million tokens (0.24 CNY/M cache hit)
		description: `Doubao-seed-code is an AI coding model specifically designed for real-world development scenarios, enhancing bug-fixing and front-end capabilities. It supports transparent input caching, reducing usage costs.`,
	},
	"doubao-seed-1-8-251228": {
		maxTokens: 64_000,
		contextWindow: 256_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsNativeTools: true,
		inputPrice: 0.1667, // $0.1667 per million tokens (1.2 CNY/M)
		outputPrice: 2.2222, // $2.2222 per million tokens (16 CNY/M)
		cacheWritesPrice: 0.1667, // $0.1667 per million tokens (1.2 CNY/M)
		cacheReadsPrice: 0.0222, // $0.0222 per million tokens (0.16 CNY/M cache hit)
		description: `Doubao Seed 1.8 - Optimized for multimodal Agent scenarios`,
	},
	"doubao-seed-1-6-251015": {
		maxTokens: 32_768,
		contextWindow: 256_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsNativeTools: true,
		inputPrice: 0.1667, // $0.1667 per million tokens (1.2 CNY/M)
		outputPrice: 2.2222, // $2.2222 per million tokens (16 CNY/M)
		cacheWritesPrice: 0.1667, // $0.1667 per million tokens (1.2 CNY/M)
		cacheReadsPrice: 0.0222, // $0.0222 per million tokens (0.16 CNY/M cache hit)
		description: `Doubao Seed 1.6 - A new multimodal deep thinking model`,
	},
	"doubao-seed-1-6-lite-251015": {
		maxTokens: 32_768,
		contextWindow: 256_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsNativeTools: true,
		inputPrice: 0.0833, // $0.0833 per million tokens (0.6 CNY/M)
		outputPrice: 0.5556, // $0.5556 per million tokens (4 CNY/M)
		cacheWritesPrice: 0.0833, // $0.0833 per million tokens (0.6 CNY/M)
		cacheReadsPrice: 0.0083, // $0.0083 per million tokens (0.06 CNY/M cache hit)
		description: `Doubao Seed 1.6 Lite - Lightweight version with image content understanding support`,
	},
	"doubao-seed-1-6-flash-250828": {
		maxTokens: 32_768,
		contextWindow: 256_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsNativeTools: true,
		inputPrice: 0.0417, // $0.0417 per million tokens (0.3 CNY/M)
		outputPrice: 0.4167, // $0.4167 per million tokens (3 CNY/M)
		cacheWritesPrice: 0.0417, // $0.0417 per million tokens (0.3 CNY/M)
		cacheReadsPrice: 0.0042, // $0.0042 per million tokens (0.03 CNY/M cache hit)
		description: `Doubao Seed 1.6 Flash - Extreme speed multimodal deep thinking model with tool calling support`,
	},
	"deepseek-v3-2-251201": {
		maxTokens: 32_768,
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		inputPrice: 0.5556, // $0.5556 per million tokens (4 CNY/M)
		outputPrice: 0.8334, // $0.8334 per million tokens (6 CNY/M)
		cacheWritesPrice: 0.5556, // $0.5556 per million tokens (4 CNY/M)
		cacheReadsPrice: 0.0556, // $0.0556 per million tokens (0.4 CNY/M cache hit)
		description: `DeepSeek V3-2 - Model with tool calling support`,
	},
	"kimi-k2-thinking-251104": {
		maxTokens: 32_768,
		contextWindow: 256_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		inputPrice: 0.5556, // $0.5556 per million tokens (4 CNY/M)
		outputPrice: 2.2222, // $2.2222 per million tokens (16 CNY/M)
		cacheWritesPrice: 0.5556, // $0.5556 per million tokens (4 CNY/M)
		cacheReadsPrice: 0.1111, // $0.1111 per million tokens (0.8 CNY/M cache hit)
		description: `Kimi K2 Thinking - Model with tool calling support`,
	},

} as const satisfies Record<string, ModelInfo>

export const doubaoDefaultModelInfo: ModelInfo = doubaoModels[doubaoDefaultModelId]

export const DOUBAO_API_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
export const DOUBAO_API_CHAT_PATH = "/chat/completions"
