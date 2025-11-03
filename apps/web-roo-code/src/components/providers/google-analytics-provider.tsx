"use client"

import { useEffect } from "react"
import Script from "next/script"
import { hasConsent, onConsentChange } from "@/lib/analytics/consent-manager"

// Google Ads Conversion ID
const GADS_ID = "AW-17391954825"

/**
 * Google Analytics Provider with Consent Mode v2
 * Implements advanced consent mode with cookieless pings
 */
export function GoogleAnalyticsProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		const updateConsentState = (consented: boolean) => {
			if (typeof window !== "undefined" && window.gtag) {
				// Update consent state based on user choice
				window.gtag("consent", "update", {
					ad_storage: consented ? "granted" : "denied",
					ad_user_data: consented ? "granted" : "denied",
					ad_personalization: consented ? "granted" : "denied",
					analytics_storage: consented ? "granted" : "denied",
					functionality_storage: consented ? "granted" : "denied",
					personalization_storage: consented ? "granted" : "denied",
				})

				if (process.env.NODE_ENV === "development") {
					console.log(`Google Consent Mode updated: ${consented ? "granted" : "denied"}`)
				}
			}
		}

		// Check initial consent status and update if already consented
		if (hasConsent()) {
			updateConsentState(true)
		}

		// Listen for consent changes
		const unsubscribe = onConsentChange((consented) => {
			updateConsentState(consented)
		})

		return unsubscribe
	}, [])

	return (
		<>
			{/* Google tag (gtag.js) - Loads with Consent Mode v2 */}
			<Script
				src={`https://www.googletagmanager.com/gtag/js?id=${GADS_ID}`}
				strategy="afterInteractive"
				onLoad={() => {
					if (process.env.NODE_ENV === "development") {
						console.log("Google Analytics loaded with Consent Mode v2")
					}
				}}
			/>
			<Script id="google-ads-config" strategy="afterInteractive">
				{`
					// Initialize dataLayer and gtag function first (must be before any gtag calls)
					window.dataLayer = window.dataLayer || [];
					function gtag(){dataLayer.push(arguments);}
					
					// Set default consent state for Consent Mode v2 (must be before gtag.js loads)
					gtag('consent', 'default', {
						ad_storage: 'denied',
						ad_user_data: 'denied',
						ad_personalization: 'denied',
						analytics_storage: 'denied',
						functionality_storage: 'denied',
						personalization_storage: 'denied',
						security_storage: 'granted',
						wait_for_update: 2000,
						url_passthrough: true,
						ads_data_redaction: true
					});
					
					gtag('js', new Date());
					
					// Configure Google Ads with enhanced measurement
					gtag('config', '${GADS_ID}', {
						allow_google_signals: false,
						allow_ad_personalization_signals: false,
						// Enable enhanced conversions for better measurement
						enhanced_conversions: {
							automatic: true
						},
						// Send page view for cookieless measurement
						send_page_view: true
					});
				`}
			</Script>
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
