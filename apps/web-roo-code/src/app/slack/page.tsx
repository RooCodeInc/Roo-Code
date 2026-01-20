import type { Metadata } from "next"

import { StructuredData } from "@/components/structured-data"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"

import { SlackHeroSection } from "./slack-hero-section"
import { SlackValuePropsSection } from "./slack-value-props-section"
import { ThreadToFeatureWorkflow } from "./thread-to-feature-workflow"
import { SlackOnboardingSteps } from "./slack-onboarding-steps"
import { SlackCTASection } from "./slack-cta-section"

const TITLE = "Roo Code for Slack"
const DESCRIPTION =
	"Summon agents to explain code, plan new features, or execute coding tasks without leaving Slack. Your AI team in your team's workspace."
const OG_DESCRIPTION = "@Roomote: Your AI Team in Slack"
const PATH = "/slack"

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
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
	keywords: [
		...SEO.keywords,
		"Slack integration",
		"team collaboration",
		"Slack bot",
		"AI Slack assistant",
		"@Roomote",
		"Slack agents",
	],
}

export default function SlackPage() {
	return (
		<>
			<StructuredData />
			<SlackHeroSection />
			<SlackValuePropsSection />
			<ThreadToFeatureWorkflow />
			<SlackOnboardingSteps />
			<SlackCTASection />
		</>
	)
}
