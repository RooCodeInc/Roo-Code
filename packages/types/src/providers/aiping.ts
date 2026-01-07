import type { ModelInfo } from "../model.js"

// AiPing API: https://aiping.cn/
export type AipingModelId = keyof typeof aipingModels

export const aipingDefaultModelId: AipingModelId = "MiniMax-M2.1"

export const aipingModels = {
	"MiniMax-M2.1": {
		maxTokens: 200_000,
		contextWindow: 200_000,
		supportsImages: false,
		supportsPromptCache: false,
	},
	"GLM-4.7": {
		maxTokens: 200_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: false,
	},
	"DeepSeek-V3.2": {
		maxTokens: 128_000,
		contextWindow: 128_000,
		supportsPromptCache: false,
	},
} as const satisfies Record<string, ModelInfo>

export const aipingDefaultModelInfo: ModelInfo = aipingModels[aipingDefaultModelId]
