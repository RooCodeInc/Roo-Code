import { Settings, Link2, Hash, CreditCard, LucideIcon } from "lucide-react"

import { EXTERNAL_LINKS } from "@/lib/constants"

interface OnboardingStep {
	step: number
	icon: LucideIcon
	title: string
	description: string
	link?: {
		href: string
		text: string
	}
}

const onboardingSteps: OnboardingStep[] = [
	{
		step: 1,
		icon: CreditCard,
		title: "Get a Team Plan",
		description: "Slack requires a Team Plan.",
		link: {
			href: EXTERNAL_LINKS.CLOUD_APP_TEAM_TRIAL,
			text: "Start a free 14-day trial",
		},
	},
	{
		step: 2,
		icon: Settings,
		title: "Connect Slack",
		description: 'Go to Organization Settings and click "Connect" under Integrations.',
	},
	{
		step: 3,
		icon: Link2,
		title: "Authorize",
		description: "Complete the OAuth flow to connect your workspace.",
	},
	{
		step: 4,
		icon: Hash,
		title: "Add to channels",
		description: "Add @Roomote to the channels where you want it available.",
	},
]

export function SlackOnboardingSteps() {
	return (
		<section className="relative overflow-hidden border-t border-border py-32">
			<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
				<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
					<div className="absolute left-1/2 top-1/2 h-[400px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 dark:bg-blue-700/20 blur-[140px]" />
				</div>

				<div className="mx-auto mb-12 md:mb-24 max-w-5xl text-center">
					<div>
						<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">Get started in minutes</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							Connect your Slack workspace and start working with AI agents.
						</p>
					</div>
				</div>

				<div className="relative mx-auto md:max-w-[1200px]">
					<ul className="grid grid-cols-1 place-items-center gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
						{onboardingSteps.map((step) => {
							const Icon = step.icon
							return (
								<li
									key={step.step}
									className="relative h-full w-full border border-border rounded-2xl bg-background p-8 transition-all duration-300 hover:shadow-lg">
									<div className="flex items-center gap-3 mb-3">
										<div className="bg-violet-100 dark:bg-violet-900/20 w-10 h-10 rounded-full flex items-center justify-center">
											<span className="text-violet-600 dark:text-violet-400 font-bold">
												{step.step}
											</span>
										</div>
										<Icon className="size-5 text-foreground/60" />
									</div>
									<h3 className="mb-3 text-xl font-semibold text-foreground">{step.title}</h3>
									<div className="leading-relaxed font-light text-muted-foreground">
										{step.description}
										{step.link && (
											<>
												{" "}
												<a
													href={step.link.href}
													target="_blank"
													rel="noopener noreferrer"
													className="text-violet-600 dark:text-violet-400 hover:underline">
													{step.link.text}
												</a>
											</>
										)}
									</div>
								</li>
							)
						})}
					</ul>
				</div>
			</div>
		</section>
	)
}
