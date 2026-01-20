import { ArrowRight, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui"
import { AnimatedBackground } from "@/components/homepage"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function SlackHeroSection() {
	return (
		<section className="relative flex pt-32 pb-20 items-center overflow-hidden">
			<AnimatedBackground />
			<div className="container relative flex flex-col items-center h-full z-10 mx-auto px-4 sm:px-6 lg:px-8">
				<div className="text-center max-w-4xl mx-auto mb-12">
					<h1 className="text-4xl font-bold tracking-tight mb-6 md:text-5xl lg:text-6xl">
						<span className="text-violet-500">@Roomote</span>: Your AI Team in Slack
					</h1>
					<p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
						Summon agents to explain code, plan new features, or execute coding tasks without leaving Slack.
					</p>
					<p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
						Mention @Roomote in any channel. Pick an agent and a repo. Get answers, plans, or a PR in the
						thread.
					</p>
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<Button
							size="xl"
							className="bg-violet-600 hover:bg-violet-700 text-white transition-all duration-300 shadow-lg hover:shadow-violet-500/25"
							asChild>
							<a
								href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center">
								Get Started
								<ArrowRight className="ml-2 size-5" />
							</a>
						</Button>
						<Button variant="outline" size="xl" className="backdrop-blur-sm" asChild>
							<a
								href={EXTERNAL_LINKS.SLACK_INTEGRATION_DOCS}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center">
								Read the Docs
								<ExternalLink className="ml-2 size-4" />
							</a>
						</Button>
					</div>
				</div>
			</div>
		</section>
	)
}
