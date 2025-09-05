import type { ModelInfo } from "../model.js"

export type CometAPIModelId = string

export const cometApiDefaultModelId: CometAPIModelId = "claude-sonnet-4-20250514"

export const cometApiDefaultModelInfo: ModelInfo = {
	maxTokens: undefined, // Let system determine based on contextWindow
	contextWindow: 200000, // Reasonable default for modern models
	supportsImages: false,
	supportsPromptCache: false,
	// Intentionally not setting inputPrice/outputPrice
}

// Fallback models for when API is unavailable
// Small helper to create a map of id -> default info
const createModelMap = (ids: readonly CometAPIModelId[]): Record<CometAPIModelId, ModelInfo> =>
	Object.fromEntries(ids.map((id) => [id, { ...cometApiDefaultModelInfo }])) as Record<CometAPIModelId, ModelInfo>

// Single, complete list for readability and easy maintenance
const COMET_FALLBACK_MODEL_IDS = [
	// OpenAI series
	"gpt-5-chat-latest",
	"gpt-5-mini",
	"gpt-5-nano",
	"gpt-4.1-mini",
	"gpt-4o-mini",

	// Claude series
	"claude-opus-4-1-20250805",
	"claude-sonnet-4-20250514",
	"claude-3-7-sonnet-latest",
	"claude-3-5-haiku-latest",

	// Gemini series
	"gemini-2.5-pro",
	"gemini-2.5-flash",
	"gemini-2.0-flash",

	// DeepSeek series
	"deepseek-v3.1",
	"deepseek-r1-0528",
	"deepseek-reasoner",

	// Other models
	"grok-4-0709",
	"qwen3-30b-a3b",
	"qwen3-coder-plus-2025-07-22",
] as const satisfies readonly CometAPIModelId[]

export const cometApiModels: Record<CometAPIModelId, ModelInfo> = createModelMap(COMET_FALLBACK_MODEL_IDS)
