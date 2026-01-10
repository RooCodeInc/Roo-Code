/**
 * Normalizes an OpenAI-compatible base URL to ensure consistent URL construction.
 *
 * This function handles various user-provided base URL formats:
 * - With /v1 suffix: "https://api.openai.com/v1" → "https://api.openai.com"
 * - Without /v1 suffix: "https://api.openai.com" → "https://api.openai.com"
 * - With trailing slash: "https://api.openai.com/" → "https://api.openai.com"
 * - With /v1/ suffix: "https://api.openai.com/v1/" → "https://api.openai.com"
 *
 * The normalized URL can then safely have "/v1/..." appended to it.
 *
 * @param baseUrl - The user-provided base URL (may or may not include /v1)
 * @param defaultUrl - The default URL to use if baseUrl is empty
 * @returns The normalized base URL without trailing /v1 or trailing slash
 */
export function normalizeOpenAiBaseUrl(baseUrl: string | undefined, defaultUrl: string): string {
	// Use default if no custom URL provided
	if (!baseUrl || baseUrl.trim() === "") {
		return normalizeUrl(defaultUrl)
	}

	return normalizeUrl(baseUrl)
}

/**
 * Internal helper to normalize a URL by removing trailing /v1 and trailing slashes.
 */
function normalizeUrl(url: string): string {
	let normalized = url.trim()

	// Remove trailing slashes first
	while (normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1)
	}

	// Remove /v1 suffix if present (case-insensitive for robustness)
	if (normalized.toLowerCase().endsWith("/v1")) {
		normalized = normalized.slice(0, -3)
	}

	// Remove any trailing slashes that might be left after removing /v1
	while (normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1)
	}

	return normalized
}
