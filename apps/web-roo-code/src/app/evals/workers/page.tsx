import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { getEngineerRoles, getAllRecommendations } from "@/lib/mock-recommendations"

import { WorkersContent } from "./workers-content"

// ── SEO Metadata ────────────────────────────────────────────────────────────

const TITLE = "Build with Roo Code Cloud | Roo Code Evals"
const DESCRIPTION =
	"Eval-backed model recommendations for shipping production code. Pick a setup based on the work you're doing: single-file fixes, multi-file changes, review, and autonomous runs."
const OG_DESCRIPTION = "Eval-backed model recommendations for shipping production code"
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
		"AI coding",
		"coding agents",
		"roo code cloud",
		"model recommendations",
		"coding evals",
		"model comparison",
		"shipping code",
		"prototype",
	],
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function WorkersPage() {
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
			workersRootPath="/evals/workers"
			enableOutcomeLayer={false}
			alternateVersionHref="/evals/workers-v2"
			alternateVersionLabel="View V2 preview"
		/>
	)
}
