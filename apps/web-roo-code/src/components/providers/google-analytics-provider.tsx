"use client"

import { useEffect, useState } from "react"
import Script from "next/script"
import { hasConsent, onConsentChange } from "@/lib/analytics/consent-manager"

// Google Tag Manager ID
const GTM_ID = "AW-17391954825"

/**
 * Google Analytics Provider
 * Implements Google's standard gtag.js loading pattern
 */
export function GoogleAnalyticsProvider({ children }: { children: React.ReactNode }) {
	const [shouldLoad, setShouldLoad] = useState(false)

	useEffect(() => {
		// Check initial consent status
		if (hasConsent()) {
			setShouldLoad(true)
		}

		// Listen for consent changes
		const unsubscribe = onConsentChange((consented) => {
			if (consented && !shouldLoad) {
				setShouldLoad(true)
			}
		})

		return unsubscribe
	}, [shouldLoad])

	useEffect(() => {
		// Initialize dataLayer as early as possible (Google's recommended pattern)
		if (typeof window !== "undefined") {
			window.dataLayer = window.dataLayer || []
		}
	}, [])

	return (
		<>
			{shouldLoad && (
				<>
					{/* Google tag (gtag.js) */}
					<Script src={`https://www.googletagmanager.com/gtag/js?id=${GTM_ID}`} strategy="afterInteractive" />
					<Script id="google-analytics" strategy="afterInteractive">
						{`
							window.dataLayer = window.dataLayer || [];
							function gtag(){dataLayer.push(arguments);}
							gtag('js', new Date());
							gtag('config', '${GTM_ID}');
						`}
					</Script>
				</>
			)}
			{children}
		</>
	)
}

// Declare global types for TypeScript
declare global {
	interface Window {
		dataLayer: unknown[]
		gtag: (...args: unknown[]) => void
	}
}
