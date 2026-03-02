/**
 * GLM Model Detection Utility
 *
 * Detects GLM models from Zhipu AI when used via LM Studio or OpenAI-compatible endpoints.
 * This allows applying the same optimizations that the Z.ai provider uses:
 * - Temperature: 0.6 (ZAI_DEFAULT_TEMPERATURE)
 * - mergeToolResultText: true (prevents conversation flow disruption)
 * - parallel_tool_calls: false (GLM models may not support this)
 * - Thinking mode support for GLM-4.7+ models
 */

import { ZAI_DEFAULT_TEMPERATURE } from "@roo-code/types"

/**
 * GLM model variant types
 */
export type GlmVariant = "base" | "air" | "airx" | "x" | "flash" | "flashx" | "v" | "v-flash" | "v-flashx"

/**
 * GLM version types
 */
export type GlmVersion = "4.5" | "4.6" | "4.7" | "unknown"

/**
 * Result of GLM model detection
 */
export interface GlmModelConfig {
	/** Whether the model was detected as a GLM model */
	isGlm: boolean
	/** The detected version (4.5, 4.6, 4.7) */
	version: GlmVersion
	/** The detected variant (base, air, flash, v, etc.) */
	variant: GlmVariant
	/** Human-readable display name */
	displayName: string
	/** Whether the model supports vision (images) */
	supportsVision: boolean
	/** Whether the model supports thinking mode */
	supportsThinking: boolean
	/** The temperature to use (ZAI_DEFAULT_TEMPERATURE for GLM models) */
	temperature: number
	/** Whether to merge tool result text */
	mergeToolResultText: boolean
	/** Whether to disable parallel tool calls */
	disableParallelToolCalls: boolean
}

/**
 * Default config for non-GLM models
 */
const NON_GLM_CONFIG: GlmModelConfig = {
	isGlm: false,
	version: "unknown",
	variant: "base",
	displayName: "",
	supportsVision: false,
	supportsThinking: false,
	temperature: 0,
	mergeToolResultText: false,
	disableParallelToolCalls: false,
}

/**
 * Detects if a model ID represents a GLM model and returns its configuration.
 *
 * Supports various model ID formats:
 * - Official Z.ai format: "glm-4.5", "glm-4.7-flash"
 * - LM Studio/HuggingFace format: "mlx-community/GLM-4.5-4bit"
 * - GGUF file names: "GLM-4.5-UD-Q8_K_XL-00001-of-00008.gguf"
 * - Case insensitive matching
 *
 * @param modelId - The model ID to check
 * @returns GlmModelConfig with detection results and settings
 */
export function detectGlmModel(modelId: string | undefined): GlmModelConfig {
	if (!modelId) {
		return NON_GLM_CONFIG
	}

	// Normalize to lowercase for matching
	const normalized = modelId.toLowerCase()

	// Check if this is a GLM model
	// Match patterns like: glm-4.5, glm-4.6, glm-4.7, glm4.5, glm45, etc.
	const glmPattern = /glm[-_]?4[._]?([567])/i
	const match = normalized.match(glmPattern)

	if (!match) {
		return NON_GLM_CONFIG
	}

	// Extract version
	const versionDigit = match[1]
	let version: GlmVersion
	switch (versionDigit) {
		case "5":
			version = "4.5"
			break
		case "6":
			version = "4.6"
			break
		case "7":
			version = "4.7"
			break
		default:
			version = "unknown"
	}

	// Extract variant
	const variant = detectVariant(normalized, version)

	// Determine capabilities based on version and variant
	const supportsVision = variant === "v" || variant === "v-flash" || variant === "v-flashx"
	const supportsThinking = version === "4.6" || version === "4.7"

	// Build display name
	const displayName = buildDisplayName(version, variant)

	return {
		isGlm: true,
		version,
		variant,
		displayName,
		supportsVision,
		supportsThinking,
		temperature: ZAI_DEFAULT_TEMPERATURE,
		mergeToolResultText: true,
		disableParallelToolCalls: true,
	}
}

/**
 * Detects the variant from the model ID
 */
function detectVariant(normalizedId: string, version: GlmVersion): GlmVariant {
	// Vision variants with flash
	if (/glm[-_]?4[._]?\d+v[-_]?flashx/i.test(normalizedId)) {
		return "v-flashx"
	}
	if (/glm[-_]?4[._]?\d+v[-_]?flash/i.test(normalizedId)) {
		return "v-flash"
	}

	// Vision variant (e.g., glm-4.6v, glm-4.5v)
	if (/glm[-_]?4[._]?\d+v(?![a-z])/i.test(normalizedId)) {
		return "v"
	}

	// FlashX variant (check before flash)
	if (normalizedId.includes("flashx")) {
		return "flashx"
	}

	// Flash variant
	if (normalizedId.includes("flash")) {
		return "flash"
	}

	// AirX variant (check before air)
	if (normalizedId.includes("airx")) {
		return "airx"
	}

	// Air variant
	if (normalizedId.includes("air")) {
		return "air"
	}

	// X variant (high-performance, check after airx)
	// Match -x or _x but not other words containing x
	if (/[-_]x(?:[-_]|$)/i.test(normalizedId) && !normalizedId.includes("flashx") && !normalizedId.includes("airx")) {
		return "x"
	}

	return "base"
}

/**
 * Builds a human-readable display name
 */
function buildDisplayName(version: GlmVersion, variant: GlmVariant): string {
	let name = `GLM-${version}`

	switch (variant) {
		case "air":
			name += "-Air"
			break
		case "airx":
			name += "-AirX"
			break
		case "x":
			name += "-X"
			break
		case "flash":
			name += "-Flash"
			break
		case "flashx":
			name += "-FlashX"
			break
		case "v":
			name = `GLM-${version}V`
			break
		case "v-flash":
			name = `GLM-${version}V-Flash`
			break
		case "v-flashx":
			name = `GLM-${version}V-FlashX`
			break
		// base variant gets no suffix
	}

	return name
}

/**
 * Logs GLM detection results to the console for debugging
 */
export function logGlmDetection(providerName: string, modelId: string, config: GlmModelConfig): void {
	console.log(`[${providerName}] Using model ID: "${modelId}"`)

	if (config.isGlm) {
		console.log(`[GLM Detection] ✓ GLM model detected: "${modelId}"`)
		console.log(`[GLM Detection]   - Version: ${config.version}`)
		console.log(`[GLM Detection]   - Variant: ${config.variant}`)
		console.log(`[GLM Detection]   - Display name: ${config.displayName}`)
		console.log(`[GLM Detection]   - Supports vision: ${config.supportsVision}`)
		console.log(`[GLM Detection]   - Supports thinking: ${config.supportsThinking}`)
		console.log(`[GLM Detection]   - Temperature: ${config.temperature}`)
		console.log(`[GLM Detection]   - mergeToolResultText: ${config.mergeToolResultText}`)
		console.log(`[GLM Detection]   - disableParallelToolCalls: ${config.disableParallelToolCalls}`)
	} else {
		console.log(`[GLM Detection] ✗ Not a GLM model: "${modelId}"`)
	}
}
