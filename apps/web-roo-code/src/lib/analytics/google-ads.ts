/**
 * Google Ads conversion tracking utilities
 */

/**
 * Track a Google Ads conversion event with optional navigation callback
 * This ensures the conversion ping completes before navigation occurs
 *
 * @param targetUrl - Optional URL to navigate to after conversion is tracked
 *
 * @example
 * // Track conversion and navigate
 * trackGoogleAdsConversion("https://app.roocode.com")
 *
 * @example
 * // Track conversion without navigation
 * trackGoogleAdsConversion()
 */
export function trackGoogleAdsConversion(targetUrl?: string) {
	if (typeof window !== "undefined" && window.gtag) {
		// Callback to handle navigation after conversion tracking
		const callback = () => {
			if (targetUrl) {
				window.location.href = targetUrl
			}
		}

		window.gtag("event", "conversion", {
			send_to: "AW-17391954825/VtOZCJe_77MbEInXkOVA",
			value: 10.0,
			currency: "USD",
			event_callback: callback,
		})

		// Fallback timeout in case event_callback doesn't fire (network issues, etc.)
		// This ensures navigation still happens even if tracking fails
		setTimeout(callback, 1000)
	} else if (targetUrl) {
		// If gtag is not available, navigate immediately
		window.location.href = targetUrl
	}
}
