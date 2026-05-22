import type { ModelInfo } from "../model.js"

// https://platform.deepseek.com/docs/api
// preserveReasoning enables interleaved thinking mode for tool calls:
// DeepSeek requires reasoning_content to be passed back during tool call
// continuation within the same turn. See: https://api-docs.deepseek.com/guides/thinking_mode
export type DeepSeekModelId = keyof typeof deepSeekModels

export const deepSeekDefaultModelId: DeepSeekModelId = "deepseek-chat"

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
		description: `DeepSeek-V3.2 (Non-thinking Mode) achieves a significant breakthrough in inference speed over previous models. It tops the leaderboard among open-source models and rivals the most advanced closed-source models globally. Supports JSON output, tool calls, chat prefix completion (beta), and FIM completion (beta).`,
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
		description: `DeepSeek-V3.2 (Thinking Mode) achieves performance comparable to OpenAI-o1 across math, code, and reasoning tasks. Supports Chain of Thought reasoning with up to 8K output tokens. Supports JSON output, tool calls, and chat prefix completion (beta).`,
	},
	"deepseek-v4-pro": {
		maxTokens: 384_000, // 384K max output
		contextWindow: 1_000_000, // 1M context
		supportsImages: true,
		supportsPromptCache: true,
		preserveReasoning: true,
		inputPrice: 2.0, // $2.00 per million tokens (cache miss)
		outputPrice: 8.0, // $8.00 per million tokens
		cacheWritesPrice: 2.0, // $2.00 per million tokens (cache miss)
		cacheReadsPrice: 0.5, // $0.50 per million tokens (cache hit)
		description: `DeepSeek-V4-Pro is the flagship reasoning model with 1M context window and 384K max output. Features enhanced thinking mode, vision support, tool calls, and JSON output. Best suited for complex reasoning, code generation, and multi-step tasks.`,
	},
	"deepseek-v4-flash": {
		maxTokens: 384_000, // 384K max output
		contextWindow: 1_000_000, // 1M context
		supportsImages: true,
		supportsPromptCache: true,
		preserveReasoning: true,
		inputPrice: 1.0, // $1.00 per million tokens (cache miss)
		outputPrice: 4.0, // $4.00 per million tokens
		cacheWritesPrice: 1.0, // $1.00 per million tokens (cache miss)
		cacheReadsPrice: 0.25, // $0.25 per million tokens (cache hit)
		description: `DeepSeek-V4-Flash is a fast, cost-efficient reasoning model with 1M context window and 384K max output. Features thinking mode, vision support, tool calls, and JSON output. Optimized for speed while maintaining strong reasoning capabilities.`,
	},
} as const satisfies Record<string, ModelInfo>

// https://api-docs.deepseek.com/quick_start/parameter_settings
export const DEEP_SEEK_DEFAULT_TEMPERATURE = 0.3
