"use client"

import React from "react"
import ReactCookieConsent from "react-cookie-consent"

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
 * Styled to match the header of web-roo-code with white background by default,
 * and inverted colors in dark mode
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
	// Inline styles that match the web-roo-code header styling
	const containerStyle: React.CSSProperties = {
		background: "var(--cookie-consent-bg, rgba(255, 255, 255, 0.95))",
		color: "var(--cookie-consent-text, #0a0a0a)",
		backdropFilter: "blur(12px)",
		borderTop: "1px solid var(--cookie-consent-border, #e5e5e5)",
		padding: "1rem 2rem",
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: "1rem",
		fontSize: "14px",
		fontFamily: "Inter, system-ui, -apple-system, sans-serif",
		zIndex: 999,
	}

	const buttonStyle: React.CSSProperties = {
		background: "var(--cookie-consent-button-bg, #0a0a0a)",
		color: "var(--cookie-consent-button-text, #fafafa)",
		border: "none",
		borderRadius: "6px",
		padding: "8px 16px",
		fontSize: "14px",
		fontWeight: "500",
		cursor: "pointer",
		transition: "all 0.2s ease",
		fontFamily: "inherit",
	}

	const declineButtonStyle: React.CSSProperties = {
		...buttonStyle,
		background: "transparent",
		color: "var(--cookie-consent-text, #0a0a0a)",
		border: "1px solid var(--cookie-consent-border, #e5e5e5)",
	}

	const contentStyle: React.CSSProperties = {
		flex: 1,
		margin: 0,
		marginRight: "1rem",
	}

	// Check if we're in dark mode by looking for the dark class on the html element
	const [isDarkMode, setIsDarkMode] = React.useState(false)

	React.useEffect(() => {
		const checkDarkMode = () => {
			const htmlElement = document.documentElement
			setIsDarkMode(htmlElement.classList.contains("dark"))
		}

		// Initial check
		checkDarkMode()

		// Watch for changes
		const observer = new MutationObserver(checkDarkMode)
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		})

		return () => observer.disconnect()
	}, [])

	// Update styles based on dark mode
	const finalContainerStyle: React.CSSProperties = {
		...containerStyle,
		background: isDarkMode ? "rgba(0, 0, 0, 0.95)" : "rgba(255, 255, 255, 0.95)",
		color: isDarkMode ? "#fafafa" : "#0a0a0a",
		borderTop: `1px solid ${isDarkMode ? "#262626" : "#e5e5e5"}`,
	}

	const finalButtonStyle: React.CSSProperties = {
		...buttonStyle,
		background: isDarkMode ? "#fafafa" : "#0a0a0a",
		color: isDarkMode ? "#0a0a0a" : "#fafafa",
	}

	const finalDeclineButtonStyle: React.CSSProperties = {
		...declineButtonStyle,
		color: isDarkMode ? "#fafafa" : "#0a0a0a",
		border: `1px solid ${isDarkMode ? "#262626" : "#e5e5e5"}`,
	}

	return (
		<ReactCookieConsent
			location="bottom"
			buttonText={buttonText}
			declineButtonText={declineButtonText}
			cookieName={cookieName}
			style={finalContainerStyle}
			buttonStyle={finalButtonStyle}
			declineButtonStyle={finalDeclineButtonStyle}
			contentStyle={contentStyle}
			expires={365}
			enableDeclineButton={enableDeclineButton}
			onAccept={onAccept}
			onDecline={onDecline}
			debug={debug}
			containerClasses={`CookieConsent ${className}`}
			buttonClasses="cookie-consent-accept"
			declineButtonClasses="cookie-consent-decline"
			contentClasses="cookie-consent-content"
			overlayClasses="cookie-consent-overlay"
			buttonWrapperClasses="cookie-consent-buttons">
			{text}
		</ReactCookieConsent>
	)
}

// Re-export the component as default as well
export default CookieConsent
