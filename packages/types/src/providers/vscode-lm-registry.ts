import type { ModelInfo } from "../model.js"

/**
 * Registry of known model context windows and capabilities for VS Code LM API models.
 * This registry provides accurate context window information when the LM API reports
 * incorrect or limited values (e.g., GitHub Copilot may report 128K for Claude Opus 4.5
 * when it actually supports 200K).
 *
 * The registry uses fuzzy matching to handle various model ID formats:
 * - claude-opus-4-5-20251101
 * - anthropic/claude-opus-4.5
 * - claude-opus-4.5
 * - copilot-claude-opus-4-5
 */

interface ModelRegistryEntry {
	/** Patterns to match against model IDs (case-insensitive) */
	patterns: string[]
	/** Actual model information with correct context windows */
	info: Partial<ModelInfo>
}

/**
 * Registry of known models with their actual context windows and capabilities.
 * Organized by vendor for maintainability.
 */
export const VSCODE_LM_MODEL_REGISTRY: ModelRegistryEntry[] = [
	// Anthropic Claude Models
	{
		patterns: ["claude-sonnet-4-5", "claude-3-5-sonnet-v2", "claude-3.5-sonnet", "claude-sonnet-3-5"],
		info: {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},
	{
		patterns: ["claude-opus-4-5", "claude-4-5-opus", "opus-4-5", "claude-opus-4.5"],
		info: {
			contextWindow: 200_000,
			maxTokens: 32_000,
			supportsImages: true,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		},
	},
	{
		patterns: ["claude-opus-4-1", "claude-4-1-opus", "opus-4-1", "claude-opus-4.1"],
		info: {
			contextWindow: 200_000,
			maxTokens: 32_000,
			supportsImages: true,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		},
	},
	{
		patterns: ["claude-sonnet-4", "claude-4-sonnet"],
		info: {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},
	{
		patterns: ["claude-haiku-4-5", "claude-4-5-haiku", "haiku-4-5", "claude-haiku-4.5"],
		info: {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: false,
			supportsPromptCache: true,
			supportsReasoningBudget: true,
		},
	},
	{
		patterns: ["claude-haiku-4", "claude-4-haiku"],
		info: {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: false,
			supportsPromptCache: true,
		},
	},
	{
		patterns: ["claude-3-opus", "claude-opus-3"],
		info: {
			contextWindow: 200_000,
			maxTokens: 4_096,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},
	{
		patterns: ["claude-3-7-sonnet", "claude-sonnet-3-7"],
		info: {
			contextWindow: 200_000,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},

	// OpenAI GPT Models
	{
		patterns: ["gpt-4o", "gpt-4-omni"],
		info: {
			contextWindow: 128_000,
			maxTokens: 16_384,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},
	{
		patterns: ["gpt-4o-mini"],
		info: {
			contextWindow: 128_000,
			maxTokens: 16_384,
			supportsImages: true,
			supportsPromptCache: false,
		},
	},
	{
		patterns: ["gpt-4-turbo"],
		info: {
			contextWindow: 128_000,
			maxTokens: 4_096,
			supportsImages: true,
			supportsPromptCache: false,
		},
	},
	{
		patterns: ["gpt-4"],
		info: {
			contextWindow: 128_000,
			maxTokens: 8_192,
			supportsImages: false,
			supportsPromptCache: false,
		},
	},
	{
		patterns: ["gpt-3.5-turbo", "gpt-35-turbo"],
		info: {
			contextWindow: 16_385,
			maxTokens: 4_096,
			supportsImages: false,
			supportsPromptCache: false,
		},
	},
	{
		patterns: ["o1-preview", "o1"],
		info: {
			contextWindow: 128_000,
			maxTokens: 32_768,
			supportsImages: true,
			supportsPromptCache: false,
		},
	},
	{
		patterns: ["o1-mini"],
		info: {
			contextWindow: 128_000,
			maxTokens: 65_536,
			supportsImages: false,
			supportsPromptCache: false,
		},
	},
	{
		patterns: ["o3-mini"],
		info: {
			contextWindow: 200_000,
			maxTokens: 100_000,
			supportsImages: false,
			supportsPromptCache: false,
		},
	},
	{
		patterns: ["gpt-5"],
		info: {
			contextWindow: 200_000,
			maxTokens: 128_000,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},

	// Google Gemini Models
	{
		patterns: ["gemini-3-pro", "gemini-3-pro-preview", "gemini-3.0-pro", "gemini-pro-3", "gemini-3-0-pro"],
		info: {
			contextWindow: 1_048_576,
			maxTokens: 65_536,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},
	{
		patterns: ["gemini-2.5-pro", "gemini-2-5-pro", "gemini-pro-2-5"],
		info: {
			contextWindow: 1_048_576,
			maxTokens: 65_536,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},
	{
		patterns: ["gemini-2.0-flash", "gemini-2-0-flash"],
		info: {
			contextWindow: 1_048_576,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: false,
		},
	},
	{
		patterns: ["gemini-1.5-pro", "gemini-pro"],
		info: {
			contextWindow: 2_097_152,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},
	{
		patterns: ["gemini-1.5-flash", "gemini-flash"],
		info: {
			contextWindow: 1_048_576,
			maxTokens: 8_192,
			supportsImages: true,
			supportsPromptCache: true,
		},
	},
]

/**
 * Attempts to find a matching model in the registry based on the model ID.
 * Uses fuzzy matching to handle various naming conventions.
 *
 * @param modelId - The model ID to match (e.g., "copilot-claude-opus-4-5")
 * @returns The matching model info if found, or null
 */
export function findModelInRegistry(modelId: string): Partial<ModelInfo> | null {
	if (!modelId) return null

	const normalizedId = modelId
		.toLowerCase()
		.replace(/[@_]/g, "-") // Normalize separators
		.replace(/\s+/g, "-") // Replace spaces with hyphens

	for (const entry of VSCODE_LM_MODEL_REGISTRY) {
		for (const pattern of entry.patterns) {
			const normalizedPattern = pattern.toLowerCase()

			// Check if the model ID contains the pattern
			if (normalizedId.indexOf(normalizedPattern) !== -1) {
				console.debug(`Roo Code <VS Code LM Registry>: Matched model '${modelId}' to pattern '${pattern}'`)
				return entry.info
			}
		}
	}

	console.debug(`Roo Code <VS Code LM Registry>: No match found for model '${modelId}'`)
	return null
}

/**
 * Merges model information from the VS Code LM API with the registry.
 * Registry values take precedence for context window and capabilities,
 * while API values are used as fallbacks.
 *
 * @param modelId - The model ID
 * @param apiMaxInputTokens - The maxInputTokens reported by the VS Code LM API
 * @param fallbackContextWindow - The fallback context window if no match found
 * @returns Complete ModelInfo with merged values
 */
export function mergeModelInfoWithRegistry(
	modelId: string,
	apiMaxInputTokens: number | undefined,
	fallbackContextWindow: number,
): Partial<ModelInfo> {
	const registryInfo = findModelInRegistry(modelId)

	if (registryInfo) {
		// Use registry values, but keep API maxInputTokens if registry doesn't specify contextWindow
		const contextWindow = registryInfo.contextWindow ?? apiMaxInputTokens ?? fallbackContextWindow

		console.debug(
			`Roo Code <VS Code LM Registry>: Using registry info for '${modelId}'. ` +
				`Context: ${contextWindow} (Registry: ${registryInfo.contextWindow}, API: ${apiMaxInputTokens})`,
		)

		return {
			contextWindow,
			maxTokens: registryInfo.maxTokens,
			supportsImages: registryInfo.supportsImages,
			supportsPromptCache: registryInfo.supportsPromptCache,
			supportsReasoningBudget: registryInfo.supportsReasoningBudget,
		}
	}

	// No registry match - use API values or fallback
	const contextWindow = typeof apiMaxInputTokens === "number" ? Math.max(0, apiMaxInputTokens) : fallbackContextWindow

	console.debug(
		`Roo Code <VS Code LM Registry>: No registry match for '${modelId}'. ` +
			`Using API/fallback context: ${contextWindow}`,
	)

	return {
		contextWindow,
		maxTokens: -1, // Unlimited by default
		supportsImages: false,
		supportsPromptCache: true,
	}
}
