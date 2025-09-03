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
		// Invalid character/ByteString conversion error in API key
		if (error.message.includes("Cannot convert argument to a ByteString")) {
			return new Error(i18n.t("common:errors.api.invalidKeyInvalidChars"))
		}

		// Add more error message transformations here as needed

		// Return original error if no transformation matches
		return error
	}

	// If it's not even an Error object, wrap it
	return new Error(`${providerName} error: ${String(error)}`)
}

/**
 * Wraps an OpenAI client instantiation with error handling
 * @param createClient - Function that creates the OpenAI client
 * @param providerName - The name of the provider for error messages
 * @returns The created client
 * @throws User-friendly error if client creation fails
 */
export function createOpenAIClientWithErrorHandling<T>(createClient: () => T, providerName: string): T {
	try {
		return createClient()
	} catch (error) {
		throw handleOpenAIError(error, providerName)
	}
}
