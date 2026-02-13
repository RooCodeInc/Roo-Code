import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { getRoleRecommendation, getCloudSetupUrl } from "@/lib/mock-recommendations"

import { CandidatesContent } from "../../../workers/[roleId]/candidates-content"

type PageProps = { params: Promise<{ roleId: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { roleId } = await params
	const recommendation = getRoleRecommendation(roleId)

	if (!recommendation) {
		return {
			title: "Role Not Found | Roo Code Evals",
			description: "The requested engineer role was not found.",
		}
	}

	const { role } = recommendation
	const title = `${role.name} — Recommended Models | Roo Code Evals`
	const description = `Eval-backed recommendations for ${role.name}. Compare models by success rate, cost, and speed across 5 languages.`
	const ogDescription = `${role.name} — Recommended Models`
	const path = `/evals/recommendations/roles/${roleId}`

	return {
		title,
		description,
		alternates: {
			canonical: `${SEO.url}${path}`,
		},
		openGraph: {
			title,
			description,
			url: `${SEO.url}${path}`,
			siteName: SEO.name,
			images: [
				{
					url: ogImageUrl(title, ogDescription),
					width: 1200,
					height: 630,
					alt: title,
				},
			],
			locale: SEO.locale,
			type: "website",
		},
		twitter: {
			card: SEO.twitterCard,
			title,
			description,
			images: [ogImageUrl(title, ogDescription)],
		},
		keywords: [
			...SEO.keywords,
			"AI coding",
			"coding agents",
			"model recommendations",
			"coding evals",
			role.name.toLowerCase(),
			"model comparison",
		],
	}
}

export default async function RecommendationRolePage({ params }: PageProps) {
	const { roleId } = await params
	const recommendation = getRoleRecommendation(roleId)

	if (!recommendation) {
		notFound()
	}

	const { role, best, budgetHire, speedHire, allCandidates, totalEvalRuns, totalExercises, lastUpdated } =
		recommendation

	const cloudUrls: Record<string, string> = {}
	for (const candidate of allCandidates) {
		cloudUrls[candidate.modelId] = getCloudSetupUrl(candidate)
	}

	return (
		<CandidatesContent
			roleId={roleId}
			role={role}
			best={best}
			budgetHire={budgetHire}
			speedHire={speedHire}
			allCandidates={allCandidates}
			totalEvalRuns={totalEvalRuns}
			totalExercises={totalExercises}
			lastUpdated={lastUpdated}
			cloudUrls={cloudUrls}
			workersRootPath="/evals/recommendations"
			roleBasePath="/evals/recommendations/roles"
		/>
	)
}
