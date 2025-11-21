import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { AgentLandingContent } from "@/app/shared/AgentLandingContent"
import { getContentVariant } from "@/app/shared/getContentVariant"
import { content as contentA } from "./content"

const TITLE = "Explainer"
const DESCRIPTION =
	"Get crystal-clear explanations of code, concepts, and technical documentation. Transform complex systems into understandable knowledge with AI-powered deep dives and contextual insights."
const OG_DESCRIPTION = "Transform complexity into clarity with AI-powered explanations"
const PATH = "/explainer"

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
		"code explainer",
		"technical documentation",
		"code understanding",
		"AI explanations",
		"concept clarification",
		"documentation generation",
		"code analysis",
		"knowledge transfer",
		"bring your own key",
		"BYOK AI",
		"developer education",
		"cloud agents",
		"AI development team",
	],
}

export default async function AgentExplainerPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
	const params = await searchParams
	const content = getContentVariant(params, {
		A: contentA,
	})

	return <AgentLandingContent content={content} />
}
