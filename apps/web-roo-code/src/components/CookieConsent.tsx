"use client"

import React from "react"
import ReactCookieConsent from "react-cookie-consent"
import { useTheme } from "next-themes"

export interface CookieConsentProps {
	/**
	 * The text to display in the cookie consent banner
	 */
	text?: string
	/**
	 * The text for the accept button
	 */
	buttonText?: string
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
 * Uses Tailwind classes for styling and next-themes for dark mode detection
 */
export function CookieConsent({
	text = "Like pretty much everyone else, we use cookies. We assume you're OK with it, but you can opt out if you want.",
	buttonText = "Accept",
	onAccept,
	onDecline,
	enableDeclineButton = true,
	declineButtonText = "Decline",
	className = "",
	cookieName = "roo-code-cookie-consent",
	debug = false,
}: CookieConsentProps) {
	const { theme } = useTheme()
	const isDarkMode = theme === "dark"

	// Tailwind classes for the container
	const containerClasses = `
		fixed bottom-0 left-0 right-0 z-[999]
		${isDarkMode ? "bg-black/95" : "bg-white/95"}
		backdrop-blur-xl
		${isDarkMode ? "border-t-neutral-800" : "border-t-gray-200"}
		border-t
		px-4 py-4 md:px-8 md:py-4
		flex flex-wrap items-center justify-between gap-4
		text-sm font-sans
		${className}
	`.trim()

	// Tailwind classes for the accept button
	const acceptButtonClasses = `
		${isDarkMode ? "bg-white text-black" : "bg-black text-white"}
		hover:opacity-90
		transition-opacity
		rounded-md
		px-4 py-2
		text-sm font-medium
		cursor-pointer
		focus:outline-none focus:ring-2 focus:ring-offset-2
		${isDarkMode ? "focus:ring-white" : "focus:ring-black"}
	`.trim()

	// Tailwind classes for the decline button
	const declineButtonClasses = `
		bg-transparent
		${isDarkMode ? "text-white border-neutral-800" : "text-black border-gray-200"}
		border
		hover:opacity-90
		transition-opacity
		rounded-md
		px-4 py-2
		text-sm font-medium
		cursor-pointer
		focus:outline-none focus:ring-2 focus:ring-offset-2
		${isDarkMode ? "focus:ring-white" : "focus:ring-black"}
	`.trim()

	// Tailwind classes for the content
	const contentClasses = `
		flex-1
		${isDarkMode ? "text-neutral-200" : "text-gray-700"}
		mr-4
	`.trim()

	return (
		<div role="banner" aria-label="Cookie consent banner" aria-live="polite">
			<ReactCookieConsent
				location="bottom"
				buttonText={buttonText}
				declineButtonText={declineButtonText}
				cookieName={cookieName}
				expires={365}
				enableDeclineButton={enableDeclineButton}
				onAccept={onAccept}
				onDecline={onDecline}
				debug={debug}
				containerClasses={containerClasses}
				buttonClasses={acceptButtonClasses}
				declineButtonClasses={declineButtonClasses}
				contentClasses={contentClasses}
				disableStyles={true}
				ariaAcceptLabel={`Accept ${buttonText}`}
				ariaDeclineLabel={`Decline ${declineButtonText}`}>
				{text}
			</ReactCookieConsent>
		</div>
	)
}

// Re-export the component as default as well
export default CookieConsent
