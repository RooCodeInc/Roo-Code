import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function SlackCTASection() {
	return (
		<section className="py-24">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-blue-500/5 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-white/10 sm:p-16">
					<h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
						Bring your AI team into Slack
					</h2>
					<p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
						Start collaborating with agents where your team already works. Free to try.
					</p>
					<div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
						<Button
							size="lg"
							className="bg-foreground text-background hover:bg-foreground/90 transition-all duration-300"
							asChild>
							<a
								href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center">
								Get Started
								<ArrowRight className="ml-2 h-4 w-4" />
							</a>
						</Button>
					</div>
				</div>
			</div>
		</section>
	)
}
