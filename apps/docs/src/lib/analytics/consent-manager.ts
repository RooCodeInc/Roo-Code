import { getCookieConsentValue } from "react-cookie-consent"
import { CONSENT_COOKIE_NAME } from "@roo-code/types"

// Custom event names for consent tracking
export const CONSENT_GRANTED_EVENT = "cookieConsentGranted"
export const CONSENT_DENIED_EVENT = "cookieConsentDenied"

/**
 * Dispatches a custom event to notify the application about cookie consent status
 * @param granted - Whether the user has granted consent
 */
export function dispatchConsentEvent(granted: boolean): void {
	if (typeof window === "undefined") return

	const eventName = granted ? CONSENT_GRANTED_EVENT : CONSENT_DENIED_EVENT
	const event = new CustomEvent(eventName, {
		detail: { granted },
		bubbles: true,
		cancelable: false,
	})

	window.dispatchEvent(event)

	// Also dispatch a generic consent event with the status
	const genericEvent = new CustomEvent("cookieConsentChanged", {
		detail: { granted },
		bubbles: true,
		cancelable: false,
	})

	window.dispatchEvent(genericEvent)
}

/**
 * Check if user has given consent for analytics cookies
 * Uses react-cookie-consent's built-in function
 */
export function hasConsent(): boolean {
	if (typeof window === "undefined") return false
	return getCookieConsentValue(CONSENT_COOKIE_NAME) === "true"
}

/**
 * Sets up a listener for consent events
 * @param callback - Function to call when consent status changes
 * @returns Cleanup function to remove the listener
 */
export function onConsentChange(callback: (granted: boolean) => void): () => void {
	if (typeof window === "undefined") return () => {}

	const handler = (event: Event) => {
		const customEvent = event as CustomEvent
		callback(customEvent.detail.granted)
	}

	window.addEventListener("cookieConsentChanged", handler)

	return () => {
		window.removeEventListener("cookieConsentChanged", handler)
	}
}
