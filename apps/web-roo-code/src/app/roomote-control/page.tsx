import type { Metadata } from "next"
import { RoomoteHero } from "@/components/roomote-control/hero"
import { NarrativeBand } from "@/components/roomote-control/narrative-band"
import { HowItWorks } from "@/components/roomote-control/how-it-works"
import { FeatureGrid } from "@/components/roomote-control/feature-grid"
import { RoomoteTestimonials } from "@/components/roomote-control/testimonials"
import { RoomoteFAQ } from "@/components/roomote-control/faq"
import { FinalCTA } from "@/components/roomote-control/final-cta"

export const metadata: Metadata = {
	title: "Roo Code Cloud | Roomote Control – Manage coding tasks from mobile & web browser in addition to the IDE",
	description:
		"Roomote Control keeps coding moving, wherever you are. Start tasks in your editor, manage them from your phone or browser, and watch your workspace mirror into the cloud.",
	alternates: {
		canonical: "https://roocode.com/roomote-control",
	},
	openGraph: {
		title: "Roo Code Cloud | Roomote Control",
		description:
			"Manage coding tasks from mobile & web browser in addition to the IDE. Your first truly hybrid coding teammate.",
		url: "https://roocode.com/roomote-control",
		siteName: "Roo Code",
		images: [
			{
				url: "https://roocode.com/og-roomote-control.png",
				width: 1200,
				height: 630,
				alt: "Roomote Control - Hybrid coding across IDE, cloud, and mobile",
			},
		],
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Roo Code Cloud | Roomote Control",
		description: "Manage coding tasks from mobile & web browser in addition to the IDE",
		images: ["https://roocode.com/og-roomote-control.png"],
	},
}

export default function RoomoteControlPage() {
	return (
		<>
			<RoomoteHero />
			<NarrativeBand />
			<HowItWorks />
			<FeatureGrid />
			<RoomoteTestimonials />
			<RoomoteFAQ />
			<FinalCTA />
		</>
	)
}
