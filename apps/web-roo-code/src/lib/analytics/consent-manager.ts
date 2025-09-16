/**
 * Consent Manager - Handles cookie consent state for analytics
 * Works with react-cookie-consent library
 */

/**
 * Cookie name used by react-cookie-consent
 */
const CONSENT_COOKIE_NAME = "roo-code-cookie-consent"

/**
 * Event name for consent changes
 */
export const CONSENT_EVENT = "cookieConsentChanged"

/**
 * Check if user has given consent for analytics cookies
 */
export function hasConsent(): boolean {
	// Only check on client side
	if (typeof window === "undefined") {
		return false
	}

	// Check if the consent cookie exists and has value "true"
	const cookies = document.cookie.split(";")
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split("=")
		if (name === CONSENT_COOKIE_NAME && value === "true") {
			return true
		}
	}

	return false
}

/**
 * Dispatch a consent change event
 * This is used to notify providers when consent status changes
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
