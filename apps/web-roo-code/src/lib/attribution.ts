/**
 * Parse attribution parameters from URL search params
 */
export interface AttributionParams {
	utm_source?: string
	utm_medium?: string
	utm_campaign?: string
	utm_content?: string
	utm_term?: string
	ref?: string
	landing_path?: string
	landing_url?: string
}

/**
 * Extract attribution parameters from URLSearchParams
 */
export function parseAttributionParams(searchParams: URLSearchParams, pathname?: string): AttributionParams {
	const params: AttributionParams = {}

	// Extract UTM parameters
	const utmSource = searchParams.get("utm_source")
	const utmMedium = searchParams.get("utm_medium")
	const utmCampaign = searchParams.get("utm_campaign")
	const utmContent = searchParams.get("utm_content")
	const utmTerm = searchParams.get("utm_term")
	const ref = searchParams.get("ref")

	if (utmSource) params.utm_source = utmSource
	if (utmMedium) params.utm_medium = utmMedium
	if (utmCampaign) params.utm_campaign = utmCampaign
	if (utmContent) params.utm_content = utmContent
	if (utmTerm) params.utm_term = utmTerm
	if (ref) params.ref = ref

	// Add landing path and URL if available
	if (typeof window !== "undefined") {
		if (pathname) {
			params.landing_path = pathname
		}
		params.landing_url = window.location.href
	}

	return params
}

/**
 * Get referrer from document or explicit ref parameter
 */
export function getReferrer(searchParams: URLSearchParams): string | undefined {
	// First check for explicit ref parameter
	const explicitRef = searchParams.get("ref")
	if (explicitRef) {
		return explicitRef
	}

	// Fall back to document referrer
	if (typeof document !== "undefined" && document.referrer) {
		return document.referrer
	}

	return undefined
}

/**
 * Convert attribution params to HubSpot hidden fields format
 */
export function attributionToHiddenFields(params: AttributionParams): Record<string, string> {
	const fields: Record<string, string> = {}

	// Only include fields that have values
	if (params.utm_source) fields.utm_source = params.utm_source
	if (params.utm_medium) fields.utm_medium = params.utm_medium
	if (params.utm_campaign) fields.utm_campaign = params.utm_campaign
	if (params.utm_content) fields.utm_content = params.utm_content
	if (params.utm_term) fields.utm_term = params.utm_term
	if (params.ref) fields.ref = params.ref
	if (params.landing_path) fields.landing_path = params.landing_path
	if (params.landing_url) fields.landing_url = params.landing_url

	return fields
}
