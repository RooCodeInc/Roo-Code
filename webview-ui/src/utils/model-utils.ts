import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "@siid-code/types"

/**
 * Result of token distribution calculation
 */
export interface TokenDistributionResult {
	/**
	 * Percentage of context window used by current tokens (0-100)
	 */
	currentPercent: number

	/**
	 * Percentage of the effective input window used by current tokens.
	 * Effective input window = contextWindow - reservedForOutput.
	 * This matches backend auto-condense threshold logic.
	 */
	effectivePercent: number

	/**
	 * Percentage of context window reserved for model output (0-100)
	 */
	reservedPercent: number

	/**
	 * Percentage of context window still available (0-100)
	 */
	availablePercent: number

	/**
	 * Number of tokens reserved for model output
	 */
	reservedForOutput: number

	/**
	 * Number of tokens still available in the context window
	 */
	availableSize: number
}

/**
 * Calculates distribution of tokens within the context window
 * This is used for visualizing the token distribution in the UI
 *
 * @param contextWindow The total size of the context window
 * @param contextTokens The number of tokens currently used
 * @param maxTokens Optional override for tokens reserved for model output (otherwise uses 8192)
 * @returns Distribution of tokens with percentages and raw numbers
 */
export const calculateTokenDistribution = (
	contextWindow: number,
	contextTokens: number,
	maxTokens?: number,
): TokenDistributionResult => {
	// Handle potential invalid inputs with positive fallbacks
	const safeContextWindow = Math.max(0, contextWindow)
	const safeContextTokens = Math.max(0, contextTokens)

	// Get the actual max tokens value from the model
	// If maxTokens is valid (positive and not equal to context window), use it, otherwise reserve 8192 tokens as a default
	const reservedForOutput =
		maxTokens && maxTokens > 0 && maxTokens !== safeContextWindow ? maxTokens : ANTHROPIC_DEFAULT_MAX_TOKENS

	// Calculate sizes directly without buffer display
	const availableSize = Math.max(0, safeContextWindow - safeContextTokens - reservedForOutput)
	const effectiveInputWindow = safeContextWindow - reservedForOutput

	// Safeguard against division by zero or invalid context window
	if (safeContextWindow <= 0) {
		return {
			currentPercent: 0,
			effectivePercent: 0,
			reservedPercent: 0,
			availablePercent: 0,
			reservedForOutput,
			availableSize,
		}
	}

	// Calculate percentages based on the context window
	// This shows the actual percentage of the context window being used
	const currentPercent = (safeContextTokens / safeContextWindow) * 100
	const effectivePercent =
		effectiveInputWindow > 0 ? (safeContextTokens / effectiveInputWindow) * 100 : safeContextTokens > 0 ? 100 : 0
	const reservedPercent = (reservedForOutput / safeContextWindow) * 100
	const availablePercent = (availableSize / safeContextWindow) * 100

	return {
		currentPercent,
		effectivePercent,
		reservedPercent,
		availablePercent,
		reservedForOutput,
		availableSize,
	}
}
