import type { ModelInfo } from "../model.js"

// https://platform.deepseek.com/docs/api
// https://api-docs.deepseek.com/quick_start/pricing
export type DeepSeekModelId = keyof typeof deepSeekModels

export const deepSeekDefaultModelId: DeepSeekModelId = "deepseek-chat"

// DeepSeek V3 model info (shared between deepseek-chat and aliases)
// DeepSeek V3.2 supports thinking mode with tool calling via the "thinking" parameter
// See: https://api-docs.deepseek.com/guides/thinking_mode
const deepSeekV3Info: ModelInfo = {
	maxTokens: 8192, // 8K max output
	contextWindow: 128_000,
	supportsImages: false,
	supportsPromptCache: true,
	supportsNativeTools: true,
	supportsReasoningBinary: true, // Supports thinking mode via { thinking: { type: "enabled" } }
	inputPrice: 0.56, // $0.56 per million tokens (cache miss) - Updated Sept 5, 2025
	outputPrice: 1.68, // $1.68 per million tokens - Updated Sept 5, 2025
	cacheWritesPrice: 0.56, // $0.56 per million tokens (cache miss) - Updated Sept 5, 2025
	cacheReadsPrice: 0.07, // $0.07 per million tokens (cache hit) - Updated Sept 5, 2025
	description: `DeepSeek-V3 achieves a significant breakthrough in inference speed over previous models. It tops the leaderboard among open-source models and rivals the most advanced closed-source models globally. Supports thinking mode with tool calling when enabled.`,
}

export const deepSeekModels = {
	"deepseek-chat": deepSeekV3Info,
	// deepseek-3.2 is an alias for deepseek-chat (V3.2 is the current version)
	// Note: The DeepSeek API only supports "deepseek-chat" and "deepseek-reasoner"
	// See: https://api-docs.deepseek.com/quick_start/pricing
	"deepseek-3.2": {
		...deepSeekV3Info,
		description: `DeepSeek V3.2 (alias for deepseek-chat). ${deepSeekV3Info.description}`,
	},
	"deepseek-reasoner": {
		maxTokens: 65536, // 64K max output for reasoning mode
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		inputPrice: 0.56, // $0.56 per million tokens (cache miss) - Updated Sept 5, 2025
		outputPrice: 1.68, // $1.68 per million tokens - Updated Sept 5, 2025
		cacheWritesPrice: 0.56, // $0.56 per million tokens (cache miss) - Updated Sept 5, 2025
		cacheReadsPrice: 0.07, // $0.07 per million tokens (cache hit) - Updated Sept 5, 2025
		description: `DeepSeek-R1 achieves performance comparable to OpenAI-o1 across math, code, and reasoning tasks. Supports Chain of Thought reasoning with up to 64K output tokens.`,
	},
} as const satisfies Record<string, ModelInfo>

// Map of model aliases to their official API model names
// The DeepSeek API only supports "deepseek-chat" and "deepseek-reasoner"
// See: https://api-docs.deepseek.com/quick_start/pricing
export const deepSeekModelAliases: Record<string, string> = {
	"deepseek-3.2": "deepseek-chat",
}

export const DEEP_SEEK_DEFAULT_TEMPERATURE = 0.6
