/**
 * Utility functions for detecting GLM (General Language Model) models.
 *
 * GLM models from Z.ai/THUDM may require special handling:
 * - mergeToolResultText: true - prevents conversation flow disruption
 * - parallel_tool_calls: false - some GLM models do not support this parameter
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

	return {
		mergeToolResultText: true,
		disableParallelToolCalls: true,
	}
}
