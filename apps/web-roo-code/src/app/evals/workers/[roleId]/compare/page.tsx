import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { getEngineerRole, getRoleRecommendation } from "@/lib/mock-recommendations"

import { ComparisonChart } from "./comparison-chart"

// ── SEO Metadata ────────────────────────────────────────────────────────────

type PageProps = { params: Promise<{ roleId: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { roleId } = await params
	const role = getEngineerRole(roleId)

	if (!role) {
		return {
			title: "Role Not Found | Roo Code Evals",
			description: "The requested engineer role was not found.",
		}
	}

	const title = `Compare Candidates — ${role.name} | Roo Code Evals`
	const description = `Interactive comparison of AI model candidates for the ${role.name} role. Compare composite score, success rate, cost efficiency, and speed.`
	const ogDescription = `Compare Candidates — ${role.name}`
	const path = `/evals/workers/${roleId}/compare`

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
			"AI engineer",
			"model comparison",
			"coding evals",
			role.name.toLowerCase(),
			"bar chart",
			"candidate comparison",
		],
	}
}

// ── Page Component ──────────────────────────────────────────────────────────

export default async function CompareCandidatesPage({ params }: PageProps) {
	const { roleId } = await params
	const recommendation = getRoleRecommendation(roleId)

	if (!recommendation) {
		notFound()
	}

	return <ComparisonChart recommendation={recommendation} role={recommendation.role} roleId={roleId} />
}
