import type { ModelInfo } from "../model.js"

// https://api-docs.deepseek.com/zh-cn/quick_start/pricing
// preserveReasoning enables interleaved thinking mode for tool calls:
// DeepSeek requires reasoning_content to be passed back during tool call
// continuation within the same turn. See: https://api-docs.deepseek.com/guides/thinking_mode
export type DeepSeekModelId = keyof typeof deepSeekModels

export const deepSeekDefaultModelId: DeepSeekModelId = "deepseek-v4-flash"

export const deepSeekModels = {
	"deepseek-chat": {
		maxTokens: 8192, // 8K max output
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.28, // $0.28 per million tokens (cache miss) - Updated Dec 9, 2025
		outputPrice: 0.42, // $0.42 per million tokens - Updated Dec 9, 2025
		cacheWritesPrice: 0.28, // $0.28 per million tokens (cache miss) - Updated Dec 9, 2025
		cacheReadsPrice: 0.028, // $0.028 per million tokens (cache hit) - Updated Dec 9, 2025
		description: `DeepSeek-V3.2 (Non-thinking Mode) - Legacy model. Use deepseek-v4-flash for better performance.`,
	},
	"deepseek-reasoner": {
		maxTokens: 8192, // 8K max output
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: true,
		preserveReasoning: true,
		inputPrice: 0.28, // $0.28 per million tokens (cache miss) - Updated Dec 9, 2025
		outputPrice: 0.42, // $0.42 per million tokens - Updated Dec 9, 2025
		cacheWritesPrice: 0.28, // $0.28 per million tokens (cache miss) - Updated Dec 9, 2025
		cacheReadsPrice: 0.028, // $0.028 per million tokens (cache hit) - Updated Dec 9, 2025
		description: `DeepSeek-V3.2 (Thinking Mode) - Legacy model. Use deepseek-v4-pro for better performance.`,
	},
	"deepseek-v4-flash": {
		maxTokens: 384_000, // 384K max output
		contextWindow: 1_000_000, // 1M context window
		supportsImages: false,
		supportsPromptCache: true,
		preserveReasoning: true, // Also supports thinking mode
		supportsReasoningEffort: ["disable", "high", "max"],
		reasoningEffort: "high",
		inputPrice: 0.14, // $0.14 per million tokens (cache miss, ¥1/M)
		outputPrice: 0.28, // $0.28 per million tokens (¥2/M)
		cacheWritesPrice: 0.14, // $0.14 per million tokens (cache miss, ¥1/M)
		cacheReadsPrice: 0.03, // $0.03 per million tokens (cache hit, ¥0.2/M)
		description: `DeepSeek-V4-Flash - Fast and efficient model with 1M context window and 384K max output. Supports thinking mode for better reasoning. Best for general tasks. Supports JSON output, tool calls, and prompt caching.`,
	},
	"deepseek-v4-pro": {
		maxTokens: 384_000, // 384K max output
		contextWindow: 1_000_000, // 1M context window
		supportsImages: false,
		supportsPromptCache: true,
		preserveReasoning: true, // Enables interleaved thinking mode for tool calls
		supportsReasoningEffort: ["disable", "high", "max"],
		reasoningEffort: "high",
		inputPrice: 1.68, // $1.68 per million tokens (cache miss, ¥12/M)
		outputPrice: 3.36, // $3.36 per million tokens (¥24/M)
		cacheWritesPrice: 1.68, // $1.68 per million tokens (cache miss, ¥12/M)
		cacheReadsPrice: 0.14, // $0.14 per million tokens (cache hit, ¥1/M)
		description: `DeepSeek-V4-Pro (Thinking Mode) - Advanced reasoning model with Chain of Thought capabilities. 1M context window, 384K max output. Supports reasoning_effort parameter (high/max) for deeper thinking. Ideal for complex reasoning, math, and code tasks.`,
	},
} as const satisfies Record<string, ModelInfo>

// https://api-docs.deepseek.com/quick_start/parameter_settings
export const DEEP_SEEK_DEFAULT_TEMPERATURE = 0.3