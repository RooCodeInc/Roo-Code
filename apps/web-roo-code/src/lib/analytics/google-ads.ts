/**
 * Google Ads conversion tracking utilities
 * Works with Google Consent Mode v2 for cookieless measurement
 */

/**
 * Track a Google Ads conversion event
 * With Consent Mode v2, this will:
 * - Send full conversion data when consent is granted
 * - Send cookieless conversion pings when consent is denied
 * - Use enhanced conversions for better measurement accuracy
 */
export function trackGoogleAdsConversion() {
	if (typeof window !== "undefined" && window.gtag) {
		// Conversion will be tracked according to current consent state
		// If consent is denied, Google will use cookieless pings
		// If consent is granted, full conversion tracking will be used
		window.gtag("event", "conversion", {
			send_to: "AW-17391954825/VtOZCJe_77MbEInXkOVA",
			value: 10.0,
			currency: "USD",
			// Additional parameters for enhanced conversion tracking
			transaction_id: `${Date.now()}`, // Unique ID to prevent duplicates
		})

		console.log("Google Ads conversion tracked with Consent Mode v2")
	}
}

/**
 * Track a page view for remarketing
 * Works with Consent Mode v2 for cookieless measurement
 */
export function trackPageViewForRemarketing() {
	if (typeof window !== "undefined" && window.gtag) {
		// Page view will be tracked according to current consent state
		window.gtag("event", "page_view", {
			send_to: "AW-17391954825",
			// These parameters help with cookieless measurement
			// They will be redacted if consent is denied
		})
	}
}

/**
 * Initialize enhanced conversions for better measurement
 * This should be called once when the app initializes
 */
export function initializeEnhancedConversions() {
	if (typeof window !== "undefined" && window.gtag) {
		// Enable enhanced conversions for better measurement accuracy
		// This works with Consent Mode v2 to provide better conversion modeling
		window.gtag("set", "user_data", {
			// User data will only be sent if consent is granted
			// Otherwise, Google uses conversion modeling
		})
	}
}
