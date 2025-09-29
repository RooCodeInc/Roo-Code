import React, { useEffect } from "react"
import { hasConsent, onConsentChange } from "../../lib/analytics/consent-manager"

// PostHog interface - define the methods we use
interface PostHogInstance {
	opt_in_capturing(): void
	opt_out_capturing(): void
	startSessionRecording(): void
	stopSessionRecording(): void
}

declare global {
	interface Window {
		posthog?: PostHogInstance
	}
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		// Check initial consent status
		const consentGiven = hasConsent()

		if (consentGiven) {
			enablePostHog()
		} else {
			disablePostHog()
		}

		// Listen for consent changes
		const cleanup = onConsentChange((granted) => {
			if (granted) {
				enablePostHog()
			} else {
				disablePostHog()
			}
		})

		return cleanup
	}, [])

	const enablePostHog = () => {
		if (typeof window !== "undefined" && window.posthog) {
			// Re-initialize PostHog if it was previously disabled
			if (typeof window.posthog.opt_in_capturing === "function") {
				window.posthog.opt_in_capturing()
			}
			if (typeof window.posthog.startSessionRecording === "function") {
				window.posthog.startSessionRecording()
			}
		}
	}

	const disablePostHog = () => {
		if (typeof window !== "undefined" && window.posthog) {
			if (typeof window.posthog.opt_out_capturing === "function") {
				window.posthog.opt_out_capturing()
			}
			if (typeof window.posthog.stopSessionRecording === "function") {
				window.posthog.stopSessionRecording()
			}
		}
	}

	return <>{children}</>
}
