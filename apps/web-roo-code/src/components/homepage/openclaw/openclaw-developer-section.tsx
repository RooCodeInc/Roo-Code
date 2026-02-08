"use client"

import { motion } from "framer-motion"
import { Terminal, Puzzle, Rocket, Globe, MessageSquare, Sparkles } from "lucide-react"

const STEPS = [
	{
		step: "01",
		icon: Terminal,
		title: "Build with Roo Code",
		description:
			"Use Roo Code in your IDE or Cloud to build custom OpenClaw skills, automations, and integrations. Roo understands your codebase and OpenClaw's API.",
		color: "violet" as const,
	},
	{
		step: "02",
		icon: Puzzle,
		title: "Connect via MCP",
		description:
			"Roo Code's Model Context Protocol bridges both platforms. Your OpenClaw automations get access to your dev tools, repos, and infrastructure context.",
		color: "mixed" as const,
	},
	{
		step: "03",
		icon: Rocket,
		title: "Deploy & Automate",
		description:
			"Ship your custom skills to OpenClaw. Now your team can trigger complex dev workflows from WhatsApp, Telegram, or any chat app they already use.",
		color: "amber" as const,
	},
]

const USE_CASES = [
	{
		icon: MessageSquare,
		title: '"Deploy staging" from WhatsApp',
		description: "Type a message, OpenClaw triggers Roo Code Cloud, staging goes live.",
	},
	{
		icon: Globe,
		title: "Auto-localize on merge",
		description: "When a PR merges, Roo translates strings and OpenClaw notifies translators.",
	},
	{
		icon: Sparkles,
		title: "Bug triage from Telegram",
		description: "Paste a stack trace in chat. OpenClaw routes it, Roo Code diagnoses it.",
	},
]

const fadeInUp = {
	initial: { opacity: 0, y: 20 },
	whileInView: { opacity: 1, y: 0 },
	viewport: { once: true, margin: "-50px" },
}

const colorMap = {
	violet: {
		bg: "bg-violet-500/10 dark:bg-violet-500/20",
		text: "text-violet-600 dark:text-violet-400",
		border: "border-violet-500/20",
		line: "bg-violet-500",
	},
	amber: {
		bg: "bg-amber-500/10 dark:bg-amber-500/20",
		text: "text-amber-600 dark:text-amber-400",
		border: "border-amber-500/20",
		line: "bg-amber-500",
	},
	mixed: {
		bg: "bg-gradient-to-br from-violet-500/10 to-amber-500/10 dark:from-violet-500/20 dark:to-amber-500/20",
		text: "text-foreground",
		border: "border-foreground/10",
		line: "bg-gradient-to-b from-violet-500 to-amber-500",
	},
}

export function OpenClawDeveloperSection() {
	return (
		<section className="py-24 bg-background relative overflow-hidden">
			<div className="container px-4 mx-auto sm:px-6 lg:px-8">
				{/* Section header */}
				<motion.div {...fadeInUp} transition={{ duration: 0.6 }} className="text-center mb-16">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
						How developers use them together
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Build OpenClaw automations with Roo Code. Ship AI-powered workflows that go beyond the terminal.
					</p>
				</motion.div>

				{/* Steps */}
				<div className="max-w-3xl mx-auto mb-20">
					{STEPS.map((step, index) => {
						const Icon = step.icon
						const colors = colorMap[step.color]
						return (
							<motion.div
								key={step.step}
								{...fadeInUp}
								transition={{ duration: 0.5, delay: 0.1 * index }}
								className="relative">
								{/* Connector line */}
								{index < STEPS.length - 1 && (
									<div className="absolute left-6 top-16 bottom-0 w-0.5">
										<div className={`w-full h-full ${colors.line} opacity-20`} />
									</div>
								)}

								<div className="flex gap-5 pb-12">
									<div
										className={`size-12 rounded-xl ${colors.bg} flex items-center justify-center shrink-0 border ${colors.border}`}>
										<Icon className={`size-6 ${colors.text}`} />
									</div>
									<div>
										<span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
											Step {step.step}
										</span>
										<h3 className="text-xl font-bold mt-1 mb-2">{step.title}</h3>
										<p className="text-muted-foreground leading-relaxed">{step.description}</p>
									</div>
								</div>
							</motion.div>
						)
					})}
				</div>

				{/* Quick use cases */}
				<motion.div {...fadeInUp} transition={{ duration: 0.6 }} className="text-center mb-10">
					<h3 className="text-xl font-bold">Things you can build today</h3>
				</motion.div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
					{USE_CASES.map((useCase, index) => {
						const Icon = useCase.icon
						return (
							<motion.div
								key={useCase.title}
								{...fadeInUp}
								transition={{ duration: 0.5, delay: 0.1 * index }}
								className="rounded-xl bg-card outline outline-border/50 p-6 hover:shadow-lg transition-shadow text-center">
								<div className="size-12 rounded-xl bg-gradient-to-br from-violet-500/10 to-amber-500/10 dark:from-violet-500/20 dark:to-amber-500/20 flex items-center justify-center mx-auto mb-4">
									<Icon className="size-6 text-foreground/70" />
								</div>
								<h4 className="font-semibold text-sm mb-2">{useCase.title}</h4>
								<p className="text-sm text-muted-foreground">{useCase.description}</p>
							</motion.div>
						)
					})}
				</div>
			</div>
		</section>
	)
}
