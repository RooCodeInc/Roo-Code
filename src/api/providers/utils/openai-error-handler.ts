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
		const anyErr = error as any
		const msg = anyErr?.error?.metadata?.raw || error.message || ""

		// Log the original error details for debugging
		console.error(`[${providerName}] API error:`, {
			message: msg,
			name: error.name,
			stack: error.stack,
			status: anyErr.status,
		})

		let wrapped: Error

		// Invalid character/ByteString conversion error in API key
		if (msg.includes("Cannot convert argument to a ByteString")) {
			wrapped = new Error(i18n.t("common:errors.api.invalidKeyInvalidChars"))
		} else {
			// For other Error instances, wrap with provider-specific prefix
			wrapped = new Error(`${providerName} completion error: ${msg}`)
		}

		// Preserve HTTP status and structured details for retry/backoff + UI
		// These fields are used by Task.backoffAndAnnounce() and ChatRow/ErrorRow
		// to provide status-aware error messages and handling
		if (anyErr.status !== undefined) {
			;(wrapped as any).status = anyErr.status
		}
		if (anyErr.errorDetails !== undefined) {
			;(wrapped as any).errorDetails = anyErr.errorDetails
		}
		if (anyErr.code !== undefined) {
			;(wrapped as any).code = anyErr.code
		}

		return wrapped
	}

	// Non-Error: wrap with provider-specific prefix
	console.error(`[${providerName}] Non-Error exception:`, error)
	const wrapped = new Error(`${providerName} completion error: ${String(error)}`)

	// Also try to preserve status for non-Error exceptions (e.g., plain objects with status)
	const anyErr = error as any
	if (typeof anyErr?.status === "number") {
		;(wrapped as any).status = anyErr.status
	}

	return wrapped
}
