/**
 * General error handler for OpenAI client errors
 * Transforms technical errors into user-friendly messages
 */

import i18n from "../../../i18n/setup"

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
			stack: error.stack,
		})

		// Invalid character/ByteString conversion error in API key
		if (msg.includes("Cannot convert argument to a ByteString")) {
			return new Error(i18n.t("common:errors.api.invalidKeyInvalidChars"))
		}

		// Network/DNS resolution errors - likely VPN issue
		if (
			msg.includes("Could not resolve host") ||
			msg.includes("ENOTFOUND") ||
			msg.includes("getaddrinfo") ||
			msg.includes("EAI_AGAIN") ||
			(msg.includes("Connection error") && !msg.includes("refused"))
		) {
			return new Error(
				`${providerName} connection error: Cannot resolve hostname. ` +
					`This usually means you need to connect to your corporate VPN to access internal services. ` +
					`If you're using an internal API endpoint (e.g., *.use.ucdp.net), please verify your VPN connection is active.`,
			)
		}

		// Connection refused - service is reachable but not accepting connections
		if (msg.includes("ECONNREFUSED") || msg.includes("Connection refused")) {
			return new Error(
				`${providerName} connection error: Service refused connection. ` +
					`The API endpoint is reachable but not accepting connections. ` +
					`Please verify the service is running and the port is correct.`,
			)
		}

		// Timeout errors
		if (msg.includes("ETIMEDOUT") || msg.includes("timeout")) {
			return new Error(
				`${providerName} connection error: Request timed out. ` +
					`The API endpoint may be unreachable or experiencing issues. ` +
					`If using an internal service, verify your VPN connection is stable.`,
			)
		}

		// For other Error instances, wrap with provider-specific prefix
		return new Error(`${providerName} completion error: ${msg}`)
	}

	// Non-Error: wrap with provider-specific prefix
	console.error(`[${providerName}] Non-Error exception:`, error)
	return new Error(`${providerName} completion error: ${String(error)}`)
}
