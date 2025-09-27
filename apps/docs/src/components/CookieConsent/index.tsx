import React, { useState, useEffect } from "react"
import ReactCookieConsent from "react-cookie-consent"
import { CONSENT_COOKIE_NAME } from "@roo-code/types"
import { getDomain } from "tldts"
import { dispatchConsentEvent } from "../../lib/analytics/consent-manager"
import styles from "./styles.module.css"

export function CookieConsent() {
	const [cookieDomain, setCookieDomain] = useState<string | null>(null)

	useEffect(() => {
		// Get the appropriate domain using tldts
		if (typeof window !== "undefined") {
			if (window.location.hostname === "localhost") {
				setCookieDomain("localhost")
				return
			} else {
				setCookieDomain(getDomain(window.location.hostname))
			}
		}
	}, [])

	const handleAccept = () => {
		dispatchConsentEvent(true)
	}

	const handleDecline = () => {
		dispatchConsentEvent(false)
	}

	const extraCookieOptions = cookieDomain
		? {
				domain: cookieDomain,
			}
		: {}

	return (
		<div role="banner" aria-label="Cookie consent banner" aria-live="polite">
			<ReactCookieConsent
				location="bottom"
				buttonText="Accept"
				declineButtonText="Decline"
				cookieName={CONSENT_COOKIE_NAME}
				expires={365}
				enableDeclineButton={true}
				onAccept={handleAccept}
				onDecline={handleDecline}
				containerClasses={styles.container}
				buttonClasses={styles.acceptButton}
				buttonWrapperClasses={styles.buttonWrapper}
				declineButtonClasses={styles.declineButton}
				extraCookieOptions={extraCookieOptions}
				disableStyles={true}
				ariaAcceptLabel="Accept cookies"
				ariaDeclineLabel="Decline cookies">
				<div className={styles.content}>
					<svg
						className={styles.cookieIcon}
						xmlns="http://www.w3.org/2000/svg"
						width="1.5em"
						height="1.5em"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round">
						<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
						<path d="M8.5 8.5v.01" />
						<path d="M16 15.5v.01" />
						<path d="M12 12v.01" />
						<path d="M11 17v.01" />
						<path d="M7 14v.01" />
					</svg>
					<span>Like most of the internet, we use cookies. Are you OK with that?</span>
				</div>
			</ReactCookieConsent>
		</div>
	)
}
