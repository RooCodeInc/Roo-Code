export const PRODUCTION_CLERK_BASE_URL = "https://clerk.roocode.com"
export const PRODUCTION_ROO_CODE_API_URL = "https://app.roocode.com"

/**
 * Sanitizes a URL by removing any proxy prefixes that may have been incorrectly added
 * by proxy tools like NekoBox in TUN mode.
 *
 * @param url - The URL to sanitize
 * @param fallback - The fallback URL to use if sanitization fails
 * @returns The sanitized URL
 */
function sanitizeUrl(url: string | undefined, fallback: string): string {
	if (!url) {
		return fallback
	}

	try {
		// First, try to parse as a valid URL
		const parsedUrl = new URL(url)

		// Check if it's already a valid RooCode URL
		if (
			parsedUrl.hostname.endsWith(".roocode.com") ||
			parsedUrl.hostname === "clerk.roocode.com" ||
			parsedUrl.hostname === "app.roocode.com" ||
			parsedUrl.hostname === "api.roocode.com"
		) {
			return url // URL is already valid
		}

		// If it parses successfully and looks reasonable (not a RooCode domain), use it
		if (parsedUrl.protocol && parsedUrl.hostname) {
			return url
		}
	} catch (_error) {
		// URL parsing failed, try to fix corrupted URL
	}

	// Check if the URL contains known RooCode domains (for corrupted URLs)
	const rooCodePatterns = [
		{ pattern: /(dev\.|staging\.|test\.)?clerk\.roocode\.com/, domain: "clerk.roocode.com" },
		{ pattern: /(dev\.|staging\.|test\.)?app\.roocode\.com/, domain: "app.roocode.com" },
		{ pattern: /(dev\.|staging\.|test\.)?api\.roocode\.com/, domain: "api.roocode.com" },
	]

	for (const { pattern } of rooCodePatterns) {
		const match = url.match(pattern)
		if (match) {
			// Extract the full matched domain (including subdomain if present)
			const fullDomain = match[0]
			const domainIndex = url.indexOf(fullDomain)

			if (domainIndex !== -1) {
				// The URL is corrupted, reconstruct it
				const protocol = url.includes(":443") || fallback.startsWith("https://") ? "https://" : "http://"

				// Check for path, query, and fragment after the domain
				const afterDomain = url.substring(domainIndex + fullDomain.length)

				// Match optional port, then path/query/fragment
				const afterMatch = afterDomain.match(/^(?::\d+)?(.*)$/)
				const pathQueryFragment = afterMatch?.[1] || ""

				return protocol + fullDomain + pathQueryFragment
			}
		}
	}

	return fallback
}

export const getClerkBaseUrl = () => sanitizeUrl(process.env.CLERK_BASE_URL, PRODUCTION_CLERK_BASE_URL)

export const getRooCodeApiUrl = () => sanitizeUrl(process.env.ROO_CODE_API_URL, PRODUCTION_ROO_CODE_API_URL)
