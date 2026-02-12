import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { getEngineerRoles, getAllRecommendations } from "@/lib/mock-recommendations"

import { WorkersContent } from "./workers-content"

// ── SEO Metadata ────────────────────────────────────────────────────────────

const TITLE = "Hire an AI Engineer | Roo Code Evals"
const DESCRIPTION =
	"Find the right AI coding model for your team. Compare interview results across Junior, Senior, and Staff Engineer roles."
const OG_DESCRIPTION = "Find the right AI coding model for your team"
const PATH = "/evals/workers"

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
		"AI engineer",
		"model recommendations",
		"coding evals",
		"model comparison",
		"hire AI",
		"talent marketplace",
	],
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function HireAnAIEngineerPage() {
	const roles = getEngineerRoles()
	const recommendations = getAllRecommendations()

	// Aggregate totals
	const totalEvalRuns = recommendations.reduce((sum, r) => sum + r.totalEvalRuns, 0)
	const totalExercises = recommendations.reduce((sum, r) => sum + r.totalExercises, 0)

	// Unique model count across all roles
	const uniqueModels = new Set(recommendations.flatMap((r) => r.allCandidates.map((c) => c.modelId)))
	const totalModels = uniqueModels.size

	const lastUpdated = recommendations
		.map((r) => r.lastUpdated)
		.sort()
		.pop()

	return (
		<WorkersContent
			roles={roles}
			recommendations={recommendations}
			totalEvalRuns={totalEvalRuns}
			totalExercises={totalExercises}
			totalModels={totalModels}
			lastUpdated={lastUpdated}
		/>
	)
}
