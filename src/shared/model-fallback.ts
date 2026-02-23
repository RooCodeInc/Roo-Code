/**
 * Model Fallback Logic for 429 Rate Limit Errors
 *
 * This module handles automatic model switching when a 429 error occurs.
 * It uses the MODE_TO_MODELS mapping to determine fallback chains based on
 * the current mode, prioritizing free models.
 *
 * Fallback Strategy:
 * - Uses free tier models from the current mode's model list
 * - Cycles through them in order when rate limited
 * - Automatically switches back to primary after 3 minutes
 *
 * Time-based Auto-Recovery:
 * - Each model has a 3-minute timeout
 * - After 3 minutes, automatically switch back to primary model
 * - New chats/tasks always start with primary model
 */

import type { ProviderSettings } from "@siid-code/types"
import { MODE_TO_MODELS, type ModeModelInfo } from "./mode-models"

// 3 minutes in milliseconds
const MODEL_TIMEOUT_MS = 3 * 60 * 1000

/**
 * Get fallback chain for a mode (only free models, sorted by priority)
 * @param mode - The mode slug (e.g., "salesforce-agent", "code", "orchestrator")
 * @returns Array of model IDs in fallback order
 */
function getFallbackChainForMode(mode: string): string[] {
	const modeModels = MODE_TO_MODELS[mode] || []
	// Filter to only free tier models and sort by priority
	const freeModels = modeModels
		.filter((m) => m.tier === "free")
		.sort((a, b) => (a.priority || 999) - (b.priority || 999)) // Lower priority number = higher priority
	return freeModels.map((m) => m.modelId)
}

/**
 * Tracks the current model index for each mode
 * Allows us to switch between models in the fallback chain
 */
const modelIndexTracker: Record<string, number> = {}

/**
 * Tracks when each model was activated (timestamp in ms)
 * Used to auto-reset to primary after timeout
 */
const modelActivationTimeTracker: Record<string, number> = {}

/**
 * Tracks consecutive 429 errors per mode
 */
const errorCountTracker: Record<string, number> = {}

/**
 * Checks if an error is a 429 rate limit error
 */
export function is429Error(error: any): boolean {
	// Direct status code checks
	if (error?.status === 429) return true
	if (error?.code === 429) return true

	// Check nested error properties
	if (error?.error?.code === 429) return true
	if (error?.error?.status === 429) return true

	// Check OpenRouter error response format
	if (error?.error?.metadata?.raw) {
		const raw = error.error.metadata.raw
		if (typeof raw === "string" && raw.includes('"code":429')) return true
		if (typeof raw === "string" && raw.includes('code":429')) return true
		if (typeof raw === "string" && raw.includes("429")) {
			// More strict: check if it's actually rate limit
			return raw.includes("rate") || raw.includes("limit") || raw.includes("temporarily")
		}
	}

	// Check message for explicit 429 mentions with rate limit context
	if (error?.message) {
		const msg = error.message.toLowerCase()
		if (msg.includes("429") && (msg.includes("rate") || msg.includes("limit") || msg.includes("throttle"))) {
			return true
		}
	}

	// Check raw error response
	if (error?.rawError) {
		const raw = JSON.stringify(error.rawError)
		if (raw.includes("429") && (raw.includes("rate") || raw.includes("limit"))) return true
	}

	return false
}

/**
 * Gets the fallback model for a given mode or advances through the chain
 * Returns the model to switch to, whether it's a fallback, and a UI message
 * @param mode - The mode slug (e.g., "salesforce-agent", "code")
 * @param currentModel - The model that just failed
 */
export function getNextModelOnError(
	mode: string,
	currentModel: string,
): {
	model: string | null
	isFallback: boolean
	message: string
} {
	const chain = getFallbackChainForMode(mode)
	if (!chain || chain.length === 0) return { model: null, isFallback: false, message: "" }

	const primaryModel = chain[0]

	// Find current position in chain
	const currentIndex = chain.indexOf(currentModel)

	// If current model is not in the free fallback chain (e.g. paid model),
	// do not perform automatic fallback switching.
	if (currentIndex === -1) {
		return { model: null, isFallback: false, message: "" }
	}

	// If on primary, switch to first fallback
	if (currentIndex === 0) {
		if (chain.length > 1) {
			modelIndexTracker[mode] = 1
			modelActivationTimeTracker[mode] = Date.now()
			errorCountTracker[mode] = 1
			const nextModel = chain[1]
			return {
				model: nextModel,
				isFallback: true,
				message: `⚠️ Switching to fallback model: ${nextModel}`,
			}
		}
		return { model: null, isFallback: false, message: "" }
	}

	// If on a fallback, advance to next fallback if available
	if (currentIndex > 0 && currentIndex < chain.length - 1) {
		const nextIndex = currentIndex + 1
		modelIndexTracker[mode] = nextIndex
		modelActivationTimeTracker[mode] = Date.now()
		errorCountTracker[mode] = (errorCountTracker[mode] ?? 0) + 1
		const nextModel = chain[nextIndex]
		return {
			model: nextModel,
			isFallback: true,
			message: `⚠️ Switching to next fallback model: ${nextModel}`,
		}
	}

	// If on last fallback, cycle back to primary
	if (currentIndex === chain.length - 1) {
		modelIndexTracker[mode] = 0
		modelActivationTimeTracker[mode] = Date.now()
		errorCountTracker[mode] = 1
		return {
			model: primaryModel,
			isFallback: false,
			message: `✅ Switching back to primary model: ${primaryModel}`,
		}
	}

	return { model: null, isFallback: false, message: "" }
}

/**
 * Checks if a model has exceeded its timeout duration
 * Returns true if the model should be reset to primary
 */
export function isModelTimeoutExpired(mode: string): boolean {
	const activationTime = modelActivationTimeTracker[mode]
	if (!activationTime) return false

	const elapsed = Date.now() - activationTime
	return elapsed >= MODEL_TIMEOUT_MS
}

/**
 * Gets time remaining for current model (in seconds)
 * Useful for UI display
 */
export function getModelTimeRemaining(mode: string): number {
	const activationTime = modelActivationTimeTracker[mode]
	if (!activationTime) return 0

	const elapsed = Date.now() - activationTime
	const remaining = MODEL_TIMEOUT_MS - elapsed

	return Math.max(0, Math.ceil(remaining / 1000)) // Return seconds
}

/**
 * Resets model to primary when timeout expires (NOT on success)
 * Only called when 3-minute timeout is exceeded
 */
export function resetModelToDefault(mode: string): { reset: boolean; message: string } {
	const chain = getFallbackChainForMode(mode)
	const currentIndex = modelIndexTracker[mode] ?? 0
	const primaryModel = chain?.[0]

	// If we're not on primary, reset and return message
	if (currentIndex !== 0 && primaryModel) {
		modelIndexTracker[mode] = 0
		errorCountTracker[mode] = 0
		modelActivationTimeTracker[mode] = 0

		return {
			reset: true,
			message: `✅ Switching back to primary model: ${primaryModel}`,
		}
	}

	// Already on primary
	modelIndexTracker[mode] = 0
	errorCountTracker[mode] = 0
	modelActivationTimeTracker[mode] = 0

	return { reset: false, message: "" }
}

/**
 * Handles timeout-based reset to primary model
 * Called periodically or when timeout is detected
 */
export function resetOnTimeout(mode: string): { timedOut: boolean; message: string; model: string | null } {
	if (!isModelTimeoutExpired(mode)) {
		return { timedOut: false, message: "", model: null }
	}

	const chain = getFallbackChainForMode(mode)
	const primaryModel = chain?.[0]

	if (primaryModel) {
		modelIndexTracker[mode] = 0
		errorCountTracker[mode] = 0
		modelActivationTimeTracker[mode] = 0

		return {
			timedOut: true,
			message: `⏱️ 3-minute timeout reached. Switching back to primary model: ${primaryModel}`,
			model: primaryModel,
		}
	}

	return { timedOut: false, message: "", model: null }
}

/**
 * Gets the primary model for a mode
 */
export function getPrimaryModel(mode: string): string | null {
	const chain = getFallbackChainForMode(mode)
	if (!chain || chain.length === 0) return null
	return chain[0] // Primary is always at index 0
}

/**
 * Gets the current active model for a mode
 */
export function getCurrentActiveModel(mode: string, config: ProviderSettings): string | null {
	const chain = getFallbackChainForMode(mode)
	if (!chain) return null

	const currentIndex = modelIndexTracker[mode] ?? 0
	return chain[currentIndex]
}

/**
 * Checks whether fallback switching is eligible for the current model.
 * Automatic fallback is allowed only for models that are part of the free fallback chain.
 */
export function isFallbackEligible(mode: string, currentModel: string): boolean {
	const chain = getFallbackChainForMode(mode)
	return chain.includes(currentModel)
}

/**
 * Checks whether the mode is currently on an active fallback model.
 * Used to ensure timeout reset only applies to actual fallback sessions.
 */
export function isFallbackActiveForModel(mode: string, currentModel: string): boolean {
	const chain = getFallbackChainForMode(mode)
	if (!chain.length) return false

	const currentIndex = modelIndexTracker[mode] ?? 0
	return currentIndex > 0 && chain[currentIndex] === currentModel
}

/**
 * Increments error count and returns true if we should try fallback
 * NOTE: Callers should first verify eligibility via `isFallbackEligible`.
 */
export function shouldSwitchToFallback(mode: string): boolean {
	const currentCount = errorCountTracker[mode] ?? 0
	errorCountTracker[mode] = currentCount + 1

	// Switch to fallback on first 429 error
	return true
}

/**
 * Gets the fallback chain for a mode
 */
export function getFallbackChain(mode: string): string[] {
	return getFallbackChainForMode(mode)
}

/**
 * Clears all tracking data (for testing or reset)
 */
export function clearTracking(): void {
	Object.keys(modelIndexTracker).forEach((key) => delete modelIndexTracker[key])
	Object.keys(errorCountTracker).forEach((key) => delete errorCountTracker[key])
	Object.keys(modelActivationTimeTracker).forEach((key) => delete modelActivationTimeTracker[key])
}

/**
 * Gets debug info about current state
 */
export function getDebugInfo() {
	return {
		modelIndexTracker: { ...modelIndexTracker },
		errorCountTracker: { ...errorCountTracker },
		modelActivationTimeTracker: { ...modelActivationTimeTracker },
		timeoutMs: MODEL_TIMEOUT_MS,
	}
}
