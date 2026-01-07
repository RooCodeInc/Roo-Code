import type { Metadata } from "next"
import { Suspense } from "react"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { CliPreviewContent } from "./cli-preview-content"

const TITLE = "CLI Early Preview"
const DESCRIPTION =
	"If you like Roo Code in VS Code, you will love scripting it. Join the early preview to help shape a CLI designed for power users, automation, and teams."
const OG_DESCRIPTION = "Early preview of the Roo Code CLI"
const PATH = "/cli-preview"

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	robots: {
		index: false,
		follow: false,
	},
	alternates: {
		canonical: `${SEO.url}${PATH}`,
	},
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		url: `${SEO.url}${PATH}`,
		siteName: SEO.name,
		images: [
			{
				url: ogImageUrl(TITLE, OG_DESCRIPTION),
				width: 1200,
				height: 630,
				alt: TITLE,
			},
		],
		locale: SEO.locale,
		type: "website",
	},
	twitter: {
		card: SEO.twitterCard,
		title: TITLE,
		description: DESCRIPTION,
		images: [ogImageUrl(TITLE, OG_DESCRIPTION)],
	},
}

export default function CliPreviewPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900" />
			}>
			<CliPreviewContent />
		</Suspense>
	)
}
