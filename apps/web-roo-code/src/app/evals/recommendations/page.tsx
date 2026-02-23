import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { getEngineerRoles, getAllRecommendations } from "@/lib/mock-recommendations"
import { EVAL_OUTCOMES, isEvalOutcomeId } from "@/lib/eval-outcomes"

import { WorkersContent } from "../workers/workers-content"

// ── SEO Metadata ────────────────────────────────────────────────────────────

const TITLE = "Build with Roo Code Cloud | Roo Code Evals"
const DESCRIPTION =
	"Outcome-first, eval-backed recommendations for shipping production code. Start from your objective and pick a tradeoff."
const OG_DESCRIPTION = "Outcome-first recommendations for shipping production code"
const PATH = "/evals/recommendations"

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

type PageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecommendationsPage({ searchParams }: PageProps) {
	const sp = (await searchParams) ?? {}
	const view = typeof sp.view === "string" ? sp.view : undefined
	const outcome = typeof sp.outcome === "string" ? sp.outcome : undefined
	const mode = typeof sp.mode === "string" ? sp.mode : undefined

	// Legacy deep link: move profile investigations into the dedicated objective pages.
	if (view === "profile" && outcome && isEvalOutcomeId(outcome)) {
		const objective = EVAL_OUTCOMES.find((o) => o.id === outcome)
		if (objective) {
			const qs = mode ? `?mode=${encodeURIComponent(mode)}` : ""
			redirect(`/evals/recommendations/${objective.slug}${qs}`)
		}
	}

	const roles = getEngineerRoles()
	const recommendations = getAllRecommendations()

	// Aggregate totals
	const totalEvalRuns = recommendations[0]?.totalEvalRuns ?? 0
	const totalExercises = recommendations[0]?.totalExercises ?? 0
	const uniqueModels = new Set(
		recommendations.flatMap((recommendation) => recommendation.allCandidates.map((candidate) => candidate.modelId)),
	)
	const totalModels = uniqueModels.size

	const lastUpdated = recommendations
		.map((r) => r.lastUpdated)
		.sort()
		.pop()

	return (
		<Suspense>
			<WorkersContent
				roles={roles}
				recommendations={recommendations}
				totalEvalRuns={totalEvalRuns}
				totalExercises={totalExercises}
				totalModels={totalModels}
				lastUpdated={lastUpdated}
				workersRootPath="/evals/recommendations"
				roleBasePath="/evals/recommendations/roles"
			/>
		</Suspense>
	)
}
