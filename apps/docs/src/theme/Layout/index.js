import React from "react"
import OriginalLayout from "@theme-original/Layout"
import { CookieConsent } from "../../components/CookieConsent"
import { PostHogProvider } from "../../components/PostHogProvider"
import { GTMProvider } from "../../components/GTMProvider"
import { IntercomProvider } from "../../components/IntercomProvider"

export default function Layout(props) {
	return (
		<PostHogProvider>
			<GTMProvider>
				<IntercomProvider>
					<OriginalLayout {...props} />
					<CookieConsent />
				</IntercomProvider>
			</GTMProvider>
		</PostHogProvider>
	)
}
