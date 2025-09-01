/**
 * Validates that an API key contains only valid ByteString characters (0-255).
 * The OpenAI client library requires API keys to be convertible to ByteString format,
 * which only supports characters with values 0-255.
 *
 * @param apiKey - The API key to validate
 * @param providerName - The name of the provider for error messaging
 * @throws Error if the API key contains invalid characters
 */
export function validateApiKeyForByteString(apiKey: string | undefined, providerName: string): void {
	if (!apiKey) {
		return // No validation needed for undefined/empty keys
	}

	// Check each character in the API key
	for (let i = 0; i < apiKey.length; i++) {
		const charCode = apiKey.charCodeAt(i)
		if (charCode > 255) {
			throw new Error(
				`Invalid ${providerName} API key: contains non-ASCII character at position ${i + 1}. ` +
					`API keys must contain only ASCII characters (character codes 0-255). ` +
					`Please check your API key configuration.`,
			)
		}
	}
}

/**
 * Validates that an API key contains only standard ASCII characters (0-127).
 * This is a stricter validation that only allows standard ASCII characters.
 *
 * @param apiKey - The API key to validate
 * @param providerName - The name of the provider for error messaging
 * @throws Error if the API key contains non-ASCII characters
 */
export function validateApiKeyForAscii(apiKey: string | undefined, providerName: string): void {
	if (!apiKey) {
		return // No validation needed for undefined/empty keys
	}

	// Check each character in the API key
	for (let i = 0; i < apiKey.length; i++) {
		const charCode = apiKey.charCodeAt(i)
		if (charCode > 127) {
			throw new Error(
				`Invalid ${providerName} API key: contains non-ASCII character at position ${i + 1}. ` +
					`API keys must contain only standard ASCII characters (character codes 0-127). ` +
					`Please check your API key configuration.`,
			)
		}
	}
}
