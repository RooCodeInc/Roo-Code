/**
 * Utility functions for detecting model types based on model ID patterns.
 * These functions help providers apply model-specific handling for third-party
 * models running on LM Studio, OpenAI-compatible endpoints, etc.
 */

/**
 * Detects if a model ID represents a GLM (General Language Model) from Zhipu AI.
 *
 * GLM models (like GLM-4, GLM-4.5, GLM-4.7) have specific requirements:
 * - They benefit from `mergeToolResultText: true` to avoid dropping reasoning_content
 * - They may not support `parallel_tool_calls` parameter
 *
 * This detection allows LM Studio and OpenAI-compatible providers to apply
 * the same optimizations that Z.ai uses for GLM models.
 *
 * @param modelId - The model identifier (e.g., "glm-4.5", "GLM4-9B-Chat-GGUF")
 * @returns true if the model is a GLM model, false otherwise
 *
 * @example
 * ```typescript
 * isGlmModel("glm-4.5") // true
 * isGlmModel("GLM4-9B-Chat-GGUF") // true
 * isGlmModel("glm-4.7") // true
 * isGlmModel("gpt-4") // false
 * isGlmModel("claude-3") // false
 * ```
 */
export function isGlmModel(modelId: string): boolean {
	if (!modelId) {
		return false
	}

	// Case-insensitive check for "glm" prefix or pattern
	// Matches: glm-4, glm-4.5, glm-4.7, GLM4-9B-Chat, glm4, etc.
	const lowerModelId = modelId.toLowerCase()

	// Check for common GLM model patterns:
	// - "glm-" prefix (official naming: glm-4, glm-4.5, glm-4.7)
	// - "glm4" (compact naming without dash)
	// - "chatglm" (older ChatGLM models)
	return lowerModelId.startsWith("glm-") || lowerModelId.startsWith("glm4") || lowerModelId.includes("chatglm")
}

/**
 * Configuration options for GLM model-specific handling.
 * These options are derived from Z.ai's optimizations for GLM models.
 */
export interface GlmModelOptions {
	/**
	 * Whether to merge text content after tool_results into the last tool message.
	 * This prevents GLM models from dropping reasoning_content when they see
	 * a user message after tool results.
	 */
	mergeToolResultText: boolean

	/**
	 * Whether to disable parallel_tool_calls for this model.
	 * GLM models may not support this parameter and can behave unexpectedly
	 * when it's enabled.
	 */
	disableParallelToolCalls: boolean
}

/**
 * Returns the recommended configuration options for a GLM model.
 * Non-GLM models will receive default options that maintain existing behavior.
 *
 * @param modelId - The model identifier
 * @returns Configuration options for the model
 */
export function getGlmModelOptions(modelId: string): GlmModelOptions {
	const isGlm = isGlmModel(modelId)

	return {
		mergeToolResultText: isGlm,
		disableParallelToolCalls: isGlm,
	}
}
