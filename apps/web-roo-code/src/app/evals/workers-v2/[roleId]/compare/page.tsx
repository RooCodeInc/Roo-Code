import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { getEngineerRole, getRoleRecommendation } from "@/lib/mock-recommendations"

import { ComparisonChart } from "../../../workers/[roleId]/compare/comparison-chart"

type PageProps = { params: Promise<{ roleId: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { roleId } = await params
	const role = getEngineerRole(roleId)

	if (!role) {
		return {
			title: "Role Not Found | Roo Code Evals",
			description: "The requested role was not found.",
		}
	}

	const title = `Compare Models — ${role.name} (V2 Preview) | Roo Code Evals`
	const description = `Outcome-first comparison of AI models for ${role.name}. Compare composite score, success rate, cost efficiency, and speed.`
	const ogDescription = `Compare Models — ${role.name} (V2 Preview)`
	const path = `/evals/workers-v2/${roleId}/compare`

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
			"model comparison",
			"coding evals",
			role.name.toLowerCase(),
			"outcome-first",
		],
	}
}

export default async function WorkersV2ComparePage({ params }: PageProps) {
	const { roleId } = await params
	const recommendation = getRoleRecommendation(roleId)

	if (!recommendation) {
		notFound()
	}

	return (
		<ComparisonChart
			recommendation={recommendation}
			role={recommendation.role}
			roleId={roleId}
			workersRootPath="/evals/workers-v2"
		/>
	)
}
