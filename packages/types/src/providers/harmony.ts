import type { ModelInfo } from "../model.js"

/**
 * Harmony-compatible API provider types and models
 *
 * Harmony is an open response format specification for GPT-OSS models
 * that enables structured output with separate reasoning and answer channels.
 *
 * @see https://developers.openai.com/cookbook/articles/openai-harmony
 * @see https://github.com/openai/harmony
 */

/**
 * Supported Harmony model identifiers
 *
 * - gpt-oss-20b: 20B parameter open-weight model, optimal for speed
 * - gpt-oss-120b: 120B parameter open-weight model, optimal for quality
 *
 * Both models support:
 * - 128,000 token context window
 * - Reasoning effort levels (low, medium, high)
 * - Streaming responses
 * - Function calling
 */
export type HarmonyModelId = "gpt-oss-20b" | "gpt-oss-120b"

/**
 * Default Harmony model
 * @default "gpt-oss-20b" - Balanced model for general use
 */
export const harmonyDefaultModelId: HarmonyModelId = "gpt-oss-20b"

/**
 * Harmony model definitions and capabilities
 *
 * All Harmony models support:
 * - 128,000 token context window for comprehensive codebase analysis
 * - Reasoning effort levels: low, medium, high
 * - Streaming responses for real-time feedback
 * - Function calling for tool integration
 * - OpenAI-compatible API interface
 */
export const harmonyModels: Record<HarmonyModelId, ModelInfo> = {
	"gpt-oss-20b": {
		maxTokens: 8192,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningEffort: ["low", "medium", "high"],
		inputPrice: 0,
		outputPrice: 0,
		description:
			"GPT-OSS 20B: 20 billion parameter open-weight model. Optimized for fast inference with 128K context window.",
	},
	"gpt-oss-120b": {
		maxTokens: 8192,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningEffort: ["low", "medium", "high"],
		inputPrice: 0,
		outputPrice: 0,
		description:
			"GPT-OSS 120B: 120 billion parameter open-weight model. Higher quality reasoning with 128K context window.",
	},
}
