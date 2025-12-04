import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { AgentLandingContent } from "@/app/shared/AgentLandingContent"
import { getContentVariant } from "@/app/shared/getContentVariant"
import { content as contentA } from "./content"

const TITLE = "Planner"
const DESCRIPTION =
	"Map out implementation strategies and navigate complex technical decisions with AI-powered planning. Create detailed technical specifications, architecture designs, and implementation roadmaps that guide successful project delivery."
const OG_DESCRIPTION = "Strategic technical planning powered by AI"
const PATH = "/planner"

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
		"technical planning",
		"architecture design",
		"implementation strategy",
		"project roadmap",
		"technical specifications",
		"system design",
		"decision making",
		"development planning",
		"bring your own key",
		"BYOK AI",
		"strategic planning",
		"cloud agents",
		"AI development team",
	],
}

export default async function AgentPlannerPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
	const params = await searchParams
	const content = getContentVariant(params, {
		A: contentA,
	})

	return <AgentLandingContent content={content} />
}
