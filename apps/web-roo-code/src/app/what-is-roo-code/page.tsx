import type { Metadata } from "next"
import Link from "next/link"
import {
	ArrowRight,
	Brain,
	Bug,
	CheckCircle,
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
	"Roo Code is a free, open-source AI coding assistant for VS Code and an autonomous cloud agent platform. Model-agnostic, multi-file editing, permission-based control, and more."
const OG_DESCRIPTION = "The open-source AI dev team for VS Code and the Cloud"
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
		question: "Is Roo Code free?",
		answer: "Yes. The Roo Code VS Code extension is completely free and open source. You only pay for AI model usage if you use a paid API (like OpenAI or Anthropic). If you choose free or self-hosted models, there is no cost at all. Roo Code Cloud has both free and paid tiers.",
	},
	{
		question: "Which AI models does Roo Code support?",
		answer: "Roo Code is fully model-agnostic. It supports OpenAI models (GPT-4o, GPT-4, o1), Anthropic Claude (including Claude 3.5 Sonnet), Google Gemini, Grok, DeepSeek, Mistral, Qwen, local LLMs via Ollama, and any model accessible through OpenRouter or compatible APIs.",
	},
	{
		question: "Will my code stay private?",
		answer: "Yes. The Roo Code extension runs locally in VS Code, so your code never leaves your machine unless you connect to an external AI API. Even then, you control exactly what is sent. You can use .rooignore to exclude sensitive files, and you can run with offline/local models for full privacy.",
	},
	{
		question: "How does Roo Code differ from Copilot, Cursor, or Windsurf?",
		answer: "Roo Code is open-source and fully customizable, letting you integrate any AI model you choose. It is built for multi-file edits, so it can read, refactor, and update multiple files at once. Its agentic abilities go beyond typical AI autocomplete, enabling it to run tests, open a browser, and handle deeper tasks. You are always in control: Roo Code is permission-based, meaning you control and approve any file changes or command executions.",
	},
	{
		question: "Does Roo Code support my programming language?",
		answer: "Likely yes. Roo Code supports Python, Java, C#, JavaScript, TypeScript, Go, Rust, and many more. Since it leverages AI model understanding, new or lesser-known languages may also work depending on model support.",
	},
	{
		question: "Can it handle large, enterprise-scale projects?",
		answer: "Yes. Roo Code uses efficient strategies like partial-file analysis, summarization, and configurable semantic search to handle large codebases. Enterprises can use on-premises or self-hosted models for compliance and security needs. SOC 2 Type II compliant.",
	},
]

const comparisons = [
	{
		name: "Open Source",
		rooCode: true,
		copilot: false,
		cursor: false,
		windsurf: false,
	},
	{
		name: "Model-Agnostic",
		rooCode: true,
		copilot: false,
		cursor: false,
		windsurf: false,
	},
	{
		name: "Multi-File Agentic Editing",
		rooCode: true,
		copilot: false,
		cursor: true,
		windsurf: true,
	},
	{
		name: "Custom Modes",
		rooCode: true,
		copilot: false,
		cursor: false,
		windsurf: false,
	},
	{
		name: "Permission-Based Control",
		rooCode: true,
		copilot: false,
		cursor: false,
		windsurf: false,
	},
	{
		name: "Autonomous Cloud Agents",
		rooCode: true,
		copilot: false,
		cursor: false,
		windsurf: false,
	},
	{
		name: "Works in VS Code (any fork)",
		rooCode: true,
		copilot: true,
		cursor: false,
		windsurf: false,
	},
	{
		name: "Bring Your Own API Key",
		rooCode: true,
		copilot: false,
		cursor: true,
		windsurf: false,
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
			<section className="relative pt-20 pb-16 md:pt-28 md:pb-20">
				<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-0">
					<div className="absolute left-1/2 top-1/2 h-[400px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 dark:bg-violet-700/20 blur-[140px]" />
				</div>
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6 text-center">
						What is Roo Code?
					</h1>
					<p className="text-xl text-muted-foreground text-center max-w-3xl mx-auto mb-8 leading-relaxed">
						Roo Code is an AI-powered software development platform that puts an entire AI dev team at your
						disposal. It goes beyond simple code autocompletion by reading and writing across multiple
						files, executing commands, running tests, and adapting to your workflow.
					</p>
					<p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-10 leading-relaxed">
						The{" "}
						<Link href="/extension" className="text-primary underline-offset-4 hover:underline">
							Roo Code VS Code Extension
						</Link>{" "}
						is free, open-source, and the #1 most-installed open-source AI coding extension.{" "}
						<Link href="/cloud" className="text-primary underline-offset-4 hover:underline">
							Roo Code Cloud
						</Link>{" "}
						extends this with autonomous AI agents that run 24/7 in the background.
					</p>
					<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
						<Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base" asChild>
							<a
								href={EXTERNAL_LINKS.MARKETPLACE}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2">
								<Download className="h-4 w-4" />
								Install on VS Code
							</a>
						</Button>
						<Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base" asChild>
							<a
								href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2">
								Try Cloud for Free
								<ArrowRight className="h-4 w-4" />
							</a>
						</Button>
					</div>
				</div>
			</section>

			{/* Two Form Factors */}
			<section className="py-16 md:py-24 bg-muted/30 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-center">
						Two products, one platform
					</h2>
					<p className="text-xl text-muted-foreground text-center max-w-2xl mx-auto mb-12">
						Use the extension for hands-on work. Use Cloud to delegate tasks to autonomous agents.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
								. Community-driven with no throttling or surprises. Client-only architecture means no
								code leaves your machine unless you choose. SOC 2 Type II compliant.
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
							<h3 className="text-xl font-bold mb-3">Individual Developers</h3>
							<p className="text-muted-foreground leading-relaxed">
								Use the free VS Code extension with your favorite AI model. Roo Code handles
								refactoring, debugging, test writing, and code exploration. Great for both serious
								enterprise work and casual &ldquo;vibe coding&rdquo; -- quick prototyping, rapid
								iteration, and design exploration.
							</p>
						</div>

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
					</div>
				</div>
			</section>

			{/* Comparison Table */}
			<section className="py-16 md:py-24 bg-muted/30 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-center">
						How Roo Code compares
					</h2>
					<p className="text-xl text-muted-foreground text-center max-w-2xl mx-auto mb-12">
						A factual comparison with other popular AI coding tools.
					</p>

					<div className="overflow-x-auto rounded-xl border border-border bg-card">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border">
									<th className="text-left p-4 font-semibold">Feature</th>
									<th className="text-center p-4 font-semibold text-violet-600 dark:text-violet-400">
										Roo Code
									</th>
									<th className="text-center p-4 font-semibold">GitHub Copilot</th>
									<th className="text-center p-4 font-semibold">Cursor</th>
									<th className="text-center p-4 font-semibold">Windsurf</th>
								</tr>
							</thead>
							<tbody>
								{comparisons.map((row) => (
									<tr key={row.name} className="border-b border-border/50 last:border-0">
										<td className="p-4 font-medium">{row.name}</td>
										<td className="text-center p-4">
											{row.rooCode ? (
												<CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
											) : (
												<span className="text-muted-foreground">&#8212;</span>
											)}
										</td>
										<td className="text-center p-4">
											{row.copilot ? (
												<CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
											) : (
												<span className="text-muted-foreground">&#8212;</span>
											)}
										</td>
										<td className="text-center p-4">
											{row.cursor ? (
												<CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
											) : (
												<span className="text-muted-foreground">&#8212;</span>
											)}
										</td>
										<td className="text-center p-4">
											{row.windsurf ? (
												<CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
											) : (
												<span className="text-muted-foreground">&#8212;</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
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
							<h3 className="font-bold mb-2">Install the extension</h3>
							<p className="text-sm text-muted-foreground">
								Get Roo Code from the{" "}
								<a
									href={EXTERNAL_LINKS.MARKETPLACE}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary underline-offset-4 hover:underline">
									VS Code Marketplace
								</a>{" "}
								or search &ldquo;Roo Code&rdquo; in VS Code extensions.
							</p>
						</div>

						<div className="text-center">
							<div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-bold mb-4">
								2
							</div>
							<h3 className="font-bold mb-2">Add your API key</h3>
							<p className="text-sm text-muted-foreground">
								Connect OpenAI, Anthropic, or any supported provider. Or use the{" "}
								<Link href="/provider" className="text-primary underline-offset-4 hover:underline">
									Roo Code Router
								</Link>{" "}
								for curated models at cost.
							</p>
						</div>

						<div className="text-center">
							<div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-bold mb-4">
								3
							</div>
							<h3 className="font-bold mb-2">Start building</h3>
							<p className="text-sm text-muted-foreground">
								Open the Roo panel in VS Code and describe what you want in plain English. Check out the{" "}
								<a
									href={EXTERNAL_LINKS.TUTORIALS}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary underline-offset-4 hover:underline">
									tutorial videos
								</a>{" "}
								to get started.
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
						The extension is free and open source. Cloud agents start free too.
					</p>

					<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
						<Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base" asChild>
							<a
								href={EXTERNAL_LINKS.MARKETPLACE}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2">
								<Download className="h-4 w-4" />
								Install on VS Code
							</a>
						</Button>
						<Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base" asChild>
							<a
								href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2">
								Try Cloud for Free
								<ArrowRight className="h-4 w-4" />
							</a>
						</Button>
					</div>
				</div>
			</section>
		</>
	)
}
