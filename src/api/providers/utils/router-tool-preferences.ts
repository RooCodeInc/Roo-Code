import type { ModelInfo } from "@roo-code/types"

/**
 * Apply tool preferences for models accessed through dynamic routers (OpenRouter, Requesty).
 *
 * Different model families perform better with specific edit tool schemas:
 * - OpenAI models: Better results with the codex (patch) format
 * - Gemini models: Higher quality results with the gemini (search/replace) format
 * - xAI/Grok models: Better results with the grok format
 *
 * This function modifies the model info to apply these preferences consistently
 * across all dynamic router providers via `editToolVariant`.
 *
 * @param modelId The model identifier (e.g., "openai/gpt-4", "google/gemini-2.5-pro")
 * @param info The original model info object
 * @returns A new model info object with tool preferences applied
 */
export function applyRouterToolPreferences(modelId: string, info: ModelInfo): ModelInfo {
	let result = info

	// For OpenAI models via routers, use codex variant and exclude write_to_file
	// This matches the behavior of the native OpenAI provider
	if (modelId.includes("openai")) {
		result = {
			...result,
			editToolVariant: result.editToolVariant ?? "codex",
			excludedTools: [...new Set([...(result.excludedTools || []), "write_to_file"])],
		}
	}

	// For Gemini models via routers, use gemini variant
	// This matches the behavior of the native Gemini provider
	if (modelId.includes("gemini")) {
		result = {
			...result,
			editToolVariant: result.editToolVariant ?? "gemini",
			includedTools: [...new Set([...(result.includedTools || []), "write_file"])],
		}
	}

	// For xAI/Grok models via routers, use grok variant
	// This matches the behavior of the native xAI provider
	if (modelId.includes("grok") || modelId.includes("xai")) {
		result = {
			...result,
			editToolVariant: result.editToolVariant ?? "grok",
		}
	}

	// For Claude/Anthropic models via routers, use anthropic variant
	// This matches the behavior of the native Anthropic provider
	if (modelId.includes("claude") || modelId.includes("anthropic")) {
		result = {
			...result,
			editToolVariant: result.editToolVariant ?? "anthropic",
		}
	}

	return result
}
