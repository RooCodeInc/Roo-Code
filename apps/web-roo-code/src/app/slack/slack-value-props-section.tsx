import { MessageSquare, Brain, GitBranch, Users, GraduationCap, Share2, Shield, LucideIcon } from "lucide-react"

interface ValueProp {
	icon: LucideIcon
	title: string
	description: string
}

const valueProps: ValueProp[] = [
	{
		icon: MessageSquare,
		title: "From discussion to shipped feature",
		description:
			"Your team discusses a feature in Slack. @Roomote turns the discussion into a plan. Then builds it. All without leaving the conversation.",
	},
	{
		icon: Brain,
		title: "The agent knows the thread",
		description:
			"@Roomote reads the conversation before responding. Ask 'why is this happening?' after a team discussion and it understands.",
	},
	{
		icon: GitBranch,
		title: "Chain agents for complex work",
		description:
			"Start with a Planner to spec it out. Then call the Coder to build it. Multi-step workflows, one Slack thread.",
	},
	{
		icon: Users,
		title: "Non-technical team members can investigate",
		description:
			"PMs, CSMs, and support can ask @Roomote to explain code or investigate issues. Engineering gets pulled in only when truly needed.",
	},
	{
		icon: GraduationCap,
		title: "Team learning, built in",
		description: "Public channel mentions show everyone how to leverage agents. Learn by watching.",
	},
	{
		icon: Share2,
		title: "One platform, multiple surfaces",
		description:
			"The same agents that work in your IDE and review your PRs are available in Slack. Different surfaces, same quality.",
	},
	{
		icon: Shield,
		title: "Safe by design",
		description: "Agents never touch main/master directly. They produce branches and PRs. Humans approve.",
	},
]

export function SlackValuePropsSection() {
	return (
		<section className="py-24 bg-muted/30">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
				<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
					<div className="absolute left-1/2 top-1/2 h-[800px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 dark:bg-violet-700/20 blur-[140px]" />
				</div>
				<div className="text-center mb-16">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
						Why teams love working with @Roomote
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Collaboration where it already happens, with AI that understands context.
					</p>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto relative">
					{valueProps.map((prop, index) => {
						const Icon = prop.icon
						return (
							<div
								key={index}
								className="bg-background p-8 rounded-2xl border border-border hover:shadow-lg transition-all duration-300">
								<div className="bg-violet-100 dark:bg-violet-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
									<Icon className="size-6 text-violet-600 dark:text-violet-400" />
								</div>
								<h3 className="text-xl font-semibold mb-3">{prop.title}</h3>
								<p className="text-muted-foreground leading-relaxed">{prop.description}</p>
							</div>
						)
					})}
				</div>
			</div>
		</section>
	)
}
