/* eslint-disable react/jsx-no-target-blank */

import { Button } from "@/components/ui"
import {
	CodeExample,
	CompanyLogos,
	FAQSection,
	Testimonials,
	StrategySection,
	ExtensionSection,
	BridgeSection,
	CloudSection,
	EcosystemSection,
	CTASection,
} from "@/components/homepage"
import { EXTERNAL_LINKS } from "@/lib/constants"
import { ArrowRight, Terminal } from "lucide-react"
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
						<span className="text-muted-foreground">Interactive in your IDE, autonomous in the cloud.</span>
					</h1>
					<div className="mt-4 max-w-3xl text-lg text-muted-foreground mb-10 space-y-3">
						<p>
							Use the <strong className="text-nowrap">Roo Code Extension</strong> for full control, or
							delegate work to your <strong className="text-nowrap">Roo Code Cloud Agents</strong> from
							Slack, Github or wherever your team gets work&nbsp;done.
						</p>
					</div>
					<div className="flex flex-col sm:flex-row gap-4 mb-16">
						<div className="flex flex-col items-center gap-2">
							<Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg">
								<a
									href="https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline"
									target="_blank"
									className="flex items-center justify-center">
									Install Extension on VS Code
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
								Local Runtime
							</div>
							<div className="relative w-full max-w-md">
								<div className="absolute -inset-4 bg-blue-500/20 blur-3xl rounded-full" />
								<CodeExample />
							</div>
						</div>

						{/* Right Side: Terminal/Log Stream (Purple Tint) */}
						<div className="bg-purple-950/10 dark:bg-purple-950/30 p-6 md:p-10 flex flex-col items-center justify-center min-h-[400px]">
							<div className="mb-4 font-mono text-sm text-purple-500 font-bold tracking-wider uppercase">
								Cloud Runtime
							</div>
							<div className="relative w-full max-w-md bg-background/80 rounded-lg border border-border p-4 shadow-lg font-mono text-xs md:text-sm overflow-hidden">
								<div className="flex items-center gap-2 mb-3 border-b border-border pb-2">
									<Terminal className="h-4 w-4 text-muted-foreground" />
									<span className="text-muted-foreground">roo-cloud-agent-01</span>
								</div>
								<div className="space-y-2 text-muted-foreground">
									<div className="flex gap-2">
										<span className="text-green-500">➜</span>
										<span>git checkout -b feature/auth-flow</span>
									</div>
									<div className="flex gap-2">
										<span className="text-green-500">➜</span>
										<span>npm install @auth/core</span>
									</div>
									<div className="text-blue-500">ℹ Installing dependencies...</div>
									<div className="opacity-50">added 42 packages in 2s</div>
									<div className="flex gap-2">
										<span className="text-green-500">➜</span>
										<span>Analyzing src/auth/config.ts...</span>
									</div>
									<div className="text-purple-500">ℹ Implementing OAuth providers</div>
									<div className="flex gap-2">
										<span className="text-green-500">➜</span>
										<span>Running tests...</span>
									</div>
									<div className="text-green-500">✔ Tests passed (12/12)</div>
									<div className="flex gap-2">
										<span className="text-green-500">➜</span>
										<span>gh pr create --title &quot;Add Auth&quot;</span>
									</div>
									<div className="animate-pulse">_</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<StrategySection />
			<ExtensionSection />
			<BridgeSection />
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
