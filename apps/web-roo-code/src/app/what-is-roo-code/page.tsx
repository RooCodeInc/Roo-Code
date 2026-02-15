import type { Metadata } from "next"
import Link from "next/link"
import {
	ArrowRight,
	Brain,
	Bug,
	Cloud,
	Code,
	Download,
	Keyboard,
	Laptop,
	Map,
	MessageCircleQuestion,
	Shield,
	TestTube,
	Users2,
	Workflow,
} from "lucide-react"

import { Button } from "@/components/ui"
import { FAQStructuredData } from "@/components/faq-structured-data"
import { EXTERNAL_LINKS } from "@/lib/constants"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"

const TITLE = "What is Roo Code?"
const DESCRIPTION =
	"Roo Code is an AI-powered development platform with autonomous cloud agents and a free, open-source VS Code extension. Delegate tasks to AI agents from the web, Slack, Linear, or GitHub."
const OG_DESCRIPTION = "Your AI software engineering team in the Cloud and the IDE"
const PATH = "/what-is-roo-code"

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
		type: "article",
	},
	twitter: {
		card: SEO.twitterCard,
		title: TITLE,
		description: DESCRIPTION,
		images: [ogImageUrl(TITLE, OG_DESCRIPTION)],
	},
	keywords: [
		...SEO.keywords,
		"what is roo code",
		"roo code overview",
		"roo code explained",
		"AI coding assistant",
		"open source AI coding",
		"roo code vs cursor",
		"roo code vs copilot",
		"roo code vs windsurf",
		"AI code editor",
		"agentic coding",
		"cloud AI agents",
	],
}

const modes = [
	{
		name: "Architect",
		description: "Plans complex changes without making changes to code.",
		icon: Map,
	},
	{
		name: "Code",
		description: "Implements, refactors, and optimizes code across files.",
		icon: Code,
	},
	{
		name: "Ask",
		description: "Explains functionality, architecture, and program behavior.",
		icon: MessageCircleQuestion,
	},
	{
		name: "Debug",
		description: "Diagnoses issues, traces failures, and proposes targeted fixes.",
		icon: Bug,
	},
	{
		name: "Test",
		description: "Creates and improves tests without changing actual functionality.",
		icon: TestTube,
	},
	{
		name: "Orchestrator",
		description: "Coordinates large tasks by delegating subtasks to other modes.",
		icon: Workflow,
	},
]

const faqData = [
	{
		question: "What are Roo Code Cloud Agents?",
		answer: "Roo Code Cloud Agents are autonomous AI agents that run 24/7 in isolated cloud containers. You can delegate tasks to specialized agents like the Planner, Coder, Explainer, PR Reviewer, and PR Fixer from the web, Slack, Linear, or GitHub. They work in the background while you focus on other things.",
	},
	{
		question: "Is Roo Code free?",
		answer: "Roo Code Cloud has a free tier that includes access to Cloud Agents, the Roo Code Router, task history, and professional support. The VS Code extension is completely free and open source. Paid plans add team features, Slack and Linear integrations, and centralized billing.",
	},
	{
		question: "Which AI models does Roo Code support?",
		answer: "Roo Code is fully model-agnostic. It supports OpenAI models (GPT-4o, GPT-4, o1), Anthropic Claude (including Claude 3.5 Sonnet), Google Gemini, Grok, DeepSeek, Mistral, Qwen, and any model accessible through OpenRouter or compatible APIs. Use the Roo Code Router for curated models at cost, or bring your own API key.",
	},
	{
		question: "Is my code secure?",
		answer: "Yes. Cloud Agents run in isolated containers with access only to the repositories you explicitly authorize. The VS Code extension runs locally, so your code never leaves your machine unless you choose. Roo Code is SOC 2 Type II compliant, fully open source and auditable, and supports enterprise governance features like model allow-lists and data residency controls.",
	},
	{
		question: "What integrations does Roo Code Cloud support?",
		answer: "Roo Code Cloud integrates with GitHub for PR reviews, code fixes, and repository access. You can trigger agents from Slack by mentioning @Roomote in any channel, or assign work directly from Linear issues. Tasks can also be created from the Roo Code Cloud web UI. All integrations work with the same model-agnostic, bring-your-own-key approach.",
	},
	{
		question: "Can it handle large, enterprise-scale projects?",
		answer: "Yes. Roo Code Cloud provides enterprise-grade governance, SAML/SCIM, usage analytics, cost controls, and audit trails. Cloud Agents work in isolated containers and can be configured with model allow-lists and data residency controls. The VS Code extension uses efficient strategies like semantic search to handle large codebases locally.",
	},
]

export default function WhatIsRooCodePage() {
	return (
		<>
			<FAQStructuredData faqs={faqData} />

			{/* Article structured data */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "Article",
						headline: TITLE,
						description: DESCRIPTION,
						url: `${SEO.url}${PATH}`,
						publisher: {
							"@type": "Organization",
							name: SEO.name,
							url: SEO.url,
							logo: {
								"@type": "ImageObject",
								url: `${SEO.url}/android-chrome-512x512.png`,
								width: 512,
								height: 512,
							},
						},
						mainEntityOfPage: {
							"@type": "WebPage",
							"@id": `${SEO.url}${PATH}`,
						},
					}),
				}}
			/>

			{/* Hero */}
			<section className="relative pt-24 pb-20 md:pt-36 md:pb-28 overflow-hidden">
				{/* Layered background effects */}
				<div className="absolute inset-0 z-0">
					<div className="absolute left-1/4 top-1/3 h-[500px] w-[500px] rounded-full bg-violet-500/8 dark:bg-violet-600/15 blur-[120px]" />
					<div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-blue-500/6 dark:bg-blue-600/10 blur-[100px]" />
				</div>

				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center">
					<h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl mb-6">
						Your AI{" "}
						<span className="bg-gradient-to-r from-violet-600 via-purple-500 to-blue-500 bg-clip-text text-transparent">
							Software Engineering
						</span>
						<br />
						Team.
					</h1>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
						Autonomous agents in the cloud.
						<br />A powerful coding assistant in your IDE.
					</p>
					<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
						<Button size="xl" asChild>
							<a
								href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2">
								Try Cloud for Free
								<ArrowRight className="h-5 w-5" />
							</a>
						</Button>
						<Button variant="outline" size="xl" asChild>
							<a
								href={EXTERNAL_LINKS.MARKETPLACE}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2">
								<Download className="h-5 w-5" />
								Install on VS Code
							</a>
						</Button>
					</div>
				</div>
			</section>

			{/* Overview prose -- AEO-rich content that reads naturally after the hero */}
			<section className="py-16 md:py-20 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
					<p className="text-lg text-muted-foreground leading-relaxed mb-6">
						Roo Code is an AI-powered software development platform that puts an entire AI dev team at your
						disposal. It goes beyond simple code autocompletion by reading and writing across multiple
						files, executing commands, running tests, and adapting to your workflow.
					</p>
					<p className="text-lg text-muted-foreground leading-relaxed">
						<Link href="/cloud" className="text-primary underline-offset-4 hover:underline">
							Roo Code Cloud
						</Link>{" "}
						gives you autonomous AI agents that run 24/7 in the background. The{" "}
						<Link href="/extension" className="text-primary underline-offset-4 hover:underline">
							Roo Code VS Code Extension
						</Link>{" "}
						is free, open-source, and the #1 most-installed open-source AI coding extension.
					</p>
				</div>
			</section>

			{/* Two Form Factors */}
			<section className="py-16 md:py-24 bg-muted/30 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-center">
						Two products, one platform
					</h2>
					<p className="text-xl text-muted-foreground text-center max-w-2xl mx-auto mb-12">
						Use Cloud to delegate tasks to autonomous agents. Use the extension for hands-on work.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<div className="rounded-2xl bg-card border border-border p-8 shadow-sm">
							<div className="flex items-center gap-3 mb-4">
								<div className="rounded-lg bg-violet-100 dark:bg-violet-900/20 p-2.5">
									<Cloud className="h-6 w-6 text-violet-600 dark:text-violet-400" />
								</div>
								<h3 className="text-2xl font-bold">Roo Code Cloud</h3>
							</div>
							<p className="font-semibold text-violet-600 dark:text-violet-400 mb-3">
								For autonomous team work
							</p>
							<p className="text-muted-foreground mb-4 leading-relaxed">
								Create your agent team in the cloud, give them access to GitHub, and start delegating
								tasks from the web, Slack, Linear, or GitHub. Use agents like the Planner, Coder,
								Explainer, PR Reviewer, and PR Fixer.
							</p>
							<p className="text-muted-foreground mb-6 leading-relaxed">
								Ideal for parallelizing execution, kicking off projects, and looping in the rest of your
								team.
							</p>
							<Button size="sm" variant="outline" asChild>
								<Link href="/cloud" className="flex items-center gap-2">
									Learn more
									<ArrowRight className="h-3 w-3" />
								</Link>
							</Button>
						</div>

						<div className="rounded-2xl bg-card border border-border p-8 shadow-sm">
							<div className="flex items-center gap-3 mb-4">
								<div className="rounded-lg bg-blue-100 dark:bg-blue-900/20 p-2.5">
									<Laptop className="h-6 w-6 text-blue-600 dark:text-blue-400" />
								</div>
								<h3 className="text-2xl font-bold">VS Code Extension</h3>
							</div>
							<p className="font-semibold text-blue-600 dark:text-blue-400 mb-3">
								For interactive, hands-on work
							</p>
							<p className="text-muted-foreground mb-4 leading-relaxed">
								Run Roo directly in VS Code (or any fork, including Cursor). Stay close to the code and
								control everything: approve every action, manage the context window, preview changes
								live, and write code by hand when you want to.
							</p>
							<p className="text-muted-foreground mb-6 leading-relaxed">
								Ideal for real-time debugging, quick iteration, and hands-on development where you need
								full, immediate control.
							</p>
							<Button size="sm" variant="outline" asChild>
								<Link href="/extension" className="flex items-center gap-2">
									Learn more
									<ArrowRight className="h-3 w-3" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Key Capabilities */}
			<section className="py-16 md:py-24 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-center">Key capabilities</h2>
					<p className="text-xl text-muted-foreground text-center max-w-2xl mx-auto mb-12">
						What makes Roo Code different from other AI coding tools.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						<div className="rounded-xl border border-border bg-card p-6">
							<Brain className="h-8 w-8 text-violet-600 dark:text-violet-400 mb-4" strokeWidth={1.5} />
							<h3 className="text-lg font-bold mb-2">Model-Agnostic</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Works with OpenAI, Anthropic Claude, Google Gemini, Grok, DeepSeek, Mistral, Qwen, local
								LLMs via Ollama, and any model through OpenRouter. No vendor lock-in. Use the{" "}
								<Link href="/provider" className="text-primary underline-offset-4 hover:underline">
									Roo Code Router
								</Link>{" "}
								at cost or bring your own API key.
							</p>
						</div>

						<div className="rounded-xl border border-border bg-card p-6">
							<Users2 className="h-8 w-8 text-violet-600 dark:text-violet-400 mb-4" strokeWidth={1.5} />
							<h3 className="text-lg font-bold mb-2">Custom Modes</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Specialized modes stay on task: Architect plans without coding, Code implements, Ask
								explains, Debug diagnoses, Test writes tests, and Orchestrator coordinates large tasks.
								Create your own modes or download from the marketplace.
							</p>
						</div>

						<div className="rounded-xl border border-border bg-card p-6">
							<Shield className="h-8 w-8 text-violet-600 dark:text-violet-400 mb-4" strokeWidth={1.5} />
							<h3 className="text-lg font-bold mb-2">Permission-Based Control</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								You approve every file change and command execution. Configure granular auto-approval
								rules to make Roo as autonomous as you want. Nothing runs without your say-so.
							</p>
						</div>

						<div className="rounded-xl border border-border bg-card p-6">
							<Code className="h-8 w-8 text-violet-600 dark:text-violet-400 mb-4" strokeWidth={1.5} />
							<h3 className="text-lg font-bold mb-2">Multi-File Editing</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Goes beyond single-file autocomplete. Roo Code reads, refactors, and updates multiple
								files at once for holistic code changes. It can also run terminal commands, execute
								tests, and open a browser for integration testing.
							</p>
						</div>

						<div className="rounded-xl border border-border bg-card p-6">
							<Workflow className="h-8 w-8 text-violet-600 dark:text-violet-400 mb-4" strokeWidth={1.5} />
							<h3 className="text-lg font-bold mb-2">Large Task Coordination</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Orchestrator mode handles large tasks by breaking them into subtasks and coordinating
								across other modes. It can run for hours, delegating work to Architect, Code, and Test
								modes as needed.
							</p>
						</div>

						<div className="rounded-xl border border-border bg-card p-6">
							<Keyboard className="h-8 w-8 text-violet-600 dark:text-violet-400 mb-4" strokeWidth={1.5} />
							<h3 className="text-lg font-bold mb-2">Open Source &amp; Auditable</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Fully open source on{" "}
								<a
									href={EXTERNAL_LINKS.GITHUB}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary underline-offset-4 hover:underline">
									GitHub
								</a>
								. Community-driven with no throttling or surprises. Cloud Agents run in isolated
								containers; the extension runs locally. SOC 2 Type II compliant.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Modes */}
			<section className="py-16 md:py-24 bg-muted/30 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-center">
						Built-in modes for every task
					</h2>
					<p className="text-xl text-muted-foreground text-center max-w-2xl mx-auto mb-12">
						Each mode is specialized for a type of work, staying focused and delivering better results.
					</p>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{modes.map((mode) => {
							const Icon = mode.icon
							return (
								<div
									key={mode.name}
									className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
									<div className="rounded-lg bg-violet-100 dark:bg-violet-900/20 p-2 shrink-0">
										<Icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
									</div>
									<div>
										<h3 className="font-bold mb-1">{mode.name}</h3>
										<p className="text-sm text-muted-foreground">{mode.description}</p>
									</div>
								</div>
							)
						})}
					</div>

					<p className="text-center text-muted-foreground mt-8">
						You can also{" "}
						<a
							href={EXTERNAL_LINKS.DOCUMENTATION}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary underline-offset-4 hover:underline">
							create your own custom modes
						</a>{" "}
						or download community-built modes from the marketplace.
					</p>
				</div>
			</section>

			{/* Who Uses Roo Code */}
			<section className="py-16 md:py-24 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-center">
						Who uses Roo Code
					</h2>
					<p className="text-xl text-muted-foreground text-center max-w-2xl mx-auto mb-12">
						From solo developers to large enterprise teams.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<div className="text-center md:text-left">
							<h3 className="text-xl font-bold mb-3">Development Teams</h3>
							<p className="text-muted-foreground leading-relaxed">
								Roo Code Cloud lets teams delegate work to autonomous agents. Get PR reviews
								automatically, fix review comments with a single GitHub mention, and create tasks from
								Slack or Linear. Centralized billing and shared configuration keep everyone aligned.
							</p>
						</div>

						<div className="text-center md:text-left">
							<h3 className="text-xl font-bold mb-3">Enterprises</h3>
							<p className="text-muted-foreground leading-relaxed">
								The{" "}
								<Link href="/enterprise" className="text-primary underline-offset-4 hover:underline">
									enterprise control-plane
								</Link>{" "}
								provides centralized AI management, SAML/SCIM, usage analytics, model allow-lists, cost
								controls, and audit trails. Self-host AI models or use trusted providers for compliance.
							</p>
						</div>

						<div className="text-center md:text-left">
							<h3 className="text-xl font-bold mb-3">Individual Developers</h3>
							<p className="text-muted-foreground leading-relaxed">
								Use the free VS Code extension with your favorite AI model for hands-on coding. Or sign
								up for Cloud to kick off tasks from anywhere. Great for both serious work and casual
								prototyping.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Getting Started */}
			<section className="py-16 md:py-24 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-center">Getting started</h2>
					<p className="text-xl text-muted-foreground text-center max-w-2xl mx-auto mb-12">
						Up and running in under two minutes.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
						<div className="text-center">
							<div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-bold mb-4">
								1
							</div>
							<h3 className="font-bold mb-2">Sign up for free</h3>
							<p className="text-sm text-muted-foreground">
								Create your{" "}
								<a
									href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary underline-offset-4 hover:underline">
									Roo Code Cloud
								</a>{" "}
								account. No credit card needed.
							</p>
						</div>

						<div className="text-center">
							<div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-bold mb-4">
								2
							</div>
							<h3 className="font-bold mb-2">Connect GitHub</h3>
							<p className="text-sm text-muted-foreground">
								Pick which repos your agents can work with, choose your model, and configure your agent
								team. Use the{" "}
								<Link href="/provider" className="text-primary underline-offset-4 hover:underline">
									Roo Code Router
								</Link>{" "}
								or bring your own API key.
							</p>
						</div>

						<div className="text-center">
							<div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-bold mb-4">
								3
							</div>
							<h3 className="font-bold mb-2">Start delegating</h3>
							<p className="text-sm text-muted-foreground">
								Give tasks to your agents from the web, Slack, or Linear. Or{" "}
								<a
									href={EXTERNAL_LINKS.MARKETPLACE}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary underline-offset-4 hover:underline">
									install the VS Code extension
								</a>{" "}
								for hands-on coding.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* FAQ */}
			<section className="py-16 md:py-24 bg-muted/30 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-12 text-center">
						Frequently asked questions
					</h2>

					<div className="space-y-6">
						{faqData.map((faq) => (
							<div key={faq.question} className="rounded-xl border border-border bg-card p-6">
								<h3 className="font-bold text-lg mb-2">{faq.question}</h3>
								<p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
							</div>
						))}
					</div>

					<p className="text-center text-muted-foreground mt-8">
						Have more questions? Check out the{" "}
						<a
							href={EXTERNAL_LINKS.DOCUMENTATION}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary underline-offset-4 hover:underline">
							documentation
						</a>{" "}
						or join the{" "}
						<a
							href={EXTERNAL_LINKS.DISCORD}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary underline-offset-4 hover:underline">
							Discord community
						</a>
						.
					</p>
				</div>
			</section>

			{/* CTA */}
			<section className="py-24 border-t border-border">
				<div className="container px-4 mx-auto sm:px-6 lg:px-8 text-center">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Ready to try Roo Code?</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
						Cloud Agents start free. The VS Code extension is free and open source.
					</p>

					<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
						<Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base" asChild>
							<a
								href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2">
								Try Cloud for Free
								<ArrowRight className="h-4 w-4" />
							</a>
						</Button>
						<Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base" asChild>
							<a
								href={EXTERNAL_LINKS.MARKETPLACE}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2">
								<Download className="h-4 w-4" />
								Install on VS Code
							</a>
						</Button>
					</div>
				</div>
			</section>
		</>
	)
}
