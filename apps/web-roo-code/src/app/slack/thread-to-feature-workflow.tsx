"use client"

import { Map, MessageCircle, Code, GitPullRequest, Eye, CornerDownRight } from "lucide-react"

interface SlackMessage {
	user: string
	role: string
	avatar: string
	message: string
	isBot?: boolean
	reactions?: string[]
}

interface WorkflowStep {
	step: number
	title: string
	description: string
	result: string
	messages: SlackMessage[]
}

const workflowSteps: WorkflowStep[] = [
	{
		step: 1,
		title: "Turn the discussion into a plan",
		description: "Capture complex discussions and transform them into structured specs",
		result: "Planner agent reads the thread and returns a structured spec",
		messages: [
			{
				user: "Sarah",
				role: "PM",
				avatar: "S",
				message: "This is getting complex. Let's not lose this.",
			},
			{
				user: "Sarah",
				role: "PM",
				avatar: "S",
				message:
					"@Roomote plan out a dark mode feature based on our discussion. Include the toggle, persistence, and system preference detection.",
			},
			{
				user: "Roomote",
				role: "Planner Agent",
				avatar: "R",
				message: "I'll analyze the thread and create a structured plan...",
				isBot: true,
				reactions: ["👀"],
			},
		],
	},
	{
		step: 2,
		title: "Refine the plan in the thread",
		description: "Collaborate with your team to review and improve the spec",
		result: "The team iterates on the plan without leaving the conversation",
		messages: [
			{
				user: "Alex",
				role: "Designer",
				avatar: "A",
				message: "Can we add a system preference auto-detect option?",
			},
			{
				user: "Sarah",
				role: "PM",
				avatar: "S",
				message: "@Roomote update the plan to include auto-detect from system preferences",
			},
			{
				user: "Roomote",
				role: "Planner Agent",
				avatar: "R",
				message: "Updated the plan. Added system preference detection as the default behavior...",
				isBot: true,
			},
		],
	},
	{
		step: 3,
		title: "Build the plan",
		description: "Hand off the refined spec to the Coder agent",
		result: "Coder agent creates a branch and opens a PR",
		messages: [
			{
				user: "Mike",
				role: "Engineer",
				avatar: "M",
				message: "This looks good. Let's build it.",
			},
			{
				user: "Mike",
				role: "Engineer",
				avatar: "M",
				message: "@Roomote implement this plan in the frontend-web repo.",
			},
			{
				user: "Roomote",
				role: "Coder Agent",
				avatar: "R",
				message: "Building the dark mode feature. I'll create a PR when ready...",
				isBot: true,
				reactions: ["👀"],
			},
		],
	},
	{
		step: 4,
		title: "Review and ship",
		description: "Review the PR and merge when ready",
		result: "Human oversight at every step. Agents produce artifacts; humans decide what ships.",
		messages: [
			{
				user: "Roomote",
				role: "Coder Agent",
				avatar: "R",
				message: "PR ready for review: feat: Add dark mode with system preference detection #247",
				isBot: true,
			},
			{
				user: "Mike",
				role: "Engineer",
				avatar: "M",
				message: "Reviewing now. LGTM! Merging.",
			},
		],
	},
]

function SlackMessageComponent({ message }: { message: SlackMessage }) {
	return (
		<div className="flex gap-3 py-2">
			<div
				className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
					message.isBot
						? "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400"
						: "bg-muted text-muted-foreground"
				}`}>
				{message.avatar}
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-baseline gap-2 mb-0.5">
					<span className={`font-semibold text-sm ${message.isBot ? "text-violet-600 dark:text-violet-400" : ""}`}>
						{message.user}
					</span>
					<span className="text-xs text-muted-foreground">{message.role}</span>
				</div>
				<p className="text-sm text-foreground/90 leading-relaxed">{message.message}</p>
				{message.reactions && message.reactions.length > 0 && (
					<div className="flex gap-1 mt-1.5">
						{message.reactions.map((reaction, i) => (
							<span
								key={i}
								className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-xs">
								{reaction}
							</span>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

function WorkflowStepCard({ step }: { step: WorkflowStep }) {
	const stepIcons = [Map, MessageCircle, Code, GitPullRequest]
	const Icon = stepIcons[step.step - 1] || Map

	return (
		<div className="bg-background rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all duration-300">
			{/* Step Header */}
			<div className="p-6 border-b border-border bg-muted/30">
				<div className="flex items-center gap-3 mb-2">
					<div className="bg-violet-100 dark:bg-violet-900/20 w-8 h-8 rounded-full flex items-center justify-center">
						<span className="text-violet-600 dark:text-violet-400 font-bold text-sm">{step.step}</span>
					</div>
					<Icon className="size-5 text-violet-600 dark:text-violet-400" />
				</div>
				<h3 className="text-xl font-semibold mb-1">{step.title}</h3>
				<p className="text-sm text-muted-foreground">{step.description}</p>
			</div>

			{/* Slack Thread Mockup */}
			<div className="p-4 bg-background">
				<div className="space-y-1">
					{step.messages.map((message, i) => (
						<SlackMessageComponent key={i} message={message} />
					))}
				</div>
			</div>

			{/* Result */}
			<div className="p-4 border-t border-border bg-violet-50/50 dark:bg-violet-900/10">
				<div className="flex items-start gap-2 text-sm">
					<CornerDownRight className="size-4 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
					<span className="text-violet-700 dark:text-violet-300 font-medium">{step.result}</span>
				</div>
			</div>
		</div>
	)
}

export function ThreadToFeatureWorkflow() {
	return (
		<section className="py-24 bg-background">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="text-center mb-16">
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium mb-4">
						<Eye className="size-4" />
						Featured Workflow
					</div>
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
						From Discussion to Shipped Feature
					</h2>
					<p className="text-xl text-muted-foreground max-w-3xl mx-auto">
						The complete workflow that makes Slack the ideal surface for agent collaboration. Discussion
						&rarr; spec &rarr; code &rarr; PR, all in one thread.
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
					{workflowSteps.map((step) => (
						<WorkflowStepCard key={step.step} step={step} />
					))}
				</div>

				<div className="mt-12 text-center">
					<p className="text-muted-foreground max-w-2xl mx-auto">
						<strong className="text-foreground">No context switch required.</strong> Everyone sees the
						workflow in public channels. Multi-agent handoffs from Planner to Coder. Human oversight at
						every step.
					</p>
				</div>
			</div>
		</section>
	)
}
