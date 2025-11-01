import * as vscode from "vscode"

// Use 2147483647 (2^31 - 1) as the maximum timeout value for setTimeout
// JavaScript's setTimeout has a maximum delay limit of 2147483647ms (32-bit signed integer max)
// Values larger than this may be clamped to 1ms or cause unexpected behavior
// 2147483647 is the safe maximum value that won't cause issues
const MAX_TIMEOUT_MS = 2147483647

const DEFAULT_TIMEOUT_MS = 600 * 1000

/**
 * Gets the API request timeout from VSCode configuration with validation.
 *
 * @returns The timeout in milliseconds. Returns 2147483647 (max value for 32-bit signed integer) for no timeout (when config is 0).
 */
export function getApiRequestTimeout(): number {
	// Get timeout with validation to ensure it's a valid non-negative number
	const configTimeout = vscode.workspace.getConfiguration("roo-cline").get<number>("apiRequestTimeout", 600)

	// Validate that it's actually a number and not NaN
	if (typeof configTimeout !== "number" || isNaN(configTimeout)) {
		return DEFAULT_TIMEOUT_MS
	}

	// Allow 0 (no timeout) but clamp negative values to 0
	const timeoutSeconds = configTimeout < 0 ? 0 : configTimeout

	// Convert to milliseconds
	const timeoutMs = timeoutSeconds * 1000

	// Handle the special case where 0 means "no timeout"
	if (timeoutMs === 0) {
		return MAX_TIMEOUT_MS
	}

	return timeoutMs
}
