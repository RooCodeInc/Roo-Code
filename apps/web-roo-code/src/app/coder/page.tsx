import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { AgentLandingContent } from "@/app/shared/AgentLandingContent"
import { getContentVariant } from "@/app/shared/getContentVariant"
import { content as contentA } from "./content"

const TITLE = "Coder"
const DESCRIPTION =
	"Transform requirements into production-ready code with AI-powered implementation. Write clean, tested code that follows your team's patterns and creates pull requests automatically."
const OG_DESCRIPTION = "Ship quality code faster with AI-powered implementation"
const PATH = "/coder"

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
		"code generation",
		"AI coding",
		"automated programming",
		"pull request creation",
		"code implementation",
		"feature development",
		"test generation",
		"code quality",
		"bring your own key",
		"BYOK AI",
		"development automation",
		"cloud agents",
		"AI development team",
	],
}

export default async function AgentCoderPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
	const params = await searchParams
	const content = getContentVariant(params, {
		A: contentA,
	})

	return <AgentLandingContent content={content} />
}
