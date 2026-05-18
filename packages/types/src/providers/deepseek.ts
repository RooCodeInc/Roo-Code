import type { ModelInfo } from "../model.js"

// https://platform.deepseek.com/docs/api
// preserveReasoning enables interleaved thinking mode for tool calls:
// DeepSeek requires reasoning_content to be passed back during tool call
// continuation within the same turn. See: https://api-docs.deepseek.com/guides/thinking_mode
export type DeepSeekModelId = keyof typeof deepSeekModels

export const deepSeekDefaultModelId: DeepSeekModelId = "deepseek-v4-flash"

export const deepSeekModels = {
	"deepseek-v4-flash": {
		maxTokens: 384_000, // 384K max output
		contextWindow: 1_000_000,
		supportsImages: false,
		supportsPromptCache: true,
		preserveReasoning: true,
		supportsReasoningEffort: ["disable", "high", "xhigh"],
		reasoningEffort: "high",
		inputPrice: 0.14, // $0.14 per million tokens (cache miss) - Updated Apr 30, 2026
		outputPrice: 0.28, // $0.28 per million tokens - Updated Apr 30, 2026
		cacheWritesPrice: 0.14, // $0.14 per million tokens (cache miss) - Updated Apr 30, 2026
		cacheReadsPrice: 0.0028, // $0.0028 per million tokens (cache hit) - Updated Apr 30, 2026
		description: `DeepSeek-V4 Flash supports 1M context, 384K max output, tool calls, and thinking/non-thinking modes.`,
	},
	"deepseek-v4-pro": {
		maxTokens: 384_000, // 384K max output
		contextWindow: 1_000_000,
		supportsImages: false,
		supportsPromptCache: true,
		preserveReasoning: true,
		supportsReasoningEffort: ["disable", "high", "xhigh"],
		reasoningEffort: "high",
		inputPrice: 0.435, // $0.435 per million tokens (cache miss, 75% off until May 31, 2026) - Updated Apr 30, 2026
		outputPrice: 0.87, // $0.87 per million tokens (75% off until May 31, 2026) - Updated Apr 30, 2026
		cacheWritesPrice: 0.435, // $0.435 per million tokens (cache miss, 75% off until May 31, 2026) - Updated Apr 30, 2026
		cacheReadsPrice: 0.003625, // $0.003625 per million tokens (cache hit, 75% off until May 31, 2026) - Updated Apr 30, 2026
		description: `DeepSeek-V4 Pro supports 1M context, 384K max output, tool calls, and thinking/non-thinking modes.`,
	},
} as const satisfies Record<string, ModelInfo>

// https://api-docs.deepseek.com/quick_start/parameter_settings
export const DEEP_SEEK_DEFAULT_TEMPERATURE = 0.3
