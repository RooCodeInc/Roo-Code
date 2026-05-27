/**
 * Utility functions for detecting GLM (General Language Model) models.
 *
 * GLM models from Z.ai/THUDM may require special handling:
 * - mergeToolResultText: true - prevents conversation flow disruption
 * - parallel_tool_calls: false - some GLM models do not support this parameter
 * - For GLM-4.7+: thinking mode support with reasoning effort
 */

/**
 * Pattern to detect GLM models in model IDs.
 *
 * This regex matches "glm" anywhere in the model ID (case-insensitive),
 * including common variations like:
 * - "glm-4.5" (standard Z.ai format)
 * - "glm4" (without hyphen)
 * - "chatglm" (ChatGLM variants)
 * - "mlx-community/GLM-4.5-4bit" (MLX format with prefix)
 * - "GLM-4.5-UD-Q8_K_XL-00001-of-00008.gguf" (GGUF format)
 * - "THUDM/glm-4-9b-chat" (HuggingFace format)
 */
const GLM_MODEL_PATTERN = /glm/i

/**
 * Pattern to detect GLM-4.7 or higher versions.
 * Matches variations like: glm-4.7, GLM-4.7, glm_4.7, GLM-4.8, glm-5.0, etc.
 * Does NOT match: chatglm-6b, glm47 (without dot separator)
 */
const GLM_4_7_PLUS_PATTERN = /glm[-_]4\.([7-9]|\d{2,})|glm[-_][5-9]\./i

/**
 * Detects if a model ID represents a GLM (General Language Model) model.
 *
 * @param modelId - The model ID to check (e.g., "glm-4.5", "mlx-community/GLM-4.5-4bit")
 * @returns true if the model ID indicates a GLM model, false otherwise
 *
 * @example
 * ```typescript
 * isGlmModel("glm-4.5") // true
 * isGlmModel("mlx-community/GLM-4.5-4bit") // true
 * isGlmModel("GLM-4.5-UD-Q8_K_XL.gguf") // true
 * isGlmModel("chatglm-6b") // true
 * isGlmModel("gpt-4") // false
 * isGlmModel("llama-3.1") // false
 * ```
 */
export function isGlmModel(modelId: string | undefined): boolean {
	if (!modelId) {
		return false
	}
	return GLM_MODEL_PATTERN.test(modelId)
}

/**
 * Detects if a model ID represents GLM-4.7 or higher version.
 *
 * @param modelId - The model ID to check
 * @returns true if the model is GLM-4.7 or higher
 *
 * @example
 * ```typescript
 * isGlm47Plus("glm-4.7") // true
 * isGlm47Plus("GLM-4.7-flash") // true
 * isGlm47Plus("mlx-community/GLM-4.7-4bit") // true
 * isGlm47Plus("glm-4.8") // true
 * isGlm47Plus("glm-5.0") // true
 * isGlm47Plus("glm-4.6") // false
 * isGlm47Plus("glm-4.5") // false
 * ```
 */
export function isGlm47Plus(modelId: string | undefined): boolean {
	if (!modelId) {
		return false
	}
	return GLM_4_7_PLUS_PATTERN.test(modelId)
}

/**
 * Configuration options for GLM models when used via LM Studio
 * or OpenAI-compatible endpoints.
 */
export interface GlmModelOptions {
	/**
	 * If true, merge text content after tool_results into the last tool message
	 * instead of creating a separate user message. This prevents GLM models from
	 * losing context or reasoning_content after tool results.
	 */
	mergeToolResultText: boolean

	/**
	 * If true, disable parallel_tool_calls parameter for GLM models
	 * since they may not support it.
	 */
	disableParallelToolCalls: boolean

	/**
	 * If true, the model supports thinking mode (GLM-4.7+).
	 * This enables the `thinking` parameter to be sent in API requests.
	 */
	supportsThinking: boolean
}

/**
 * Returns the recommended configuration options for a GLM model.
 *
 * @param modelId - The model ID to check
 * @returns GlmModelOptions if GLM model detected, undefined otherwise
 */
export function getGlmModelOptions(modelId: string | undefined): GlmModelOptions | undefined {
	if (!isGlmModel(modelId)) {
		return undefined
	}

	// Check if this is GLM-4.7 or higher (supports thinking mode)
	const supportsThinking = isGlm47Plus(modelId)

	return {
		mergeToolResultText: true,
		disableParallelToolCalls: true,
		supportsThinking,
	}
}
