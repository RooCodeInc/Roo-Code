import { Button } from "@/components/ui"
import {
	CompanyLogos,
	FAQSection,
	Testimonials,
	CTASection,
	OptionOverviewSection,
	PillarsSection,
	UseExamplesSection,
	FloatingHearts,
} from "@/components/homepage"
import { EXTERNAL_LINKS } from "@/lib/constants"
import { ArrowRight, Heart } from "lucide-react"
import { StructuredData } from "@/components/structured-data"

// Invalidate cache when a request comes in, at most once every hour.
export const revalidate = 3600

export default async function Home() {
	return (
		<>
			<StructuredData />
			<FloatingHearts />
			<section className="relative flex flex-col items-center overflow-hidden pt-20 pb-12 md:pt-32 md:pb-16">
				<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
					<div className="absolute left-1/2 top-1/2 h-[400px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/20 dark:bg-pink-700/30 blur-[140px]" />
					<div className="absolute left-1/4 top-1/3 h-[200px] w-[300px] rounded-full bg-rose-400/15 dark:bg-rose-600/20 blur-[100px]" />
					<div className="absolute right-1/4 top-2/3 h-[250px] w-[350px] rounded-full bg-red-400/10 dark:bg-red-600/15 blur-[120px]" />
				</div>
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
					{/* Valentine's Day Banner */}
					<div className="mb-6 flex items-center gap-2 rounded-full bg-pink-100 dark:bg-pink-950/50 px-4 py-2 text-sm font-medium text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
						<Heart className="h-4 w-4 fill-current pulse-heart" />
						<span>Happy Valentine&apos;s Day from Roo Code!</span>
						<Heart className="h-4 w-4 fill-current pulse-heart" />
					</div>
					<h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground max-w-4xl mb-6">
						Fall in <span className="text-pink-500 dark:text-pink-400">love</span> with coding again.
						<br />
						<span className="text-muted-foreground">Your AI pair that truly cares.</span>
					</h1>
					<div className="mt-2 max-w-3xl text-lg text-muted-foreground mb-10 space-y-3">
						<p>
							Use the{" "}
							<strong className="text-pink-600 dark:text-pink-400 text-nowrap">Roo Code Extension</strong>{" "}
							on your computer for full control, or delegate work to your{" "}
							<strong className="text-rose-600 dark:text-rose-400 text-nowrap">
								Roo Code Cloud Agents
							</strong>{" "}
							from the web, Slack, Github or wherever your team is.
						</p>
					</div>
					<div className="flex flex-col sm:flex-row gap-4 mb-16">
						<div className="flex flex-col items-center gap-2">
							<Button
								size="xl"
								className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-0">
								<a
									href={EXTERNAL_LINKS.MARKETPLACE}
									target="_blank"
									rel="noreferrer"
									className="flex items-center justify-center">
									<Heart className="mr-2 size-5 fill-current" />
									Install VS Code Extension
									<ArrowRight className="ml-2 size-5" />
								</a>
							</Button>
							<span className="text-xs text-muted-foreground">Free and Open Source</span>
						</div>

						<div className="flex flex-col items-center gap-2">
							<Button
								size="xl"
								className="w-full bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white border-0">
								<a
									href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
									className="flex items-center justify-center">
									<Heart className="mr-2 size-5 fill-current" />
									Try Cloud for Free
									<ArrowRight className="ml-2 size-5" />
								</a>
							</Button>
							<span className="text-xs text-muted-foreground">No credit card needed</span>
						</div>
					</div>

					<div className="mb-12 px-4">
						<CompanyLogos />
					</div>
				</div>
			</section>

			<PillarsSection />
			<OptionOverviewSection />
			<UseExamplesSection />
			<Testimonials />
			<FAQSection />
			<CTASection />
		</>
	)
}
