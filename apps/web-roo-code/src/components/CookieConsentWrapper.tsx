"use client"

import React from "react"
import { CookieConsent } from "./CookieConsent"
import { dispatchConsentEvent } from "@/lib/analytics/consent-manager"

/**
 * Wrapper component for CookieConsent that handles consent callbacks
 * This is needed because we can't pass event handlers from server components
 */
export function CookieConsentWrapper() {
	const handleAccept = () => {
		dispatchConsentEvent(true)
	}

	const handleDecline = () => {
		dispatchConsentEvent(false)
	}

	return <CookieConsent onAccept={handleAccept} onDecline={handleDecline} enableDeclineButton={true} />
}
