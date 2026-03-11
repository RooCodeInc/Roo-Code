import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { getRoleRecommendation } from "@/lib/mock-recommendations"
import { getEvalOutcomeBySlug } from "@/lib/eval-outcomes"

import { ObjectiveContent } from "./objective-content"

type PageProps = {
	params: Promise<{ objectiveSlug: string }>
	searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function isMode(value: string): value is "best" | "fastest" | "cost" {
	return value === "best" || value === "fastest" || value === "cost"
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { objectiveSlug } = await params
	const objective = getEvalOutcomeBySlug(objectiveSlug)
	if (!objective) {
		return {
			title: "Objective Not Found | Roo Code Evals",
			description: "The requested objective was not found.",
		}
	}

	const title = `${objective.name} — Build Profile | Roo Code Evals`
	const description = `Investigate the recommended lineup for ${objective.name}. Compare options, explore data, and start in Roo Code Cloud.`
	const ogDescription = `${objective.name} — Build Profile`
	const path = `/evals/recommendations/${objective.slug}`

	return {
		title,
		description,
		alternates: { canonical: `${SEO.url}${path}` },
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
		keywords: [...SEO.keywords, "AI coding", "model recommendations", "coding evals", "roo code cloud"],
	}
}

export default async function ObjectiveDeepDivePage({ params, searchParams }: PageProps) {
	const { objectiveSlug } = await params
	const objective = getEvalOutcomeBySlug(objectiveSlug)
	if (!objective) notFound()

	const sp = (await searchParams) ?? {}
	const modeRaw = typeof sp.mode === "string" ? sp.mode : undefined
	const initialMode = modeRaw && isMode(modeRaw) ? modeRaw : "best"

	const recs: Array<{ roleId: string; recommendation: NonNullable<ReturnType<typeof getRoleRecommendation>> }> = []
	for (const roleId of objective.recommendedRoleIds) {
		const recommendation = getRoleRecommendation(roleId)
		if (recommendation) recs.push({ roleId, recommendation })
	}

	return (
		<ObjectiveContent
			objective={{
				id: objective.id,
				slug: objective.slug,
				name: objective.name,
				description: objective.description,
				whyItWorks: objective.whyItWorks,
				recommendedRoleIds: objective.recommendedRoleIds,
				builderProfile: objective.builderProfile
					? {
							title: objective.builderProfile.title,
							description: objective.builderProfile.description,
							examplePrompt: objective.builderProfile.examplePrompt,
							howItWorks: objective.builderProfile.howItWorks,
						}
					: undefined,
			}}
			initialMode={initialMode}
			recs={recs}
		/>
	)
}
