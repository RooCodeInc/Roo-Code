/**
 * General error handler for OpenAI client errors
 * Transforms technical errors into user-friendly messages
 */

import i18n from "../../../i18n/setup"
import { isWSL } from "../../../utils/wsl-detection"

/**
 * Handles OpenAI client errors and transforms them into user-friendly messages
 * @param error - The error to handle
 * @param providerName - The name of the provider for context in error messages
 * @returns The original error or a transformed user-friendly error
 */
export function handleOpenAIError(error: unknown, providerName: string): Error {
	if (error instanceof Error) {
		const msg = (error as any)?.error?.metadata?.raw || error.message || ""

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

		// WSL2-specific connection error guidance
		if (
			isWSL() &&
			(msg.includes("Connection error") ||
				msg.includes("ECONNREFUSED") ||
				msg.includes("ETIMEDOUT") ||
				msg.includes("certificate") ||
				msg.includes("SSL") ||
				msg.includes("TLS"))
		) {
			const wslGuidance = `\n\nWSL2 Environment Detected: This connection issue may be related to WSL2's network or certificate configuration. Try these steps:\n1. Ensure your WSL2 instance has internet connectivity: ping -c 3 8.8.8.8\n2. Check if the API endpoint is accessible: curl -v ${getApiEndpointFromError(msg)}\n3. Update WSL2 certificates: sudo apt-get update && sudo apt-get install ca-certificates\n4. If using a VPN, try disconnecting temporarily\n5. Check Windows firewall settings for WSL2\n\nFor more info: https://github.com/microsoft/WSL/issues/8022`
			return new Error(`${providerName} completion error: ${msg}${wslGuidance}`)
		}

		// For other Error instances, wrap with provider-specific prefix
		return new Error(`${providerName} completion error: ${msg}`)
	}

	// Non-Error: wrap with provider-specific prefix
	console.error(`[${providerName}] Non-Error exception:`, error)
	return new Error(`${providerName} completion error: ${String(error)}`)
}

/**
 * Extracts API endpoint from error message for troubleshooting
 */
function getApiEndpointFromError(msg: string): string {
	// Try to extract URL from common error message patterns
	const urlMatch = msg.match(/https?:\/\/[^\s]+/)
	return urlMatch ? urlMatch[0] : "the API endpoint"
}
