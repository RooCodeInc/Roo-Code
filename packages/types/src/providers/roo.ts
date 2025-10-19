import type { ModelInfo } from "../model.js"

/**
 * Roo Code Cloud is a dynamic provider - models are loaded from the /v1/models API endpoint.
 * Default model ID used as fallback when no model is specified.
 */
export const rooDefaultModelId = "xai/grok-code-fast-1"

/**
 * Empty models object maintained for type compatibility.
 * All model data comes dynamically from the API.
 */
export const rooModels = {} as const satisfies Record<string, ModelInfo>
