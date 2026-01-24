import React, { useEffect } from "react"
import useDocusaurusContext from "@docusaurus/useDocusaurusContext"
import { hasConsent, onConsentChange } from "../../lib/analytics/consent-manager"

// Intercom interface - it's a callable function with overloads
interface IntercomInstance {
	(command: "boot", config: Record<string, unknown>): void
	(command: "shutdown"): void
	(command: "update", config?: Record<string, unknown>): void
	(command: "show"): void
	(command: "hide"): void
	(command: "showMessages"): void
	(command: "showNewMessage", message?: string): void
	(command: "onHide", callback: () => void): void
	(command: "onShow", callback: () => void): void
	(command: "onUnreadCountChange", callback: (unreadCount: number) => void): void
}

declare global {
	interface Window {
		Intercom?: IntercomInstance
		intercomSettings?: Record<string, unknown>
	}
}

export function IntercomProvider({ children }: { children: React.ReactNode }) {
	const { siteConfig } = useDocusaurusContext()
	const appId = siteConfig.customFields?.intercomAppId as string | undefined

	useEffect(() => {
		// Only initialize if Intercom App ID is configured
		if (!appId) {
			return
		}

		// Check initial consent status
		const consentGiven = hasConsent()

		if (consentGiven) {
			loadIntercom(appId)
		}

		// Listen for consent changes
		const cleanup = onConsentChange((granted) => {
			if (granted) {
				loadIntercom(appId)
			} else {
				shutdownIntercom()
			}
		})

		return () => {
			cleanup()
			shutdownIntercom()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const loadIntercom = (appId: string) => {
		if (typeof window === "undefined") return

		// Skip if already loaded
		if (window.Intercom) {
			window.Intercom("update")
			return
		}

		// Set up Intercom settings
		window.intercomSettings = {
			app_id: appId,
			alignment: "right",
			horizontal_padding: 20,
			vertical_padding: 20,
		}

		// Load Intercom script
		const script = document.createElement("script")
		script.async = true
		script.src = `https://widget.intercom.io/widget/${appId}`

		script.onload = () => {
			if (window.Intercom) {
				window.Intercom("boot", window.intercomSettings || {})
			}
		}

		document.head.appendChild(script)
	}

	const shutdownIntercom = () => {
		if (typeof window !== "undefined" && window.Intercom) {
			window.Intercom("shutdown")
		}
	}

	return <>{children}</>
}
