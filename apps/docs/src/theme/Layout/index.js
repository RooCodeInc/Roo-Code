import React from "react"
import OriginalLayout from "@theme-original/Layout"
import { AnimatedBackground } from "../../components/AnimatedBackground"
import { CookieConsent } from "../../components/CookieConsent"
import { PostHogProvider } from "../../components/PostHogProvider"

export default function Layout(props) {
	return (
		<PostHogProvider>
			<OriginalLayout {...props} />
			<CookieConsent />
		</PostHogProvider>
	)
}
