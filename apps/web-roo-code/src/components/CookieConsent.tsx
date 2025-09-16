"use client"

import React, { useState, useEffect } from "react"
import ReactCookieConsent from "react-cookie-consent"
import { Cookie } from "lucide-react"
import { CONSENT_COOKIE_NAME, getConsentCookieDomain } from "@/lib/constants"

export interface CookieConsentProps {
	/**
	 * Callback when cookies are accepted
	 */
	onAccept?: () => void
	/**
	 * Callback when cookies are declined
	 */
	onDecline?: () => void
	/**
	 * Enable decline button
	 */
	enableDeclineButton?: boolean
	/**
	 * The text for the decline button
	 */
	declineButtonText?: string
	/**
	 * Additional className for custom styling
	 */
	className?: string
	/**
	 * Cookie name to store consent
	 */
	cookieName?: string
	/**
	 * Debug mode - always show banner
	 */
	debug?: boolean
}

/**
 * GDPR-compliant cookie consent banner component
 * Uses Tailwind classes for styling
 */
export function CookieConsent({
	onAccept,
	onDecline,
	className = "",
	cookieName = CONSENT_COOKIE_NAME,
	debug = false,
}: CookieConsentProps) {
	const [cookieDomain, setCookieDomain] = useState<string | null>(null)

	useEffect(() => {
		// Get the appropriate domain using tldts
		const domain = getConsentCookieDomain()
		setCookieDomain(domain)
	}, [])

	// Don't render until we have a valid domain
	if (!cookieDomain) {
		return null
	}

	const extraCookieOptions = {
		domain: cookieDomain,
	}

	const containerClasses = `
		fixed bottom-2 left-2 right-2 z-[999]
		bg-black/95 dark:bg-white/95
		text-white dark:text-black
		border-t-neutral-800 dark:border-t-gray-200
		backdrop-blur-xl
		border-t
		font-semibold
		rounded-t-lg
		px-4 py-4 md:px-8 md:py-4
		flex flex-wrap items-center justify-between gap-4
		text-sm font-sans
		${className}
	`.trim()

	const buttonWrapperClasses = `
		flex
		flex-row-reverse
		items-center
		gap-2
	`.trim()

	const acceptButtonClasses = `
		bg-white text-black border-neutral-800	
		dark:bg-black dark:text-white dark:border-gray-200
		hover:opacity-50
		transition-opacity
		rounded-md
		px-4 py-2 mr-2
		text-sm font-bold
		cursor-pointer
		focus:outline-none focus:ring-2 focus:ring-offset-2
	`.trim()

	const declineButtonClasses = `
		dark:bg-white dark:text-black dark:border-gray-200
		bg-black text-white border-neutral-800
		hover:opacity-50
		border border-border
		transition-opacity
		rounded-md
		px-4 py-2
		text-sm font-bold
		cursor-pointer
		focus:outline-none focus:ring-2 focus:ring-offset-2
	`.trim()

	return (
		<div role="banner" aria-label="Cookie consent banner" aria-live="polite">
			<ReactCookieConsent
				location="bottom"
				buttonText="Accept"
				declineButtonText="Decline"
				cookieName={cookieName}
				expires={365}
				enableDeclineButton={true}
				onAccept={onAccept}
				onDecline={onDecline}
				debug={debug}
				containerClasses={containerClasses}
				buttonClasses={acceptButtonClasses}
				buttonWrapperClasses={buttonWrapperClasses}
				declineButtonClasses={declineButtonClasses}
				extraCookieOptions={extraCookieOptions}
				disableStyles={true}
				ariaAcceptLabel={`Accept`}
				ariaDeclineLabel={`Decline`}>
				<div className="flex items-center gap-2">
					<Cookie className="size-5 hidden md:block" />
					<span>Like most of the internet, we use cookies. Are you OK with that?</span>
				</div>
			</ReactCookieConsent>
		</div>
	)
}

// Re-export the component as default as well
export default CookieConsent
