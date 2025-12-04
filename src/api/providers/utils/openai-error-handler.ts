/**
 * General error handler for OpenAI client errors
 * Transforms technical errors into user-friendly messages
 */

import i18n from "../../../i18n/setup"

/**
 * Analyzes error patterns to provide context-aware error messages
 * @param error - The error to analyze
 * @returns A user-friendly error message with actionable guidance
 */
function getContextAwareErrorMessage(error: unknown): string | null {
	if (!(error instanceof Error)) {
		return null
	}

	const msg = error.message || ""
	const errorCode = (error as any).code || ""

	// DNS resolution failures - typically VPN-related for internal endpoints
	if (errorCode === "ENOTFOUND" || msg.includes("ENOTFOUND") || msg.includes("getaddrinfo ENOTFOUND")) {
		return "Cannot resolve hostname. If this is an internal service, please connect to your corporate VPN."
	}

	// Connection refused - service is reachable but not accepting connections
	if (errorCode === "ECONNREFUSED" || msg.includes("ECONNREFUSED") || msg.includes("connect ECONNREFUSED")) {
		return "Service refused connection. The API endpoint is reachable but not accepting connections. Please verify the service is running."
	}

	// Connection timeout - often indicates VPN or network stability issues
	if (errorCode === "ETIMEDOUT" || msg.includes("ETIMEDOUT") || msg.includes("connect ETIMEDOUT")) {
		return "Request timed out. If using an internal service, verify your VPN connection is stable."
	}

	// Network unreachable
	if (errorCode === "ENETUNREACH" || msg.includes("ENETUNREACH")) {
		return "Network unreachable. Please check your network connection and VPN status if accessing internal services."
	}

	// Socket hang up - connection was terminated unexpectedly
	if (errorCode === "ECONNRESET" || msg.includes("ECONNRESET") || msg.includes("socket hang up")) {
		return "Connection was reset. This may indicate network instability or VPN disconnection."
	}

	// Certificate errors - often occur with internal/corporate endpoints
	if (msg.includes("CERT_") || msg.includes("certificate") || msg.includes("self signed")) {
		return "SSL/TLS certificate error. This often occurs with internal services. Please verify your VPN connection and certificate configuration."
	}

	// Fetch failed - generic network error
	if (msg.includes("fetch failed") || msg.includes("Failed to fetch")) {
		return "Network request failed. Please check your internet connection and VPN status if accessing internal services."
	}

	return null
}

/**
 * Handles OpenAI client errors and transforms them into user-friendly messages
 * @param error - The error to handle
 * @param providerName - The name of the provider for context in error messages
 * @returns The original error or a transformed user-friendly error
 */
export function handleOpenAIError(error: unknown, providerName: string): Error {
	if (error instanceof Error) {
		const msg = error.message || ""

		// Log the original error details for debugging
		console.error(`[${providerName}] API error:`, {
			message: msg,
			name: error.name,
			code: (error as any).code,
			stack: error.stack,
		})

		// Invalid character/ByteString conversion error in API key
		if (msg.includes("Cannot convert argument to a ByteString")) {
			return new Error(i18n.t("common:errors.api.invalidKeyInvalidChars"))
		}

		// Check for context-aware error messages
		const contextAwareMessage = getContextAwareErrorMessage(error)
		if (contextAwareMessage) {
			return new Error(`${providerName}: ${contextAwareMessage}`)
		}

		// For other Error instances, wrap with provider-specific prefix
		return new Error(`${providerName} completion error: ${msg}`)
	}

	// Non-Error: wrap with provider-specific prefix
	console.error(`[${providerName}] Non-Error exception:`, error)
	return new Error(`${providerName} completion error: ${String(error)}`)
}
