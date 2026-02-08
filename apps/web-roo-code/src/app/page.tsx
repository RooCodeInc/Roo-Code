import { Testimonials, FAQSection } from "@/components/homepage"
import {
	OpenClawHero,
	OpenClawIntegrationSection,
	OpenClawDeveloperSection,
	OpenClawCTASection,
} from "@/components/homepage/openclaw"
import { StructuredData } from "@/components/structured-data"

// Invalidate cache when a request comes in, at most once every hour.
export const revalidate = 3600

export default async function Home() {
	return (
		<>
			<StructuredData />
			<OpenClawHero />
			<OpenClawIntegrationSection />
			<OpenClawDeveloperSection />
			<Testimonials />
			<FAQSection />
			<OpenClawCTASection />
		</>
	)
}
