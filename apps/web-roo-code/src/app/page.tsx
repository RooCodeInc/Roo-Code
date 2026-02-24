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

// Check if current date is Valentine's season (Feb 1-15)
function isValentinesSeason() {
	const now = new Date()
	const month = now.getMonth() // 0-indexed, so February is 1
	const day = now.getDate()
	return month === 1 && day >= 1 && day <= 15
}

export default async function Home() {
	const isValentines = isValentinesSeason()

	return (
		<>
			<StructuredData />
			<FloatingHearts />
			<section className="relative flex flex-col items-center overflow-hidden pt-20 pb-12 md:pt-32 md:pb-16">
				<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
					<div
						className={`absolute left-1/2 top-1/2 h-[400px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px] ${
							isValentines
								? "bg-rose-500/15 dark:bg-rose-600/25"
								: "bg-violet-500/10 dark:bg-violet-700/20"
						}`}
					/>
				</div>
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
					<h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground max-w-4xl mb-6">
						{isValentines ? (
							<>
								<span className="inline-flex items-center gap-2">
									Fall in{" "}
									<Heart className="inline size-8 md:size-10 text-rose-500 fill-rose-500 animate-heartbeat" />{" "}
									with coding again.
								</span>
								<br />
								<span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-rose-500 to-red-500">
									Your AI pair that truly cares.
								</span>
							</>
						) : (
							<>
								Your AI Software Engineering Team is here.
								<br />
								<span className="text-muted-foreground">
									Interactive in the IDE, autonomous in the cloud.
								</span>
							</>
						)}
					</h1>
					<div className="mt-2 max-w-3xl text-lg text-muted-foreground mb-10 space-y-3">
						{isValentines ? (
							<p>
								This Valentine&apos;s season, let{" "}
								<strong className="text-rose-500 text-nowrap">Roo Code</strong> be your perfect coding
								companion. Use the <strong className="text-nowrap">Extension</strong> for hands-on
								collaboration, or let your <strong className="text-nowrap">Cloud Agents</strong> handle
								the heavy lifting while you focus on what you love.
							</p>
						) : (
							<p>
								Use the <strong className="text-nowrap">Roo Code Extension</strong> on your computer for
								full control, or delegate work to your{" "}
								<strong className="text-nowrap">Roo Code Cloud Agents</strong> from the web, Slack,
								Github or wherever your team is.
							</p>
						)}
					</div>
					<div className="flex flex-col sm:flex-row gap-4 mb-16">
						<div className="flex flex-col items-center gap-2">
							<Button size="xl" className="w-full">
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
							<Button size="xl" className="w-full">
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

					{!isValentines && (
						<div className="mb-12 px-4">
							<CompanyLogos />
						</div>
					)}
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
