import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"

import { MethodologyContent } from "./methodology-content"

// ── SEO Metadata ────────────────────────────────────────────────────────────

const TITLE = "Methodology | Roo Code Evals"
const DESCRIPTION = "Our methodology for evaluating AI coding models. Transparent, reproducible, evidence-based."
const OG_DESCRIPTION = "Our methodology for evaluating AI coding models"
const PATH = "/evals/methodology"

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
		"AI evaluation",
		"model benchmarking",
		"coding evals",
		"methodology",
		"evaluation process",
		"transparent evaluation",
	],
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function MethodologyPage() {
	return <MethodologyContent />
}
