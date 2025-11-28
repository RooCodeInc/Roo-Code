import { Button } from "@/components/ui"
import {
	CompanyLogos,
	FAQSection,
	Testimonials,
	CloudSection,
	EcosystemSection,
	CTASection,
	OptionOverviewSection,
	PillarsSection,
} from "@/components/homepage"
import { EXTERNAL_LINKS } from "@/lib/constants"
import { ArrowRight } from "lucide-react"
import { StructuredData } from "@/components/structured-data"

// Invalidate cache when a request comes in, at most once every hour.
export const revalidate = 3600

export default async function Home() {
	return (
		<>
			<StructuredData />
			<section className="relative flex flex-col items-center overflow-hidden pt-20 pb-12 md:pt-32 md:pb-16">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
					<h1 className="md:text-4xl font-bold tracking-tight text-foreground max-w-4xl mb-6">
						Your AI Software Engineering Team is here.
						<br />
						<span className="text-muted-foreground">Interactive in the IDE, autonomous in the cloud.</span>
					</h1>
					<div className="mt-2 max-w-3xl text-lg text-muted-foreground mb-10 space-y-3">
						<p>
							Use the <strong className="text-nowrap">Roo Code Extension</strong> on your computer for
							full control, or delegate work to your{" "}
							<strong className="text-nowrap">Roo Code Cloud Agents</strong> from the web, Slack, Github
							or wherever your team is.
						</p>
					</div>
					<div className="flex flex-col sm:flex-row gap-4 mb-16">
						<div className="flex flex-col items-center gap-2">
							<Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg">
								<a
									href={EXTERNAL_LINKS.MARKETPLACE}
									target="_blank"
									rel="noreferrer"
									className="flex items-center justify-center">
									Install VS Code Extension
									<ArrowRight className="ml-2 size-5" />
								</a>
							</Button>
							<span className="text-xs text-muted-foreground">Free and Open Source</span>
						</div>

						<div className="flex flex-col items-center gap-2">
							<Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg">
								<a
									href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
									className="flex items-center justify-center">
									Try Cloud for Free
									<ArrowRight className="ml-2 size-5" />
								</a>
							</Button>
							<span className="text-xs text-muted-foreground">No credit card needed</span>
						</div>
					</div>

					<div className="mb-12">
						<CompanyLogos />
					</div>

					{/* Split Graphic Hero Visual */}
					<div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 rounded-2xl overflow-hidden border border-border shadow-2xl">
						{/* Left Side: VS Code Extension (Blue Tint) */}
						<div className="bg-blue-950/10 dark:bg-blue-950/30 p-6 md:p-10 border-b md:border-b-0 md:border-r border-blue-500/10 flex flex-col items-center justify-center min-h-[400px]">
							<div className="mb-4 font-mono text-sm text-blue-500 font-bold tracking-wider uppercase">
								Extension Image/Animation
							</div>
							<div className="relative w-full max-w-md">
								<div className="absolute -inset-4 bg-blue-500/20 blur-3xl rounded-full" />
							</div>
						</div>

						{/* Right Side: Terminal/Log Stream (Purple Tint) */}
						<div className="bg-purple-950/10 dark:bg-purple-950/30 p-6 md:p-10 flex flex-col items-center justify-center min-h-[400px]">
							<div className="mb-4 font-mono text-sm text-purple-500 font-bold tracking-wider uppercase">
								Cloud Image/Animation
							</div>
						</div>
					</div>
				</div>
			</section>

			<PillarsSection />
			<OptionOverviewSection />
			<CloudSection />
			<EcosystemSection />

			<div id="testimonials">
				<Testimonials />
			</div>

			<div id="faq">
				<FAQSection />
			</div>

			<CTASection />
		</>
	)
}
