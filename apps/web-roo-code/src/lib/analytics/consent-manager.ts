const CONSENT_EVENT = "roo-cookie-consent-change"

type ConsentListener = (consented: boolean) => void

export function hasConsent(): boolean {
	if (typeof window === "undefined") {
		return false
	}

	return window.localStorage.getItem("roo-cookie-consent") === "accepted"
}

export function handleConsentAccept(): void {
	if (typeof window === "undefined") {
		return
	}

	window.localStorage.setItem("roo-cookie-consent", "accepted")
	window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: true }))
}

export function handleConsentReject(): void {
	if (typeof window === "undefined") {
		return
	}

	window.localStorage.setItem("roo-cookie-consent", "rejected")
	window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: false }))
}

export function onConsentChange(listener: ConsentListener): () => void {
	if (typeof window === "undefined") {
		return () => {}
	}

	const handler = (event: Event) => {
		listener(Boolean((event as CustomEvent<boolean>).detail))
	}

	window.addEventListener(CONSENT_EVENT, handler)
	return () => window.removeEventListener(CONSENT_EVENT, handler)
}
