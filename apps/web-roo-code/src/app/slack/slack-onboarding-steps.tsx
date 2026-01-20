import { Settings, Link2, Hash, LucideIcon } from "lucide-react"

interface OnboardingStep {
	step: number
	icon: LucideIcon
	title: string
	description: string
}

const onboardingSteps: OnboardingStep[] = [
	{
		step: 1,
		icon: Settings,
		title: "Connect your Slack workspace",
		description: "Go to your personal or org settings in the top right user menu",
	},
	{
		step: 2,
		icon: Link2,
		title: "Authorize the integration",
		description: "Click on 'Connect' and follow the OAuth process",
	},
	{
		step: 3,
		icon: Hash,
		title: "Add @Roomote to channels",
		description: "Add the @Roomote bot to the channels where you want it to be available",
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
						<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">Get started in 3 steps</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							Connect your Slack workspace and start collaborating with agents in minutes.
						</p>
					</div>
				</div>

				<div className="relative mx-auto md:max-w-[1200px]">
					<ul className="grid grid-cols-1 place-items-center gap-6 md:grid-cols-3 lg:gap-8">
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
