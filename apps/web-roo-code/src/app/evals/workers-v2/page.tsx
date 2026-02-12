import type { Metadata } from "next"
import { Fraunces, IBM_Plex_Sans } from "next/font/google"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { getEngineerRoles, getAllRecommendations } from "@/lib/mock-recommendations"

import { WorkersContent } from "../workers/workers-content"

const TITLE = "Build with Roo Code Cloud (V2 Preview) | Roo Code Evals"
const DESCRIPTION =
	"Outcome-first, eval-backed recommendations for shipping production code. Start from what you need to ship and pick a setup."
const OG_DESCRIPTION = "Outcome-first recommendations for shipping production code"
const PATH = "/evals/workers-v2"

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" })
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" })

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
		"shipping code",
		"prototype",
		"outcome-first",
	],
}

export default function WorkersV2Page() {
	const roles = getEngineerRoles()
	const recommendations = getAllRecommendations()

	const totalEvalRuns = recommendations.reduce((sum, recommendation) => sum + recommendation.totalEvalRuns, 0)
	const totalExercises = recommendations.reduce((sum, recommendation) => sum + recommendation.totalExercises, 0)
	const uniqueModels = new Set(
		recommendations.flatMap((recommendation) => recommendation.allCandidates.map((candidate) => candidate.modelId)),
	)
	const totalModels = uniqueModels.size
	const lastUpdated = recommendations
		.map((recommendation) => recommendation.lastUpdated)
		.sort()
		.pop()

	return (
		<div className={`${body.variable} ${display.variable} [font-family:var(--font-body)]`}>
			<WorkersContent
				roles={roles}
				recommendations={recommendations}
				totalEvalRuns={totalEvalRuns}
				totalExercises={totalExercises}
				totalModels={totalModels}
				lastUpdated={lastUpdated}
				workersRootPath="/evals/workers-v2"
				enableOutcomeLayer
				alternateVersionHref="/evals/workers"
				alternateVersionLabel="View baseline"
			/>
		</div>
	)
}
