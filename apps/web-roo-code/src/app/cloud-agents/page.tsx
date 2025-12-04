import {
	ArrowRight,
	Bot,
	Bug,
	CheckCircle,
	FileText,
	Gauge,
	GitPullRequest,
	Github,
	Languages,
	LucideIcon,
	MessageCircle,
	Microscope,
	PocketKnife,
	Shield,
	Slack,
	TestTube,
	Users,
	Wrench,
	Zap,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui"
import { AnimatedBackground } from "@/components/homepage"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { EXTERNAL_LINKS } from "@/lib/constants"

const TITLE = "Cloud Agents"
const DESCRIPTION =
	"Roo Code Cloud Agents are your AI software development team in the cloud — a set of specialized agents that plug into your stack and help your real team ship reliable code to production."
const OG_DESCRIPTION = "Your AI dev team in the cloud"
const PATH = "/cloud-agents"

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: {
		canonical: `${SEO.url}${PATH}`,
	},
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		url: `${SEO.url}${PATH}`,
		siteName: SEO.name,
		images: [
			{
				url: ogImageUrl(TITLE, OG_DESCRIPTION),
				width: 1200,
				height: 630,
				alt: TITLE,
			},
		],
		locale: SEO.locale,
		type: "website",
	},
	twitter: {
		card: SEO.twitterCard,
		title: TITLE,
		description: DESCRIPTION,
		images: [ogImageUrl(TITLE, OG_DESCRIPTION)],
	},
	keywords: [
		...SEO.keywords,
		"cloud agents",
		"AI development team",
		"AI code review",
		"automated code fixes",
		"GitHub integration",
		"Slack integration",
		"PR reviewer",
		"PR fixer",
		"AI software team",
		"production code",
		"repository-aware AI",
		"bring your own key",
		"BYOK AI",
	],
}

interface Agent {
	icon: LucideIcon
	name: string
	description: string
	page?: string
}

interface DayInLifeScenario {
	title: string
	icon: LucideIcon
	description: string
	steps: string[]
}

const agents: Agent[] = [
	{
		icon: GitPullRequest,
		name: "PR Reviewer",
		description: "Catches logic, security, and integration issues before they ship.",
		page: "/reviewer",
	},
	{
		icon: Wrench,
		name: "PR Fixer",
		description: "Applies review feedback as clean commits.",
		page: "/pr-fixer",
	},
	{
		icon: Bug,
		name: "Bug Fixer",
		description: "Takes Sentry or issue tracker signals and proposes fixes.",
	},
	{
		icon: TestTube,
		name: "Test Engineer",
		description: "Writes and updates tests tailored to your codebase.",
	},
	{
		icon: Microscope,
		name: "Security Auditor",
		description: "Flags security concerns before they reach production.",
	},
	{
		icon: Gauge,
		name: "Performance Optimizer",
		description: "Identifies hotspots, helps optimize critical paths.",
	},
	{
		icon: FileText,
		name: "Documentation Writer",
		description: "Keeps docs and copy in sync with changes.",
	},
	{
		icon: Languages,
		name: "String Translator",
		description: "Manages translations and localization.",
	},
	{
		icon: PocketKnife,
		name: "Generalist",
		description: "Handles general development tasks and questions.",
	},
]

const dayInLifeScenarios: DayInLifeScenario[] = [
	{
		title: "During Development",
		icon: GitPullRequest,
		description: "Your code changes get reviewed and fixed automatically",
		steps: [
			"Dev opens PR → PR Reviewer runs automatically → catches subtle issues",
			'Dev comments "@Roomote: fix the feedback above"',
			"PR Fixer applies changes and pushes a clean commit",
		],
	},
	{
		title: "After an Incident",
		icon: Bug,
		description: "Errors get traced and fixed with minimal human intervention",
		steps: [
			"Sentry logs an error → Agent investigates",
			"Proposes a fix → opens a PR reviewed by another agent",
			"Human approves & deploys",
		],
	},
	{
		title: "Outside Engineering",
		icon: MessageCircle,
		description: "Non-engineers get answers without bothering the team",
		steps: [
			'PM in Slack: "Roo, how does billing work for EU customers?" → gets code-level explanation',
			"Support rep pastes stack trace → agent traces it to a bug and drafts a fix",
			"Analyst asks about revenue calculation → gets pointers to relevant code",
		],
	},
]

interface Pillar {
	icon: LucideIcon
	title: string
	description: string
	bullets?: string[]
}

const pillars: Pillar[] = [
	{
		icon: Shield,
		title: "Serious teams, production code",
		description:
			"For real teams shipping to prod, not vibe-coders tinkering with side projects. Roo's agents are designed to catch the issues that other tools miss.",
		bullets: [
			"PR Reviewer catches logic, security, and architecture-level issues using deep repo context",
			"PR Fixer turns review comments into clean, scoped commits",
			"Every change goes through the same GitHub review + CI pipeline",
			"Used by teams who actually ship with AI, not just talk about it",
		],
	},
	{
		icon: Users,
		title: "A full dev team of agents, not a single bot",
		description:
			"You're not buying a feature. You're hiring a team. Specialized agents with clear roles that work together.",
		bullets: [
			"Multiple agents with specific jobs (reviewing, fixing, testing, documenting)",
			"Shared context and repository awareness across all agents",
			"Workflows that chain multiple agents together",
			"Anything you do repeatedly can become an agent",
		],
	},
	{
		icon: Zap,
		title: "Fits how your whole organization already works",
		description: "Roo meets your org where it already lives: GitHub, Slack, Sentry, IDE.",
		bullets: [
			"GitHub-native: PR Reviewer and Fixer live inside your pull requests",
			"Slack-native: Engineers, PMs, designers, analysts, and support can all talk to agents",
			"Monitoring & CI: Sentry hooks trigger agents to investigate and draft patches",
			"IDE tie-in: Same agents running in the cloud and in your VS Code extension",
		],
	},
]

interface FAQ {
	question: string
	answer: string
}

const faqs: FAQ[] = [
	{
		question: "Won't AI just produce bad code?",
		answer: "PR Reviewer uses deep reasoning and repo context with a human-in-the-loop approach. Every change still goes through the same GitHub review + CI pipeline. Roo is designed to reduce risk compared to unmanaged AI usage.",
	},
	{
		question: "We already have Copilot. Why Roo?",
		answer: "Copilot helps individuals write code faster. Roo is an orchestrated dev team that reviews and fixes PRs, hooks into Slack and Sentry, and coordinates multi-step workflows (review → fix → test). They complement each other.",
	},
	{
		question: "Is this going to be a nightmare to adopt?",
		answer: "Start small: turn it on for a single repo or team. Let PR Reviewer + PR Fixer prove themselves on a subset of PRs. No infra changes required, and you can bring your own key with no model lock-in.",
	},
	{
		question: "Is this only for experimental teams?",
		answer: "No. Roo is used by teams who are already shipping production systems. We built Roo Code itself with a tiny core team plus agents, and we ship to production regularly.",
	},
	{
		question: "How does pricing work with bring your own key?",
		answer: "You bring your own API key for models (no markup, no lock-in). Roo Cloud has a subscription fee for the orchestration platform, agent coordination, and infrastructure. This means we optimize for depth and quality, not token savings.",
	},
]

export default function CloudAgentsPage() {
	return (
		<>
			{/* Hero Section */}
			<section className="relative flex min-h-screen md:min-h-[calc(80vh-theme(spacing.12))] items-center overflow-hidden py-12 md:py-0">
				<AnimatedBackground />
				<div className="container relative flex items-center h-full z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid h-full relative gap-8 md:gap-12 lg:grid-cols-2">
						<div className="flex flex-col justify-center space-y-6 sm:space-y-8">
							<div>
								<h1 className="text-4xl font-bold tracking-tight md:text-left md:text-4xl lg:text-5xl">
									Your AI dev team in the cloud
								</h1>
								<p className="mt-4 max-w-full lg:max-w-lg text-lg text-muted-foreground md:text-left sm:mt-6">
									Roo Code gives you a full team of cloud agents — reviewers, fixers, testers,
									debuggers and more — that plug into GitHub, Slack, and Sentry to help your real team
									ship reliable code to production.
								</p>
								<div className="mt-6 flex flex-wrap gap-2">
									<span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-600 backdrop-blur-sm dark:text-blue-400">
										<Github className="mr-2 h-4 w-4" />
										GitHub-native
									</span>
									<span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-600 backdrop-blur-sm dark:text-blue-400">
										<Slack className="mr-2 h-4 w-4" />
										Slack-native
									</span>
									<span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-600 backdrop-blur-sm dark:text-blue-400">
										<Bot className="mr-2 h-4 w-4" />
										Repository-aware
									</span>
								</div>
							</div>

							<div className="flex flex-col space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0">
								<Button
									size="lg"
									className="w-full sm:w-auto backdrop-blur-sm border hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-300"
									asChild>
									<a
										href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_PRO}
										target="_blank"
										rel="noopener noreferrer"
										className="flex w-full items-center justify-center">
										Start 14-day Free Trial
										<ArrowRight className="ml-2" />
									</a>
								</Button>
								<Button
									variant="outline"
									size="lg"
									className="w-full sm:w-auto bg-white/20 dark:bg-white/10 backdrop-blur-sm border border-black/40 dark:border-white/30 hover:border-blue-400 hover:bg-white/30 dark:hover:bg-white/20"
									asChild>
									<a href="#agents" className="flex w-full items-center justify-center">
										Explore agents
										<ArrowRight className="ml-2" />
									</a>
								</Button>
							</div>
							<p className="text-sm text-muted-foreground">
								Developers really shipping with AI are using Roo Code.
							</p>
						</div>

						<div className="flex items-center justify-center lg:justify-end mx-auto h-full">
							<div className="relative w-full max-w-lg">
								<div className="grid grid-cols-3 gap-4">
									{agents.slice(0, 9).map((agent, index) => {
										const Icon = agent.icon
										return (
											<div
												key={index}
												className="flex flex-col items-center justify-center rounded-lg border border-border bg-background/50 backdrop-blur-sm p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg">
												<Icon className="size-8 mb-2 text-foreground/80" />
												<span className="text-xs font-medium text-center leading-tight">
													{agent.name}
												</span>
											</div>
										)
									})}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* What You're Actually Getting Section */}
			<section className="relative overflow-hidden border-t border-border py-32">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto mb-12 md:mb-24 max-w-4xl text-center">
						<h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
							You&apos;re not buying a feature. You&apos;re hiring a team.
						</h2>
						<p className="mt-6 text-lg text-muted-foreground">
							From one AI assistant to a coordinated dev team
						</p>
					</div>

					<div className="mx-auto max-w-5xl">
						<div className="grid md:grid-cols-3 gap-8 items-center">
							<div className="text-center md:text-right">
								<div className="inline-flex items-center justify-center rounded-full border-2 border-blue-500 bg-blue-500/10 p-6 mb-4">
									<Users className="size-8 text-blue-600 dark:text-blue-400" />
								</div>
								<h3 className="text-xl font-semibold mb-2">Your Team</h3>
								<p className="text-muted-foreground">Engineers, PMs, designers, support</p>
							</div>

							<div className="flex items-center justify-center">
								<div className="flex flex-col items-center gap-4">
									<ArrowRight className="size-6 text-muted-foreground rotate-90 md:rotate-0" />
									<span className="text-sm font-medium text-muted-foreground">works with</span>
									<ArrowRight className="size-6 text-muted-foreground rotate-90 md:rotate-0" />
								</div>
							</div>

							<div className="text-center md:text-left">
								<div className="inline-flex items-center justify-center rounded-full border-2 border-purple-500 bg-purple-500/10 p-6 mb-4">
									<Bot className="size-8 text-purple-600 dark:text-purple-400" />
								</div>
								<h3 className="text-xl font-semibold mb-2">Roo Cloud Agents</h3>
								<p className="text-muted-foreground">Specialized agents with shared context</p>
							</div>
						</div>

						<div className="mt-12 text-center">
							<div className="inline-flex items-center justify-center rounded-full border-2 border-green-500 bg-green-500/10 p-6 mb-4">
								<Zap className="size-8 text-green-600 dark:text-green-400" />
							</div>
							<h3 className="text-xl font-semibold mb-2">Your Stack</h3>
							<p className="text-muted-foreground">GitHub, Slack, Sentry, CI, IDE</p>
						</div>

						<div className="mt-12 p-6 rounded-lg border border-border bg-background">
							<ul className="space-y-3">
								<li className="flex items-start gap-3">
									<CheckCircle className="size-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
									<span className="text-muted-foreground">
										Agents with specific jobs (reviewing, fixing, testing, documenting)
									</span>
								</li>
								<li className="flex items-start gap-3">
									<CheckCircle className="size-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
									<span className="text-muted-foreground">
										Shared context and repository awareness across all agents
									</span>
								</li>
								<li className="flex items-start gap-3">
									<CheckCircle className="size-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
									<span className="text-muted-foreground">
										Workflows that chain multiple agents together
									</span>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</section>

			{/* Day in the Life Section */}
			<section className="relative overflow-hidden border-t border-border py-32">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto mb-12 md:mb-24 max-w-4xl text-center">
						<h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
							A day in the life with Roo Agents
						</h2>
						<p className="mt-6 text-lg text-muted-foreground">What changes on a normal Tuesday</p>
					</div>

					<div className="mx-auto max-w-6xl">
						<div className="grid md:grid-cols-3 gap-8">
							{dayInLifeScenarios.map((scenario, index) => {
								const Icon = scenario.icon
								return (
									<div
										key={index}
										className="relative h-full border border-border rounded-2xl bg-background p-8 transition-all duration-300">
										<Icon className="size-8 text-foreground/80 mb-4" />
										<h3 className="text-xl font-semibold mb-2">{scenario.title}</h3>
										<p className="text-sm text-muted-foreground mb-6">{scenario.description}</p>
										<ul className="space-y-3">
											{scenario.steps.map((step, stepIndex) => (
												<li key={stepIndex} className="flex items-start gap-2">
													<span className="flex-shrink-0 mt-1 size-1.5 rounded-full bg-blue-500" />
													<span className="text-sm text-muted-foreground">{step}</span>
												</li>
											))}
										</ul>
									</div>
								)
							})}
						</div>
					</div>
				</div>
			</section>

			{/* Why Serious Teams Choose Roo Section */}
			<section className="relative overflow-hidden border-t border-border py-32">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto mb-12 md:mb-24 max-w-4xl text-center">
						<h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Why serious teams choose Roo</h2>
					</div>

					<div className="mx-auto max-w-6xl">
						<div className="grid md:grid-cols-3 gap-8">
							{pillars.map((pillar, index) => {
								const Icon = pillar.icon
								return (
									<div
										key={index}
										className="relative h-full border border-border rounded-2xl bg-background p-8 transition-all duration-300">
										<Icon className="size-8 text-foreground/80 mb-4" />
										<h3 className="text-xl font-semibold mb-3">{pillar.title}</h3>
										<p className="text-muted-foreground mb-4">{pillar.description}</p>
										{pillar.bullets && (
											<ul className="space-y-2 mt-4">
												{pillar.bullets.map((bullet, bulletIndex) => (
													<li key={bulletIndex} className="flex items-start gap-2">
														<CheckCircle className="size-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
														<span className="text-sm text-muted-foreground">{bullet}</span>
													</li>
												))}
											</ul>
										)}
									</div>
								)
							})}
						</div>
					</div>
				</div>
			</section>

			{/* Meet Your Agents Section */}
			<section id="agents" className="relative overflow-hidden border-t border-border py-32">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto mb-12 md:mb-24 max-w-4xl text-center">
						<h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Meet your agents</h2>
						<p className="mt-6 text-lg text-muted-foreground">
							The first members of your AI-powered development team
						</p>
					</div>

					<div className="mx-auto max-w-6xl">
						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
							{agents.map((agent, index) => {
								const Icon = agent.icon
								return (
									<div
										key={index}
										className="relative h-full border border-border rounded-2xl bg-background p-8 transition-all duration-300 hover:shadow-lg">
										<Icon className="size-8 text-foreground/80 mb-4" />
										<h3 className="text-xl font-semibold mb-2">{agent.name}</h3>
										<p className="text-muted-foreground mb-4">{agent.description}</p>
										{agent.page && (
											<Link
												href={agent.page}
												className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
												Learn more
												<ArrowRight className="ml-1 h-4 w-4" />
											</Link>
										)}
									</div>
								)
							})}
						</div>

						<div className="mt-12 p-8 rounded-2xl border border-border bg-gradient-to-br from-blue-500/5 to-purple-500/5">
							<p className="text-center text-lg font-medium mb-4">
								These are just the first members of your AI dev team.
							</p>
							<p className="text-center text-muted-foreground">
								Anything you do repeatedly in software development can become an agent. More agents are
								shipping soon.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* How to Get Started Section */}
			<section className="relative overflow-hidden border-t border-border py-32">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto mb-12 md:mb-24 max-w-4xl text-center">
						<h2 className="text-4xl font-bold tracking-tight sm:text-5xl">How to get started</h2>
						<p className="mt-6 text-lg text-muted-foreground">Low-friction, incremental adoption</p>
					</div>

					<div className="mx-auto max-w-4xl">
						<ol className="space-y-6">
							{[
								{
									number: "1",
									title: "Connect GitHub",
									description: "Link your repositories to Roo Cloud Agents",
								},
								{
									number: "2",
									title: "Add your model API key(s)",
									description: "Bring your own keys for Anthropic, OpenAI, or other providers",
								},
								{
									number: "3",
									title: "Pick a repo or branch to start with",
									description: "Start small with a single repo or team",
								},
								{
									number: "4",
									title: "Turn on PR Reviewer + Fixer",
									description: "Enable agents for a subset of PRs to test the workflow",
								},
								{
									number: "5",
									title: "Invite your team to the Slack integration",
									description: "Let non-engineers ask questions and get help from agents",
								},
							].map((step, index) => (
								<li key={index} className="flex gap-6">
									<div className="flex-shrink-0">
										<div className="flex items-center justify-center size-12 rounded-full border-2 border-blue-500 bg-blue-500/10 font-bold text-blue-600 dark:text-blue-400">
											{step.number}
										</div>
									</div>
									<div className="flex-1 pt-1">
										<h3 className="text-xl font-semibold mb-2">{step.title}</h3>
										<p className="text-muted-foreground">{step.description}</p>
									</div>
								</li>
							))}
						</ol>
					</div>
				</div>
			</section>

			{/* FAQ Section */}
			<section className="relative overflow-hidden border-t border-border py-32">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto mb-12 md:mb-24 max-w-4xl text-center">
						<h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Frequently asked questions</h2>
					</div>

					<div className="mx-auto max-w-4xl">
						<div className="space-y-8">
							{faqs.map((faq, index) => (
								<div
									key={index}
									className="border border-border rounded-2xl bg-background p-8 transition-all duration-300">
									<h3 className="text-xl font-semibold mb-3">{faq.question}</h3>
									<p className="text-muted-foreground">{faq.answer}</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-20">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-purple-500/5 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-white/20 dark:bg-gradient-to-br dark:from-gray-800 dark:via-gray-900 dark:to-black sm:p-12">
						<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
							Ready to hire your AI dev team?
						</h2>
						<p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
							Start with a 14-day free trial. No credit card required.
						</p>
						<div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
							<Button
								size="lg"
								className="bg-black text-white hover:bg-gray-800 hover:shadow-lg hover:shadow-black/20 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:hover:shadow-white/20 transition-all duration-300"
								asChild>
								<a
									href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_PRO}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-center">
									Start 14-day Free Trial
									<ArrowRight className="ml-2 h-4 w-4" />
								</a>
							</Button>
							<Button
								variant="outline"
								size="lg"
								className="border-border hover:bg-background/50"
								asChild>
								<a href={EXTERNAL_LINKS.DOCUMENTATION} className="flex items-center justify-center">
									Read Documentation
									<ArrowRight className="ml-2 h-4 w-4" />
								</a>
							</Button>
						</div>
					</div>
				</div>
			</section>
		</>
	)
}
