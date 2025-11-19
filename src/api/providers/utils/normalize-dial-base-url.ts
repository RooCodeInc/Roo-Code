import { dialDefaultBaseUrl } from "@roo-code/types"

/**
 * Normalizes EPAM DIAL base URLs so we can safely append Azure-style paths.
 * Users often copy URLs like https://host/openai/v1 from the docs, but the Azure
 * SDK expects the resource root. This helper strips any trailing /openai and
 * /openai/v1 segments (case insensitive) and collapses trailing slashes.
 */
export function normalizeDialBaseUrl(baseUrl?: string): string {
	const trimmed = (baseUrl ?? dialDefaultBaseUrl).trim()
	if (!trimmed) {
		return dialDefaultBaseUrl
	}

	// Remove trailing slashes first so suffix checks become easier.
	let normalized = trimmed.replace(/\/+$/, "")

	// Strip trailing "/openai" or "/openai/v1" (case insensitive)
	const suffixPattern = /\/openai(?:\/v1)?$/i
	while (suffixPattern.test(normalized)) {
		normalized = normalized.replace(suffixPattern, "")
		normalized = normalized.replace(/\/+$/, "")
	}

	return normalized || dialDefaultBaseUrl
}
