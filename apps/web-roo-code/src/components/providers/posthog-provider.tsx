"use client"

import { usePathname, useSearchParams } from "next/navigation"
import posthog from "posthog-js"
import { PostHogProvider as OriginalPostHogProvider } from "posthog-js/react"
import { useEffect, useRef, Suspense } from "react"
import { hasConsent } from "@/lib/analytics/consent-manager"

/**
 * Extract referring domain from a URL string
 */
function getReferringDomain(referrer: string): string {
	if (!referrer) return ""
	try {
		const url = new URL(referrer)
		return url.hostname
	} catch {
		return ""
	}
}

/**
 * Get UTM parameters from current URL search params
 */
function getUtmParams(searchParams: URLSearchParams | null): Record<string, string> {
	const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
	const utmParams: Record<string, string> = {}

	if (searchParams) {
		for (const key of utmKeys) {
			const value = searchParams.get(key)
			if (value) {
				utmParams[key] = value
			}
		}
	}

	return utmParams
}

function PageViewTracker() {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	// Track previous URL for SPA navigation referrer
	const previousUrl = useRef<string | null>(null)
	// Store original document.referrer for first page load
	const initialReferrer = useRef<string | null>(null)

	// Capture initial referrer on mount
	useEffect(() => {
		if (typeof window !== "undefined" && initialReferrer.current === null) {
			initialReferrer.current = document.referrer || ""
		}
	}, [])

	// Track page views with proper attribution
	useEffect(() => {
		if (pathname && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
			let url = window.location.origin + pathname
			if (searchParams && searchParams.toString()) {
				url = url + `?${searchParams.toString()}`
			}

			// Determine the referrer:
			// - For first pageview: use document.referrer (external referrer)
			// - For SPA navigations: use previous URL within the site
			const referrer = previousUrl.current || initialReferrer.current || ""
			const referringDomain = getReferringDomain(referrer)

			// Collect UTM parameters
			const utmParams = getUtmParams(searchParams)

			posthog.capture("$pageview", {
				$current_url: url,
				$referrer: referrer,
				$referring_domain: referringDomain,
				...utmParams,
			})

			// Update previous URL for next navigation
			previousUrl.current = url
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname, searchParams?.toString()])

	return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		// Initialize PostHog immediately on the client side
		if (typeof window !== "undefined" && !posthog.__loaded) {
			const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

			// Check if environment variables are set
			if (!posthogKey) {
				console.warn(
					"PostHog API key is missing. Analytics will be disabled. " +
						"Please set NEXT_PUBLIC_POSTHOG_KEY in your .env file.",
				)
				return
			}

			// Check if user has already consented to cookies
			const userHasConsented = hasConsent()

			// Initialize PostHog with appropriate persistence based on consent
			posthog.init(posthogKey, {
				api_host: "https://ph.roocode.com",
				ui_host: "https://us.posthog.com",
				capture_pageview: false, // We handle pageview tracking manually
				loaded: (posthogInstance) => {
					if (process.env.NODE_ENV === "development") {
						posthogInstance.debug()
					}
				},
				save_referrer: true, // Save referrer information
				save_campaign_params: true, // Save UTM parameters
				respect_dnt: true, // Respect Do Not Track
				persistence: userHasConsented ? "localStorage+cookie" : "memory", // Use localStorage if consented, otherwise memory-only
				opt_out_capturing_by_default: false, // Start tracking immediately
			})
		}
	}, [])

	return (
		<OriginalPostHogProvider client={posthog}>
			<Suspense fallback={null}>
				<PageViewTracker />
			</Suspense>
			{children}
		</OriginalPostHogProvider>
	)
}
