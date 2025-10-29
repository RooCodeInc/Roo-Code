"use client"

import React, { useState, useEffect } from "react"
import ReactCookieConsent from "react-cookie-consent"
import { Cookie } from "lucide-react"
import { getDomain } from "tldts"
import { CONSENT_COOKIE_NAME } from "@roo-code/types"
import { dispatchConsentEvent } from "@/lib/analytics/consent-manager"

/**
 * GDPR-compliant cookie consent banner component
 * Handles both the UI and consent event dispatching
 * Enhanced with improved visibility and user interaction
 */
export function CookieConsentWrapper() {
	const [cookieDomain, setCookieDomain] = useState<string | null>(null)
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		// Get the appropriate domain using tldts
		if (typeof window !== "undefined") {
			const domain = getDomain(window.location.hostname)
			setCookieDomain(domain)
		}

		// Check if consent cookie exists
		const cookieExists = document.cookie.includes(CONSENT_COOKIE_NAME)
		if (!cookieExists) {
			// Delay showing the banner slightly for better animation effect
			const timer = setTimeout(() => {
				setIsVisible(true)
			}, 500)
			return () => clearTimeout(timer)
		}
	}, [])

	const handleAccept = () => {
		setIsVisible(false)
		dispatchConsentEvent(true)
	}

	const handleDecline = () => {
		setIsVisible(false)
		dispatchConsentEvent(false)
	}

	const extraCookieOptions = cookieDomain
		? {
				domain: cookieDomain,
			}
		: {}

	const containerClasses = `
		cookie-banner-container
		fixed bottom-0 left-0 right-0 z-[999]
		bg-black/95 dark:bg-white/95
		text-white dark:text-black
		border-t-2 border-t-neutral-700 dark:border-t-gray-300
		backdrop-blur-xl
		shadow-2xl
		font-semibold
		px-4 py-5 md:px-8 md:py-6
		flex flex-wrap items-center justify-between gap-4
		text-sm md:text-base font-sans
	`.trim()

	const buttonWrapperClasses = `
		flex
		flex-row-reverse
		items-center
		gap-3
	`.trim()

	const acceptButtonClasses = `
		cookie-accept-button
		bg-green-600 text-white
		dark:bg-green-500 dark:text-white
		hover:bg-green-700 dark:hover:bg-green-600
		transition-all duration-200
		rounded-lg
		px-6 py-2.5 md:px-8 md:py-3
		text-sm md:text-base font-bold
		cursor-pointer
		shadow-lg hover:shadow-xl
		focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
		transform hover:scale-105
	`.trim()

	const declineButtonClasses = `
		dark:bg-gray-200 dark:text-gray-800 dark:border-gray-300
		bg-gray-800 text-gray-200 border-gray-600
		hover:bg-gray-700 dark:hover:bg-gray-300
		border-2
		transition-all duration-200
		rounded-lg
		px-4 py-2.5 md:px-6 md:py-3
		text-sm md:text-base font-bold
		cursor-pointer
		focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
	`.trim()

	// Don't render anything if not visible
	if (!isVisible) {
		return null
	}

	return (
		<>
			{/* Backdrop overlay */}
			<div
				className="fixed inset-0 bg-black/30 dark:bg-black/20 z-[998] backdrop-blur-[2px]"
				style={{
					animation: "fadeIn 0.3s ease-out",
				}}
			/>

			{/* Banner */}
			<div role="banner" aria-label="Cookie consent banner" aria-live="polite">
				<style
					dangerouslySetInnerHTML={{
						__html: `
						@keyframes slideUp {
							from {
								transform: translateY(100%);
								opacity: 0;
							}
							to {
								transform: translateY(0);
								opacity: 1;
							}
						}
						@keyframes fadeIn {
							from {
								opacity: 0;
							}
							to {
								opacity: 1;
							}
						}
						@keyframes pulse {
							0%, 100% {
								box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
							}
							50% {
								box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
							}
						}
						.cookie-banner-container {
							animation: slideUp 0.4s ease-out;
						}
						.cookie-accept-button {
							animation: pulse 2s infinite;
						}
					`,
					}}
				/>
				<ReactCookieConsent
					location="bottom"
					buttonText="Accept Cookies"
					declineButtonText="Decline"
					cookieName={CONSENT_COOKIE_NAME}
					expires={365}
					enableDeclineButton={true}
					onAccept={handleAccept}
					onDecline={handleDecline}
					containerClasses={containerClasses}
					buttonClasses={acceptButtonClasses}
					buttonWrapperClasses={buttonWrapperClasses}
					declineButtonClasses={declineButtonClasses}
					extraCookieOptions={extraCookieOptions}
					disableStyles={true}
					ariaAcceptLabel="Accept all cookies"
					ariaDeclineLabel="Decline non-essential cookies">
					<div className="flex items-center gap-3">
						<Cookie className="size-6 md:size-7 flex-shrink-0" />
						<span className="leading-relaxed">
							Like most of the internet, we use cookies to enhance your experience. Are you OK with that?
						</span>
					</div>
				</ReactCookieConsent>
			</div>
		</>
	)
}
