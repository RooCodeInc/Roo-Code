/**
 * GLM Model Detection Utility
 *
 * Detects GLM models from Z.ai (Zhipu AI) and returns appropriate configuration
 * for optimal interaction. This utility supports various model ID formats from
 * different providers like LM Studio and OpenAI-compatible endpoints.
 *
 * GLM Model Family:
 * - GLM-4.5: Base model with 355B parameters
 * - GLM-4.5-Air: Lightweight version balancing performance and cost
 * - GLM-4.5-X: High-performance variant with ultra-fast responses
 * - GLM-4.5-AirX: Lightweight ultra-fast variant
 * - GLM-4.5-Flash: Free high-speed model
 * - GLM-4.5V: Multimodal visual model
 * - GLM-4.6: Extended 200k context window
 * - GLM-4.6V: Multimodal vision model
 * - GLM-4.6V-Flash: Free high-speed vision model
 * - GLM-4.7: Built-in thinking capabilities
 * - GLM-4.7-Flash: Free high-speed variant of GLM-4.7
 * - GLM-4.7-FlashX: Ultra-fast variant
 */

/**
 * GLM model version enumeration
 */
export type GlmVersion = "4.5" | "4.6" | "4.7" | "unknown"

/**
 * GLM model variant - specific model within a version
 */
export type GlmVariant =
	| "base"
	| "air"
	| "x"
	| "airx"
	| "flash"
	| "flashx"
	| "v" // vision
	| "v-flash"
	| "v-flashx"

/**
 * Configuration options for GLM models
 */
export interface GlmModelConfig {
	/** Whether this is a GLM model */
	isGlmModel: boolean
	/** The detected GLM version (4.5, 4.6, 4.7) */
	version: GlmVersion
	/** The detected variant (base, air, flash, v, etc.) */
	variant: GlmVariant | "unknown"
	/** Whether this model supports vision/images */
	supportsVision: boolean
	/** Whether this model has built-in thinking/reasoning support */
	supportsThinking: boolean
	/** Whether to merge tool result text into tool messages */
	mergeToolResultText: boolean
	/** Whether to disable parallel tool calls */
	disableParallelToolCalls: boolean
	/** The original model ID */
	originalModelId: string
	/** A normalized/canonical model name for display */
	displayName: string
}

/**
 * Detects if a model ID represents a GLM model and returns its configuration.
 *
 * Supports various model ID formats:
 * - Standard: "glm-4.5", "glm-4.7-flash"
 * - With prefix: "mlx-community/GLM-4.5-4bit"
 * - GGUF files: "GLM-4.5-UD-Q8_K_XL-00001-of-00008.gguf"
 * - ChatGLM: "chatglm-6b", "chatglm3-6b"
 *
 * @param modelId The model identifier string
 * @returns GLM model configuration
 */
export function detectGlmModel(modelId: string): GlmModelConfig {
	const lowerModelId = modelId.toLowerCase()

	// Check if this is a GLM model using case-insensitive matching
	// Match patterns: "glm-", "glm4", "chatglm", or "glm" followed by a version number
	const isGlm = /glm[-_]?4|chatglm|\/glm[-_]|^glm[-_]/i.test(modelId)

	if (!isGlm) {
		return {
			isGlmModel: false,
			version: "unknown",
			variant: "unknown",
			supportsVision: false,
			supportsThinking: false,
			mergeToolResultText: false,
			disableParallelToolCalls: false,
			originalModelId: modelId,
			displayName: modelId,
		}
	}

	// Detect version (4.5, 4.6, 4.7)
	let version: GlmVersion = "unknown"
	if (/4\.7|4-7|47/i.test(lowerModelId)) {
		version = "4.7"
	} else if (/4\.6|4-6|46/i.test(lowerModelId)) {
		version = "4.6"
	} else if (/4\.5|4-5|45|4p5/i.test(lowerModelId)) {
		version = "4.5"
	}

	// Detect variant
	let variant: GlmVariant = "base"
	let supportsVision = false

	// Check for vision variants first (they may also have flash/etc.)
	if (/4\.5v|4-5v|45v|4p5v|glm-4\.5v/i.test(lowerModelId)) {
		variant = "v"
		supportsVision = true
	} else if (/4\.6v[-_]?flashx|4-6v[-_]?flashx/i.test(lowerModelId)) {
		variant = "v-flashx"
		supportsVision = true
	} else if (/4\.6v[-_]?flash|4-6v[-_]?flash/i.test(lowerModelId)) {
		variant = "v-flash"
		supportsVision = true
	} else if (/4\.6v|4-6v|46v/i.test(lowerModelId)) {
		variant = "v"
		supportsVision = true
	}
	// Non-vision variants
	else if (/flashx/i.test(lowerModelId)) {
		variant = "flashx"
	} else if (/flash/i.test(lowerModelId)) {
		variant = "flash"
	} else if (/airx/i.test(lowerModelId)) {
		variant = "airx"
	} else if (/air/i.test(lowerModelId)) {
		variant = "air"
	} else if (/[-_]x\b/i.test(lowerModelId)) {
		// Match "-x" or "_x" at word boundary (to avoid matching "flashx", "airx")
		variant = "x"
	}

	// GLM-4.7 has built-in thinking support
	const supportsThinking = version === "4.7"

	// Generate display name
	let displayName = `GLM-${version !== "unknown" ? version : "4.x"}`
	if (variant !== "base") {
		const variantName = variant.toUpperCase().replace("-", " ")
		displayName += ` ${variantName}`
	}

	return {
		isGlmModel: true,
		version,
		variant,
		supportsVision,
		supportsThinking,
		// All GLM models benefit from mergeToolResultText to prevent reasoning_content loss
		mergeToolResultText: true,
		// Disable parallel tool calls for GLM models as they may not support it properly
		disableParallelToolCalls: true,
		originalModelId: modelId,
		displayName,
	}
}

/**
 * Logs GLM model detection results to the console for debugging.
 *
 * @param providerName The name of the provider (e.g., "LM Studio", "OpenAI-compatible")
 * @param modelId The model ID being used
 * @param config The detected GLM configuration
 */
export function logGlmDetection(providerName: string, modelId: string, config: GlmModelConfig): void {
	console.log(`[${providerName}] Using model ID: "${modelId}"`)

	if (config.isGlmModel) {
		console.log(`[GLM Detection] ✓ GLM model detected: "${modelId}"`)
		console.log(`[GLM Detection]   - Version: ${config.version}`)
		console.log(`[GLM Detection]   - Variant: ${config.variant}`)
		console.log(`[GLM Detection]   - Display name: ${config.displayName}`)
		console.log(`[GLM Detection]   - Supports vision: ${config.supportsVision}`)
		console.log(`[GLM Detection]   - Supports thinking: ${config.supportsThinking}`)
		console.log(`[GLM Detection]   - mergeToolResultText: ${config.mergeToolResultText}`)
		console.log(`[GLM Detection]   - disableParallelToolCalls: ${config.disableParallelToolCalls}`)
	} else {
		console.log(`[GLM Detection] ✗ Not a GLM model: "${modelId}"`)
	}
}

/**
 * Simple check if a model ID is a GLM model without full configuration.
 * Use this for quick checks where you only need a boolean.
 *
 * @param modelId The model identifier string
 * @returns true if the model is a GLM model
 */
export function isGlmModel(modelId: string): boolean {
	return /glm[-_]?4|chatglm|\/glm[-_]|^glm[-_]/i.test(modelId)
}
