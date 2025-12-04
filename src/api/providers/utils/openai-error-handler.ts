/**
 * General error handler for OpenAI client errors
 * Transforms technical errors into user-friendly messages
 */

import { APIError } from "openai"
import i18n from "../../../i18n/setup"

/**
 * Extracts detailed error information from various error structures
 * @param error - The error object to extract details from
 * @returns A detailed error message string
 */
function extractDetailedErrorMessage(error: unknown): string {
	// Handle OpenAI SDK APIError instances
	if (error instanceof APIError) {
		const parts: string[] = []

		// Add status code if available
		if (error.status) {
			parts.push(`${error.status}`)
		}

		// Extract the most detailed error message available
		let detailedMessage = ""

		// Check for nested error structure (common in OpenAI responses)
		const errorObj = error as any
		if (errorObj.error?.error?.message) {
			detailedMessage = errorObj.error.error.message
		} else if (errorObj.error?.message) {
			detailedMessage = errorObj.error.message
		} else if (errorObj.message) {
			detailedMessage = errorObj.message
		}

		// Add error type/code if available
		if (errorObj.error?.error?.type) {
			parts.push(`"${errorObj.error.error.type}"`)
		} else if (errorObj.error?.type) {
			parts.push(`"${errorObj.error.type}"`)
		} else if (errorObj.code) {
			parts.push(`"${errorObj.code}"`)
		}

		// Add the detailed message
		if (detailedMessage) {
			parts.push(detailedMessage)
		}

		return parts.join(" ")
	}

	// Handle regular Error instances
	if (error instanceof Error) {
		// Try to extract more details from error properties
		const errorObj = error as any

		// Check for response data in axios-like errors
		if (errorObj.response?.data?.error?.message) {
			return errorObj.response.data.error.message
		} else if (errorObj.response?.data?.message) {
			return errorObj.response.data.message
		}

		return error.message || ""
	}

	// Handle plain objects with error information
	if (typeof error === "object" && error !== null) {
		const errorObj = error as any

		// Try various common error message locations
		if (errorObj.error?.message) {
			return errorObj.error.message
		} else if (errorObj.message) {
			return errorObj.message
		} else if (errorObj.detail) {
			return errorObj.detail
		}
	}

	return String(error)
}

/**
 * Handles OpenAI client errors and transforms them into user-friendly messages
 * @param error - The error to handle
 * @param providerName - The name of the provider for context in error messages
 * @returns The original error or a transformed user-friendly error
 */
export function handleOpenAIError(error: unknown, providerName: string): Error {
	// Extract detailed error message
	const detailedMessage = extractDetailedErrorMessage(error)

	// Log the original error details for debugging
	console.error(`[${providerName}] API error:`, {
		message: detailedMessage,
		error:
			error instanceof Error
				? {
						name: error.name,
						stack: error.stack,
					}
				: error,
	})

	// Invalid character/ByteString conversion error in API key
	if (detailedMessage.includes("Cannot convert argument to a ByteString")) {
		return new Error(i18n.t("common:errors.api.invalidKeyInvalidChars"))
	}

	// Return error with detailed message
	return new Error(`${providerName} completion error: ${detailedMessage}`)
}
