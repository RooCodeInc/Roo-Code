import type { ModelInfo } from "@roo-code/types"

/**
 * Model family default configuration.
 * Each entry defines a pattern to match against model IDs and default ModelInfo properties
 * to apply when the pattern matches.
 */
interface ModelFamilyConfig {
	/**
	 * Regular expression pattern to match against model IDs.
	 * More specific patterns should come first in the registry.
	 */
	pattern: RegExp

	/**
	 * Description of this model family for documentation purposes.
	 */
	description: string

	/**
	 * Default ModelInfo properties to apply when this pattern matches.
	 * These will only be applied if the corresponding property is not already set.
	 */
	defaults: Partial<ModelInfo>
}

/**
 * Registry of model family configurations.
 *
 * IMPORTANT: Order matters! Patterns are matched first-match-wins,
 * so more specific patterns should come before more general ones.
 *
 * For example, "gemini-3" should come before "gemini" to ensure
 * Gemini 3 models get their specific defaults before falling back
 * to general Gemini defaults.
 */
export const MODEL_FAMILY_REGISTRY: ModelFamilyConfig[] = [
	// Gemini 3 models (most specific - must come before general gemini)
	{
		pattern: /gemini-3|gemini\/gemini-3/i,
		description: "Google Gemini 3 models with enhanced tool support and temperature defaults",
		defaults: {
			defaultTemperature: 1,
			includedTools: ["write_file", "edit_file"],
			excludedTools: ["apply_diff"],
		},
	},

	// All Gemini models (general fallback for non-Gemini-3)
	{
		pattern: /gemini|google\/gemini/i,
		description: "Google Gemini models with file-based tool preferences",
		defaults: {
			includedTools: ["write_file", "edit_file"],
			excludedTools: ["apply_diff"],
		},
	},

	// OpenAI GPT models (includes models with "gpt" or "openai" in the ID)
	{
		pattern: /gpt|openai\/|^o[134]-|^o[134]$/i,
		description: "OpenAI GPT and O-series models with apply_patch preference",
		defaults: {
			includedTools: ["apply_patch"],
			excludedTools: ["apply_diff", "write_to_file"],
		},
	},
]

/**
 * Apply model family defaults to a ModelInfo object.
 *
 * This function matches the model ID against patterns in the MODEL_FAMILY_REGISTRY
 * and applies the first matching family's defaults. Defaults are only applied for
 * properties that are not already explicitly set on the input ModelInfo.
 *
 * @param modelId - The model identifier (e.g., "openai/gpt-4", "google/gemini-2.5-pro")
 * @param info - The original ModelInfo object
 * @returns A new ModelInfo object with family defaults applied (if any match)
 *
 * @example
 * ```typescript
 * // Model accessed through OpenRouter
 * const info = applyModelFamilyDefaults("openai/gpt-4o", { maxTokens: 16384, contextWindow: 128000 })
 * // Result: { maxTokens: 16384, contextWindow: 128000, includedTools: ["apply_patch"], excludedTools: ["apply_diff", "write_to_file"] }
 *
 * // Model with explicitly set tools (not overridden)
 * const info2 = applyModelFamilyDefaults("openai/gpt-4o", { includedTools: ["custom_tool"], contextWindow: 128000 })
 * // Result: { includedTools: ["custom_tool"], contextWindow: 128000, excludedTools: ["apply_diff", "write_to_file"] }
 * ```
 */
export function applyModelFamilyDefaults(modelId: string, info: ModelInfo): ModelInfo {
	// Find the first matching family configuration
	const matchingFamily = MODEL_FAMILY_REGISTRY.find((family) => family.pattern.test(modelId))

	// If no match found, return the original info unchanged
	if (!matchingFamily) {
		return info
	}

	// Apply defaults only for properties that are not already set
	const result = { ...info }
	const defaults = matchingFamily.defaults

	// Apply defaultTemperature if not already set
	if (defaults.defaultTemperature !== undefined && result.defaultTemperature === undefined) {
		result.defaultTemperature = defaults.defaultTemperature
	}

	// Apply includedTools if not already set
	// Note: We check for undefined specifically, as an empty array is a valid explicit value
	if (defaults.includedTools !== undefined && result.includedTools === undefined) {
		result.includedTools = [...defaults.includedTools]
	}

	// Apply excludedTools if not already set
	if (defaults.excludedTools !== undefined && result.excludedTools === undefined) {
		result.excludedTools = [...defaults.excludedTools]
	}

	return result
}
