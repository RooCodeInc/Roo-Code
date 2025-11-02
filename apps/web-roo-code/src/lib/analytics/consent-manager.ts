/**
 * Simple consent event system
 * Dispatches events when cookie consent changes
 */

import { getCookieConsentValue } from "react-cookie-consent"
import { CONSENT_COOKIE_NAME } from "@roo-code/types"
import posthog from "posthog-js"

export const CONSENT_EVENT = "cookieConsentChanged"

/**
 * Check if user has given consent for analytics cookies
 * Uses react-cookie-consent's built-in function
 */
export function hasConsent(): boolean {
	if (typeof window === "undefined") return false
	return getCookieConsentValue(CONSENT_COOKIE_NAME) === "true"
}

/**
 * Dispatch a consent change event
 */
export function dispatchConsentEvent(consented: boolean): void {
	if (typeof window !== "undefined") {
		const event = new CustomEvent(CONSENT_EVENT, {
			detail: { consented },
		})
		window.dispatchEvent(event)
	}
}

/**
 * Listen for consent changes
 */
export function onConsentChange(callback: (consented: boolean) => void): () => void {
	if (typeof window === "undefined") {
		return () => {}
	}

	const handler = (event: Event) => {
		const customEvent = event as CustomEvent<{ consented: boolean }>
		callback(customEvent.detail.consented)
	}

	window.addEventListener(CONSENT_EVENT, handler)
	return () => window.removeEventListener(CONSENT_EVENT, handler)
}

/**
 * Handle user accepting cookies
 * Opts PostHog back into cookie-based tracking and updates Google Consent Mode
 */
export function handleConsentAccept(): void {
	if (typeof window !== "undefined") {
		// Update PostHog consent
		if (posthog.__loaded) {
			// User accepted - ensure localStorage+cookie persistence is enabled
			posthog.opt_in_capturing()
			posthog.set_config({
				persistence: "localStorage+cookie",
			})
		}

		// Update Google Consent Mode v2 immediately
		if ("gtag" in window && typeof window.gtag === "function") {
			;(window as Window & { gtag: (...args: unknown[]) => void }).gtag("consent", "update", {
				ad_storage: "granted",
				ad_user_data: "granted",
				ad_personalization: "granted",
				analytics_storage: "granted",
				functionality_storage: "granted",
				personalization_storage: "granted",
			})
			console.log("User accepted cookies - Google Consent Mode updated to granted")
		}
	}
	dispatchConsentEvent(true)
}

/**
 * Handle user rejecting cookies
 * Switches PostHog to cookieless (memory-only) mode and updates Google Consent Mode
 */
export function handleConsentReject(): void {
	if (typeof window !== "undefined") {
		// Update Google Consent Mode v2 immediately
		if ("gtag" in window && typeof window.gtag === "function") {
			;(window as Window & { gtag: (...args: unknown[]) => void }).gtag("consent", "update", {
				ad_storage: "denied",
				ad_user_data: "denied",
				ad_personalization: "denied",
				analytics_storage: "denied",
				functionality_storage: "denied",
				personalization_storage: "denied",
			})
			console.log("User rejected cookies - Google Consent Mode updated to denied")
		}
	}
	// User rejected - stick to cookieless mode
	dispatchConsentEvent(false)
}
