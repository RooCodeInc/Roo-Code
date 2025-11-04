import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { PRReviewerContent } from "./PRReviewerContent"

const TITLE = "PR Reviewer"
const DESCRIPTION =
	"Get AI-powered PR reviews that catch what other tools miss. Roo uses advanced reasoning models and full repository context to find logic bugs, security issues, and architectural problems—not just lint errors."
const OG_DESCRIPTION = "Code reviews that catch what other AI tools miss"
const PATH = "/pr-reviewer"

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
		"PR reviewer",
		"code review",
		"pull request review",
		"AI code review",
		"GitHub PR review",
		"automated code review",
		"repository-aware review",
		"bring your own key",
		"BYOK AI",
		"code quality",
		"development workflow",
		"cloud agents",
		"AI development team",
		"logic bugs",
		"security vulnerabilities",
		"business logic review",
		"advanced reasoning",
	],
}

export default function PRReviewerPage() {
	return <PRReviewerContent />
}
