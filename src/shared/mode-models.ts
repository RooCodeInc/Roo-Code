/**
 * Mode-to-Models mapping
 * Defines which models are available for each mode
 */

export interface ModeModelInfo {
	modelId: string
	displayName: string
	provider?: "openrouter" | "anthropic" | "openai" | "other"
	tier?: "free" | "basic" | "medium" | "advanced"
	priority?: number // Lower number = higher priority (1 = primary, 2 = fallback1, 3 = fallback2, etc.)
}

/**
 * Maps mode slugs to available models
 * Models are listed in priority order (first one is default)
 */
export const MODE_TO_MODELS: Record<string, ModeModelInfo[]> = {
	"salesforce-agent": [
		{
			modelId: "z-ai/glm-4.5-air:free",
			displayName: "GLM 4.5 Air (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 1, // Primary
		},
		{
			modelId: "qwen/qwen3-coder:free",
			displayName: "Qwen3 Coder (Free, Recommended)",
			provider: "openrouter",
			tier: "free",
			priority: 2, // Fallback 1
		},
		{
			modelId: "deepseek/deepseek-r1-0528:free",
			displayName: "DeepSeek R1 (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 3, // Fallback 2
		},
		{
			modelId: "openai/gpt-oss-120b:free",
			displayName: "OpenAI: gpt-oss-120b (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 4, // Fallback 3
		},
		{
			modelId: "openai/gpt-oss-20b:free",
			displayName: "OpenAI: gpt-oss-20b (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 5, // Fallback 4
		},
		{
			modelId: "openai/gpt-5-mini",
			displayName: "GPT-5 Mini",
			provider: "openrouter",
			tier: "medium",
			priority: 6, // Premium option
		},
		{
			modelId: "moonshotai/kimi-k2.5",
			displayName: "Kimi K2.5",
			provider: "openrouter",
			tier: "medium",
			priority: 7, // Premium option
		},
		{
			modelId: "qwen/qwen3-32b:nitro",
			displayName: "Qwen3 32B (nitro)",
			provider: "openrouter",
			tier: "medium",
			priority: 8, // Premium option
		},
		{
			modelId: "meta-llama/llama-3.3-70b-instruct:nitro",
			displayName: "Llama 3.3 70B Instruct (nitro)",
			provider: "openrouter",
			tier: "medium",
			priority: 9, // Premium option
		},
		{
			modelId: "deepseek/deepseek-v3.2",
			displayName: "DeepSeek V3.2",
			provider: "openrouter",
			tier: "medium",
			priority: 10, // Premium option
		},
		{
			modelId: "openai/gpt-5",
			displayName: "GPT-5",
			provider: "openrouter",
			tier: "advanced",
			priority: 11, // Premium option
		},
	],
	code: [
		{
			modelId: "z-ai/glm-4.5-air:free",
			displayName: "GLM 4.5 Air (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 1, // Primary
		},
		{
			modelId: "qwen/qwen3-coder:free",
			displayName: "Qwen3 Coder (Free, Recommended)",
			provider: "openrouter",
			tier: "free",
			priority: 2, // Fallback 1
		},
		{
			modelId: "deepseek/deepseek-r1-0528:free",
			displayName: "DeepSeek R1 (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 3, // Fallback 2
		},
		{
			modelId: "openai/gpt-oss-120b:free",
			displayName: "OpenAI: gpt-oss-120b (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 4, // Fallback 3
		},
		{
			modelId: "openai/gpt-oss-20b:free",
			displayName: "OpenAI: gpt-oss-20b (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 5, // Fallback 4
		},
		{
			modelId: "openai/gpt-5-mini",
			displayName: "GPT-5 Mini",
			provider: "openrouter",
			tier: "medium",
			priority: 6, // Premium option
		},
		{
			modelId: "moonshotai/kimi-k2.5",
			displayName: "Kimi K2.5",
			provider: "openrouter",
			tier: "medium",
			priority: 7, // Premium option
		},
		{
			modelId: "qwen/qwen3-32b:nitro",
			displayName: "Qwen3 32B (nitro)",
			provider: "openrouter",
			tier: "medium",
			priority: 8, // Premium option
		},
		{
			modelId: "meta-llama/llama-3.3-70b-instruct:nitro",
			displayName: "Llama 3.3 70B Instruct (nitro)",
			provider: "openrouter",
			tier: "medium",
			priority: 9, // Premium option
		},
		{
			modelId: "deepseek/deepseek-v3.2",
			displayName: "DeepSeek V3.2",
			provider: "openrouter",
			tier: "medium",
			priority: 10, // Premium option
		},
		{
			modelId: "openai/gpt-5",
			displayName: "GPT-5",
			provider: "openrouter",
			tier: "advanced",
			priority: 11, // Premium option
		},
	],
	orchestrator: [
		{
			modelId: "z-ai/glm-4.5-air:free",
			displayName: "GLM 4.5 Air (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 1, // Primary
		},
		{
			modelId: "qwen/qwen3-coder:free",
			displayName: "Qwen3 Coder (Free, Recommended)",
			provider: "openrouter",
			tier: "free",
			priority: 2, // Fallback 1
		},
		{
			modelId: "deepseek/deepseek-r1-0528:free",
			displayName: "DeepSeek R1 (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 3, // Fallback 2
		},
		{
			modelId: "openai/gpt-oss-120b:free",
			displayName: "OpenAI: gpt-oss-120b (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 4, // Fallback 3
		},
		{
			modelId: "openai/gpt-oss-20b:free",
			displayName: "OpenAI: gpt-oss-20b (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 5, // Fallback 4
		},
		{
			modelId: "openai/gpt-5-mini",
			displayName: "GPT-5 Mini",
			provider: "openrouter",
			tier: "medium",
			priority: 6, // Premium option
		},
		{
			modelId: "moonshotai/kimi-k2.5",
			displayName: "Kimi K2.5",
			provider: "openrouter",
			tier: "medium",
			priority: 7, // Premium option
		},
		{
			modelId: "qwen/qwen3-32b:nitro",
			displayName: "Qwen3 32B (nitro)",
			provider: "openrouter",
			tier: "medium",
			priority: 8, // Premium option
		},
		{
			modelId: "meta-llama/llama-3.3-70b-instruct:nitro",
			displayName: "Llama 3.3 70B Instruct (nitro)",
			provider: "openrouter",
			tier: "medium",
			priority: 9, // Premium option
		},
		{
			modelId: "deepseek/deepseek-v3.2",
			displayName: "DeepSeek V3.2",
			provider: "openrouter",
			tier: "medium",
			priority: 10, // Premium option
		},
		{
			modelId: "openai/gpt-5",
			displayName: "GPT-5",
			provider: "openrouter",
			tier: "advanced",
			priority: 11, // Premium option
		},
	],
}

/**
 * Get available models for a mode
 * Returns empty array if mode not found
 */
export function getModelsForMode(modeSlug: string): ModeModelInfo[] {
	return MODE_TO_MODELS[modeSlug] || []
}

/**
 * Get the default (first) model for a mode
 * Returns undefined if mode not found or no models available
 */
export function getDefaultModelForMode(modeSlug: string): ModeModelInfo | undefined {
	const models = getModelsForMode(modeSlug)
	return models[0]
}

/**
 * Check if a model is available for a mode
 */
export function isModelAvailableForMode(modeSlug: string, modelId: string): boolean {
	const models = getModelsForMode(modeSlug)
	return models.some((m) => m.modelId === modelId)
}
