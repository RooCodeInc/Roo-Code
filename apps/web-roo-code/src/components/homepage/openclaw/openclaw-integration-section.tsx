"use client"

import { motion } from "framer-motion"
import {
	Code,
	MessageSquare,
	GitPullRequest,
	Smartphone,
	Mail,
	Calendar,
	Plane,
	ArrowRight,
	Zap,
	Bot,
	Workflow,
} from "lucide-react"

const ROO_CAPABILITIES = [
	{
		icon: Code,
		title: "Build & Ship Code",
		description: "Write features, fix bugs, and deploy from your IDE or Cloud",
	},
	{
		icon: GitPullRequest,
		title: "Automate PRs & Reviews",
		description: "AI agents that review, fix, and merge pull requests",
	},
	{
		icon: Bot,
		title: "Cloud Agent Teams",
		description: "Delegate coding tasks from Slack, GitHub, or the web",
	},
]

const OPENCLAW_CAPABILITIES = [
	{
		icon: Mail,
		title: "Manage Email & Inbox",
		description: "Clears your inbox, drafts replies, sends follow-ups",
	},
	{
		icon: Calendar,
		title: "Handle Scheduling",
		description: "Manages your calendar, books meetings, resolves conflicts",
	},
	{
		icon: Plane,
		title: "Real-World Actions",
		description: "Checks you in for flights, orders food, handles errands",
	},
]

const INTEGRATION_SCENARIOS = [
	{
		trigger: "A bug report lands in Slack",
		rooAction: "Roo Code investigates the codebase, identifies the fix, and opens a PR",
		openclawAction: "OpenClaw notifies the reporter on WhatsApp and reschedules the affected demo",
		icon: MessageSquare,
	},
	{
		trigger: "You ship a new feature",
		rooAction: "Roo Code Cloud agents handle the review, testing, and merge",
		openclawAction: "OpenClaw emails the changelog to stakeholders and updates the project tracker",
		icon: Workflow,
	},
	{
		trigger: "A deploy fails at 2am",
		rooAction: "Roo Code diagnoses the failure, applies the fix, and re-deploys",
		openclawAction: "OpenClaw texts the on-call engineer and reschedules the morning standup",
		icon: Zap,
	},
]

const fadeInUp = {
	initial: { opacity: 0, y: 20 },
	whileInView: { opacity: 1, y: 0 },
	viewport: { once: true, margin: "-50px" },
}

export function OpenClawIntegrationSection() {
	return (
		<section className="py-24 bg-muted/30 relative overflow-hidden">
			{/* Background glow */}
			<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
				<div className="absolute left-1/4 top-1/3 h-[600px] w-[400px] rounded-full bg-violet-500/5 dark:bg-violet-600/10 blur-[140px]" />
				<div className="absolute right-1/4 bottom-1/3 h-[600px] w-[400px] rounded-full bg-amber-500/5 dark:bg-amber-600/10 blur-[140px]" />
			</div>

			<div className="container px-4 mx-auto sm:px-6 lg:px-8 relative z-10">
				{/* Section header */}
				<motion.div {...fadeInUp} transition={{ duration: 0.6 }} className="text-center mb-20">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
						Two AIs. One workflow.{" "}
						<span className="bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
							Zero gaps.
						</span>
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Roo Code handles the engineering. OpenClaw handles the everything else. Connected through MCP,
						they keep your whole operation moving.
					</p>
				</motion.div>

				{/* Side-by-side capabilities */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto mb-24">
					{/* Roo Code side */}
					<motion.div
						{...fadeInUp}
						transition={{ duration: 0.6, delay: 0.1 }}
						className="rounded-2xl bg-card outline outline-border/50 shadow-lg p-8 relative group hover:shadow-xl transition-shadow">
						<div className="absolute -top-3 left-8">
							<span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 text-white px-3 py-1 text-xs font-semibold shadow-md">
								<Code className="size-3" />
								Roo Code
							</span>
						</div>
						<h3 className="text-xl font-bold mt-3 mb-2">The coding half</h3>
						<p className="text-muted-foreground mb-6">
							Your AI software engineering team, in the IDE and the cloud.
						</p>
						<div className="space-y-4">
							{ROO_CAPABILITIES.map((cap) => {
								const Icon = cap.icon
								return (
									<div key={cap.title} className="flex gap-3">
										<div className="size-10 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
											<Icon className="size-5 text-violet-600 dark:text-violet-400" />
										</div>
										<div>
											<p className="font-semibold text-sm">{cap.title}</p>
											<p className="text-sm text-muted-foreground">{cap.description}</p>
										</div>
									</div>
								)
							})}
						</div>
					</motion.div>

					{/* OpenClaw side */}
					<motion.div
						{...fadeInUp}
						transition={{ duration: 0.6, delay: 0.2 }}
						className="rounded-2xl bg-card outline outline-border/50 shadow-lg p-8 relative group hover:shadow-xl transition-shadow">
						<div className="absolute -top-3 left-8">
							<span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 text-xs font-semibold shadow-md">
								<Smartphone className="size-3" />
								OpenClaw
							</span>
						</div>
						<h3 className="text-xl font-bold mt-3 mb-2">The action half</h3>
						<p className="text-muted-foreground mb-6">
							The AI that actually does things, from any chat app you already use.
						</p>
						<div className="space-y-4">
							{OPENCLAW_CAPABILITIES.map((cap) => {
								const Icon = cap.icon
								return (
									<div key={cap.title} className="flex gap-3">
										<div className="size-10 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
											<Icon className="size-5 text-amber-600 dark:text-amber-400" />
										</div>
										<div>
											<p className="font-semibold text-sm">{cap.title}</p>
											<p className="text-sm text-muted-foreground">{cap.description}</p>
										</div>
									</div>
								)
							})}
						</div>
					</motion.div>
				</div>

				{/* Integration flow - "When they work together" */}
				<motion.div {...fadeInUp} transition={{ duration: 0.6, delay: 0.3 }} className="text-center mb-12">
					<h3 className="text-2xl font-bold tracking-tight sm:text-3xl mb-4">When they work together</h3>
					<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
						Real scenarios where the integration saves you hours.
					</p>
				</motion.div>

				<div className="max-w-4xl mx-auto space-y-6">
					{INTEGRATION_SCENARIOS.map((scenario, index) => {
						const Icon = scenario.icon
						return (
							<motion.div
								key={scenario.trigger}
								{...fadeInUp}
								transition={{ duration: 0.5, delay: 0.1 * index }}
								className="rounded-2xl bg-card outline outline-border/50 shadow-lg p-6 md:p-8 hover:shadow-xl transition-shadow">
								{/* Trigger */}
								<div className="flex items-start gap-3 mb-6">
									<div className="size-10 rounded-full bg-foreground/5 flex items-center justify-center shrink-0">
										<Icon className="size-5 text-foreground/70" />
									</div>
									<div>
										<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
											Trigger
										</span>
										<p className="font-semibold text-lg">{scenario.trigger}</p>
									</div>
								</div>

								{/* Actions */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="rounded-xl bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/10 dark:border-violet-500/20 p-4">
										<div className="flex items-center gap-2 mb-2">
											<div className="size-6 rounded-md bg-violet-600 flex items-center justify-center">
												<span className="text-white text-xs font-bold">R</span>
											</div>
											<span className="text-xs font-semibold text-violet-700 dark:text-violet-400">
												Roo Code
											</span>
											<ArrowRight className="size-3 text-violet-500/50 ml-auto" />
										</div>
										<p className="text-sm text-muted-foreground">{scenario.rooAction}</p>
									</div>

									<div className="rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 p-4">
										<div className="flex items-center gap-2 mb-2">
											<div className="size-6 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
												<span className="text-white text-xs font-bold">O</span>
											</div>
											<span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
												OpenClaw
											</span>
											<ArrowRight className="size-3 text-amber-500/50 ml-auto" />
										</div>
										<p className="text-sm text-muted-foreground">{scenario.openclawAction}</p>
									</div>
								</div>
							</motion.div>
						)
					})}
				</div>
			</div>
		</section>
	)
}
