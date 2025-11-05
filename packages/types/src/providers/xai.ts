import type { ModelInfo } from "../model.js"

// https://docs.x.ai/docs/api-reference
export type XAIModelId = keyof typeof xaiModels

export const xaiDefaultModelId: XAIModelId = "grok-4-fast-reasoning"

/**
 * Partial ModelInfo for xAI static registry.
 * Contains only fields not available from the xAI API:
 * - contextWindow: Not provided by API
 * - maxTokens: Not provided by API
 * - description: User-friendly descriptions
 * - supportsReasoningEffort: Special capability flag
 *
 * All other fields (pricing, supportsPromptCache, supportsImages) are fetched dynamically.
 */
type XAIStaticModelInfo = Pick<ModelInfo, "contextWindow" | "description"> & {
	maxTokens?: number | null
	supportsReasoningEffort?: boolean
}

export const xaiModels = {
	"grok-code-fast-1": {
		maxTokens: 16_384,
		contextWindow: 256_000,
		description: "xAI's Grok Code Fast model with 256K context window",
	},
	"grok-4-0709": {
		maxTokens: 16_384,
		contextWindow: 256_000,
		description: "xAI's Grok-4 model with 256K context window",
	},
	"grok-4-fast-non-reasoning": {
		maxTokens: 32_768,
		contextWindow: 2_000_000,
		description: "xAI's Grok-4 Fast Non-Reasoning model with 2M context window",
	},
	"grok-4-fast-reasoning": {
		maxTokens: 32_768,
		contextWindow: 2_000_000,
		description: "xAI's Grok-4 Fast Reasoning model with 2M context window",
	},
	"grok-3": {
		maxTokens: 8192,
		contextWindow: 131_072,
		description: "xAI's Grok-3 model with 128K context window",
	},
	"grok-3-mini": {
		maxTokens: 8192,
		contextWindow: 131_072,
		description: "xAI's Grok-3 mini model with 128K context window",
		supportsReasoningEffort: true,
	},
	"grok-2-1212": {
		maxTokens: 8192,
		contextWindow: 32_768,
		description: "xAI's Grok-2 model (version 1212) with 32K context window",
	},
	"grok-2-vision-1212": {
		maxTokens: 8192,
		contextWindow: 32_768,
		description: "xAI's Grok-2 Vision model (version 1212) with image support and 32K context window",
	},
} as const satisfies Record<string, XAIStaticModelInfo>
