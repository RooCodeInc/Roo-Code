import React, { useEffect } from "react"
import { hasConsent, onConsentChange } from "../../lib/analytics/consent-manager"

// Google Tag Manager ID - hardcoded for production
const GTM_ID = "GTM-M2JZHV8N"

declare global {
	interface Window {
		dataLayer?: Record<string, unknown>[]
		google_tag_manager?: Record<string, unknown>
	}
}

export function GTMProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		// Check initial consent status
		const consentGiven = hasConsent()

		if (consentGiven) {
			enableGTM()
		}

		// Listen for consent changes
		const cleanup = onConsentChange((granted) => {
			if (granted) {
				enableGTM()
			} else {
				disableGTM()
			}
		})

		return () => {
			cleanup()
			// Clean up GTM scripts on unmount
			removeGTMScripts()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const enableGTM = () => {
		if (typeof window === "undefined") return

		// Check if GTM is already loaded
		if (document.getElementById("gtm-script")) {
			return
		}

		// Initialize dataLayer
		window.dataLayer = window.dataLayer || []
		window.dataLayer.push({
			"gtm.start": new Date().getTime(),
			event: "gtm.js",
		})

		// Inject GTM script in head
		const script = document.createElement("script")
		script.id = "gtm-script"
		script.async = true
		script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`

		const firstScript = document.getElementsByTagName("script")[0]
		if (firstScript && firstScript.parentNode) {
			firstScript.parentNode.insertBefore(script, firstScript)
		} else {
			document.head.appendChild(script)
		}

		// Inject noscript iframe in body
		const noscript = document.createElement("noscript")
		noscript.id = "gtm-noscript"
		const iframe = document.createElement("iframe")
		iframe.src = `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`
		iframe.height = "0"
		iframe.width = "0"
		iframe.style.display = "none"
		iframe.style.visibility = "hidden"
		noscript.appendChild(iframe)

		document.body.insertBefore(noscript, document.body.firstChild)
	}

	const disableGTM = () => {
		if (typeof window === "undefined") return

		// Remove GTM scripts
		removeGTMScripts()

		// Clear dataLayer
		if (window.dataLayer) {
			window.dataLayer = []
		}
	}

	const removeGTMScripts = () => {
		// Remove GTM script
		const script = document.getElementById("gtm-script")
		if (script) {
			script.remove()
		}

		// Remove noscript
		const noscript = document.getElementById("gtm-noscript")
		if (noscript) {
			noscript.remove()
		}
	}

	return <>{children}</>
}
