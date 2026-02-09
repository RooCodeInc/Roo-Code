import type { Metadata } from "next"
import Link from "next/link"
import {
	ArrowRight,
	Brain,
	Bug,
	Check,
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
} from "lucide-react"

import { Button } from "@/components/ui"
import { FAQSection, CTASection } from "@/components/homepage"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { EXTERNAL_LINKS } from "@/lib/constants"

const TITLE = "What is Roo Code? AI Coding Agent for VS Code & Cloud"
const DESCRIPTION =
	"Roo Code is an open-source, AI-powered coding agent that runs in VS Code and the cloud. Learn how it works, what makes it different from Copilot and Cursor, and how to get started."
const OG_DESCRIPTION = "The open-source AI coding agent for VS Code and the Cloud"
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
		"roo code review",
		"roo code vs copilot",
		"roo code vs cursor",
		"roo code vs windsurf",
		"open source AI coding assistant",
		"AI pair programmer VS Code",
		"AI coding agent free",
		"best AI coding tool",
	],
}

const modes = [
	{
		name: "Architect",
		description: "Plans complex changes and designs system architecture without modifying code.",
		icon: Map,
	},
	{
		name: "Code",
		description: "Implements, refactors, and optimizes code across multiple files.",
		icon: Code,
	},
	{
		name: "Ask",
		description: "Explains functionality, answers questions, and analyzes existing code.",
		icon: MessageCircleQuestion,
	},
	{
		name: "Debug",
		description: "Diagnoses issues, traces failures, and proposes targeted fixes.",
		icon: Bug,
	},
	{
		name: "Test",
		description: "Creates and improves tests without changing the actual functionality.",
		icon: TestTube,
	},
]

const providers = [
	"OpenAI",
	"Anthropic",
	"Google Gemini",
	"DeepSeek",
	"Mistral",
	"xAI (Grok)",
	"Qwen",
	"Ollama (local)",
	"OpenRouter",
	"Amazon Bedrock",
]

// AboutPage + Article structured data for answer engines
function WhatIsRooCodeStructuredData() {
	const structuredData = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "AboutPage",
				"@id": `${SEO.url}${PATH}#aboutpage`,
				url: `${SEO.url}${PATH}`,
				name: TITLE,
				description: DESCRIPTION,
				isPartOf: { "@id": `${SEO.url}#website` },
				publisher: { "@id": `${SEO.url}#org` },
			},
			{
				"@type": "Article",
				"@id": `${SEO.url}${PATH}#article`,
				headline: "What is Roo Code?",
				description: DESCRIPTION,
				url: `${SEO.url}${PATH}`,
				publisher: { "@id": `${SEO.url}#org` },
				isPartOf: { "@id": `${SEO.url}${PATH}#aboutpage` },
				about: {
					"@type": "SoftwareApplication",
					"@id": `${SEO.url}#vscode-extension`,
				},
				speakable: {
					"@type": "SpeakableSpecification",
					cssSelector: ["#what-is-roo-code", "#why-roo-code"],
				},
			},
		],
	}

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(structuredData),
			}}
		/>
	)
}

export default function WhatIsRooCode() {
	return (
		<>
			<WhatIsRooCodeStructuredData />

			{/* Hero Section */}
			<section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
				<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
					<div className="absolute left-1/2 top-1/2 h-[400px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 dark:bg-violet-700/20 blur-[140px]" />
				</div>
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
					<h1 className="text-4xl font-bold tracking-tight text-center md:text-5xl mb-6">
						What is Roo Code?
					</h1>
					<p className="text-xl text-muted-foreground text-center max-w-3xl mx-auto">
						Roo Code is an open-source, AI-powered coding agent that puts an entire AI dev team right in
						your editor and in the cloud.
					</p>
				</div>
			</section>

			{/* Overview Section */}
			<section id="what-is-roo-code" className="py-16 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
					<div className="prose prose-lg dark:prose-invert max-w-none">
						<p className="text-lg text-muted-foreground leading-relaxed">
							Roo Code goes far beyond simple autocompletion. It reads and writes across multiple files,
							executes terminal commands, runs your tests, opens a browser for integration testing, and
							adapts to the way you work. Think of it as having a team of specialized AI developers
							working for you, both in the cloud and inside your editor.
						</p>
						<p className="text-lg text-muted-foreground leading-relaxed mt-4">
							<Link href="/cloud" className="text-primary underline-offset-4 hover:underline">
								Roo Code Cloud
							</Link>{" "}
							provides autonomous AI agents that handle tasks like planning, coding, PR review, and PR
							fixing -- triggered from the web, Slack, Linear, or GitHub. Delegate work to your AI team
							and get results back as pull requests, without being tied to your IDE.
						</p>
						<p className="text-lg text-muted-foreground leading-relaxed mt-4">
							The{" "}
							<Link href="/extension" className="text-primary underline-offset-4 hover:underline">
								Roo Code VS Code Extension
							</Link>{" "}
							is completely free and open-source under the Apache 2.0 license. It works with any AI model
							you choose -- from OpenAI and Anthropic to local models running on your own machine via
							Ollama. Your code stays on your machine unless you explicitly connect to an external API.
						</p>
					</div>
				</div>
			</section>

			{/* Key Capabilities */}
			<section className="py-16 bg-muted/30 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<h2 className="text-3xl font-bold tracking-tight text-center mb-4">What can Roo Code do?</h2>
					<p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
						Roo Code combines deep project understanding with agentic capabilities that go well beyond
						autocomplete.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="bg-background rounded-2xl border border-border p-6">
							<h3 className="text-xl font-semibold mb-3">Multi-file editing</h3>
							<p className="text-muted-foreground">
								Reads, refactors, and updates multiple files at once for holistic code changes.
								Understands your entire codebase structure, not just the current file.
							</p>
						</div>
						<div className="bg-background rounded-2xl border border-border p-6">
							<h3 className="text-xl font-semibold mb-3">Terminal command execution</h3>
							<p className="text-muted-foreground">
								Runs commands like npm install, executes your test suites, and manages build tools --
								always with your permission or auto-approval if you choose.
							</p>
						</div>
						<div className="bg-background rounded-2xl border border-border p-6">
							<h3 className="text-xl font-semibold mb-3">Browser testing</h3>
							<p className="text-muted-foreground">
								Can open a web browser for integration testing and visual verification of changes when
								approved.
							</p>
						</div>
						<div className="bg-background rounded-2xl border border-border p-6">
							<h3 className="text-xl font-semibold mb-3">Deep project context</h3>
							<p className="text-muted-foreground">
								Uses efficient strategies like partial-file analysis and summarization to understand
								large codebases. Works well with enterprise-scale projects.
							</p>
						</div>
						<div className="bg-background rounded-2xl border border-border p-6">
							<h3 className="text-xl font-semibold mb-3">Permission-based control</h3>
							<p className="text-muted-foreground">
								Every file change and command execution requires your approval. Nothing runs without
								your explicit permission, keeping you in full control.
							</p>
						</div>
						<div className="bg-background rounded-2xl border border-border p-6">
							<h3 className="text-xl font-semibold mb-3">Extensible via MCP</h3>
							<p className="text-muted-foreground">
								The Model Context Protocol lets you extend Roo Code with custom tools and resources,
								connecting it to databases, APIs, and other systems.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Role-Specific Modes */}
			<section className="py-16 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<div className="flex items-start gap-4 mb-4">
						<Users2 className="size-8 text-violet-600 shrink-0 mt-1 hidden md:block" strokeWidth={1.5} />
						<div>
							<h2 className="text-3xl font-bold tracking-tight">Role-specific modes</h2>
							<p className="text-lg text-muted-foreground mt-2 max-w-2xl">
								Modes keep AI models focused on a given task and limit their access to tools relevant to
								their role. This keeps the context window clearer and avoids surprises. Modes are smart
								enough to request switching to another mode when stepping outside their
								responsibilities.
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
						{modes.map((mode) => {
							const Icon = mode.icon
							return (
								<div
									key={mode.name}
									className="rounded-xl border border-border bg-background p-5 flex gap-3">
									<Icon className="text-violet-600 size-5 shrink-0 mt-0.5" />
									<div>
										<h3 className="font-semibold">{mode.name}</h3>
										<p className="text-sm text-muted-foreground mt-1">{mode.description}</p>
									</div>
								</div>
							)
						})}
						<div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 flex items-center justify-center">
							<p className="text-sm text-muted-foreground text-center">
								Plus <strong className="text-foreground">custom modes</strong> you create with their own
								prompts, tools, and file restrictions.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Model-Agnostic */}
			<section className="py-16 bg-muted/30 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<div className="flex items-start gap-4 mb-4">
						<Brain className="size-8 text-violet-600 shrink-0 mt-1 hidden md:block" strokeWidth={1.5} />
						<div>
							<h2 className="text-3xl font-bold tracking-tight">Model-agnostic by design</h2>
							<p className="text-lg text-muted-foreground mt-2 max-w-3xl">
								&ldquo;The best model in the world&rdquo; changes every other week. Providers throttle
								models with no warning. First-party coding agents only work with their own models. Roo
								Code works with dozens of models and providers, so you are never locked in.
							</p>
						</div>
					</div>

					<div className="mt-8 flex flex-wrap gap-3">
						{providers.map((provider) => (
							<span
								key={provider}
								className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium">
								{provider}
							</span>
						))}
						<span className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
							+ many more
						</span>
					</div>

					<p className="text-muted-foreground mt-6">
						Bring your own API key from any provider, or use the{" "}
						<Link href="/provider" className="text-primary underline-offset-4 hover:underline">
							Roo Code Router
						</Link>{" "}
						for at-cost access to top models with no markup.
					</p>
				</div>
			</section>

			{/* How Roo Code Works: Extension vs Cloud */}
			<section className="py-16 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<h2 className="text-3xl font-bold tracking-tight text-center mb-4">
						Two ways to work with Roo Code
					</h2>
					<p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
						Delegate to cloud agents for autonomous work, or use the extension for hands-on control.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<div className="rounded-2xl bg-background border border-border p-8">
							<div className="flex items-center gap-3 mb-4">
								<div className="size-12 rounded-full bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
									<Cloud className="size-6 text-violet-600 dark:text-violet-400" strokeWidth={1.5} />
								</div>
								<div>
									<h3 className="text-xl font-bold">Cloud Agents</h3>
									<p className="text-sm text-violet-600 dark:text-violet-400 font-medium">
										For autonomous work
									</p>
								</div>
							</div>
							<p className="text-muted-foreground mb-4">
								Create your agent team in the cloud, give them access to GitHub, and start delegating
								tasks:
							</p>
							<ul className="space-y-2 text-muted-foreground">
								<li className="flex items-start gap-2">
									<Check className="size-4 shrink-0 mt-1 text-violet-500" />
									<span>Agents: Planner, Coder, Explainer, Reviewer, Fixer</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="size-4 shrink-0 mt-1 text-violet-500" />
									<span>Trigger tasks from the web, Slack, Linear, or GitHub</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="size-4 shrink-0 mt-1 text-violet-500" />
									<span>Get PR reviews and fixes automatically</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="size-4 shrink-0 mt-1 text-violet-500" />
									<span>Collaborate with your team on shared tasks</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="size-4 shrink-0 mt-1 text-violet-500" />
									<span>Track usage and costs with analytics</span>
								</li>
							</ul>
							<div className="mt-6">
								<Button
									size="lg"
									className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white">
									<a
										href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
										className="flex items-center justify-center gap-2">
										Try Cloud for Free
										<ArrowRight className="size-4" />
									</a>
								</Button>
							</div>
						</div>

						<div className="rounded-2xl bg-background border border-border p-8">
							<div className="flex items-center gap-3 mb-4">
								<div className="size-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
									<Laptop className="size-6 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
								</div>
								<div>
									<h3 className="text-xl font-bold">VS Code Extension</h3>
									<p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
										For interactive work
									</p>
								</div>
							</div>
							<p className="text-muted-foreground mb-4">
								Run Roo directly in VS Code (or any fork, including Cursor), stay close to the code, and
								control everything:
							</p>
							<ul className="space-y-2 text-muted-foreground">
								<li className="flex items-start gap-2">
									<Check className="size-4 shrink-0 mt-1 text-blue-500" />
									<span>Approve every action or set auto-approval</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="size-4 shrink-0 mt-1 text-blue-500" />
									<span>Manage the context window directly</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="size-4 shrink-0 mt-1 text-blue-500" />
									<span>Configure every detail of the AI behavior</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="size-4 shrink-0 mt-1 text-blue-500" />
									<span>Preview changes live in your editor</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="size-4 shrink-0 mt-1 text-blue-500" />
									<span>Works with your existing VS Code setup</span>
								</li>
							</ul>
							<div className="mt-6">
								<Button size="lg" className="w-full sm:w-auto">
									<a
										href={EXTERNAL_LINKS.MARKETPLACE}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center justify-center gap-2">
										<Download className="size-4" />
										Install Free Extension
									</a>
								</Button>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Why Roo Code / Differentiators */}
			<section id="why-roo-code" className="py-16 bg-muted/30 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
					<h2 className="text-3xl font-bold tracking-tight text-center mb-4">
						Why developers choose Roo Code
					</h2>
					<p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
						What sets Roo Code apart.
					</p>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						<div className="text-center p-6">
							<div className="size-14 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
								<Code className="size-7 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
							</div>
							<h3 className="font-semibold text-lg mb-2">Open source</h3>
							<p className="text-sm text-muted-foreground">
								Fully auditable under the Apache 2.0 license. See exactly how it works and contribute to
								its development.
							</p>
						</div>
						<div className="text-center p-6">
							<div className="size-14 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
								<Brain className="size-7 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
							</div>
							<h3 className="font-semibold text-lg mb-2">Not locked to one model</h3>
							<p className="text-sm text-muted-foreground">
								Use any AI provider. Switch models freely. Bring your own key or use the Roo Code Router
								at cost.
							</p>
						</div>
						<div className="text-center p-6">
							<div className="size-14 mx-auto mb-4 rounded-full bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
								<Users2 className="size-7 text-violet-600 dark:text-violet-400" strokeWidth={1.5} />
							</div>
							<h3 className="font-semibold text-lg mb-2">Modes keep agents focused</h3>
							<p className="text-sm text-muted-foreground">
								Role-specific modes limit what the AI can do, keeping it on task and avoiding unintended
								side effects.
							</p>
						</div>
						<div className="text-center p-6">
							<div className="size-14 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
								<Keyboard className="size-7 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
							</div>
							<h3 className="font-semibold text-lg mb-2">Highly configurable</h3>
							<p className="text-sm text-muted-foreground">
								Custom modes, system prompts, auto-approval rules, keyboard shortcuts, and .rooignore
								for sensitive files.
							</p>
						</div>
						<div className="text-center p-6">
							<div className="size-14 mx-auto mb-4 rounded-full bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
								<Shield className="size-7 text-rose-600 dark:text-rose-400" strokeWidth={1.5} />
							</div>
							<h3 className="font-semibold text-lg mb-2">Private and secure</h3>
							<p className="text-sm text-muted-foreground">
								Code stays local. Permission-based execution. SOC2 Type 2 compliant. Works fully offline
								with local models.
							</p>
						</div>
						<div className="text-center p-6">
							<div className="size-14 mx-auto mb-4 rounded-full bg-cyan-100 dark:bg-cyan-900/20 flex items-center justify-center">
								<Cloud className="size-7 text-cyan-600 dark:text-cyan-400" strokeWidth={1.5} />
							</div>
							<h3 className="font-semibold text-lg mb-2">IDE + Cloud</h3>
							<p className="text-sm text-muted-foreground">
								Work interactively in VS Code or delegate to autonomous cloud agents. No other tool
								offers both.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Getting Started */}
			<section className="py-16 border-t border-border">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
					<h2 className="text-3xl font-bold tracking-tight text-center mb-12">Get started in 2 minutes</h2>

					<div className="space-y-6">
						<div className="flex gap-4 items-start">
							<div className="size-8 shrink-0 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-bold">
								1
							</div>
							<div>
								<h3 className="font-semibold text-lg">Install the extension</h3>
								<p className="text-muted-foreground mt-1">
									Search for &ldquo;Roo Code&rdquo; in the VS Code Marketplace or{" "}
									<a
										href={EXTERNAL_LINKS.MARKETPLACE}
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary underline-offset-4 hover:underline">
										install it directly
									</a>
									. It works in VS Code and any fork, including Cursor.
								</p>
							</div>
						</div>
						<div className="flex gap-4 items-start">
							<div className="size-8 shrink-0 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-bold">
								2
							</div>
							<div>
								<h3 className="font-semibold text-lg">Add your AI API key</h3>
								<p className="text-muted-foreground mt-1">
									Connect any supported provider (OpenAI, Anthropic, Google, etc.) in the extension
									settings, or use the{" "}
									<Link href="/provider" className="text-primary underline-offset-4 hover:underline">
										Roo Code Router
									</Link>{" "}
									for at-cost model access.
								</p>
							</div>
						</div>
						<div className="flex gap-4 items-start">
							<div className="size-8 shrink-0 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-bold">
								3
							</div>
							<div>
								<h3 className="font-semibold text-lg">Start coding with AI</h3>
								<p className="text-muted-foreground mt-1">
									Open the Roo Code panel in VS Code and start typing commands in plain English.
									Choose a mode (Code, Architect, Debug, etc.) and let Roo help you build.
								</p>
							</div>
						</div>
						<div className="flex gap-4 items-start">
							<div className="size-8 shrink-0 rounded-full border-2 border-violet-600 text-violet-600 flex items-center justify-center text-sm font-bold">
								+
							</div>
							<div>
								<h3 className="font-semibold text-lg">Try Cloud Agents (optional)</h3>
								<p className="text-muted-foreground mt-1">
									<a
										href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
										className="text-primary underline-offset-4 hover:underline">
										Sign up for Roo Code Cloud
									</a>{" "}
									to access autonomous agents that handle tasks from the web, Slack, Linear, and
									GitHub.
								</p>
							</div>
						</div>
					</div>

					<div className="mt-10 text-center">
						<p className="text-muted-foreground">
							Need help getting started?{" "}
							<a
								href={EXTERNAL_LINKS.TUTORIALS}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary underline-offset-4 hover:underline">
								Watch our tutorials
							</a>{" "}
							or visit the{" "}
							<a
								href={EXTERNAL_LINKS.DOCUMENTATION}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary underline-offset-4 hover:underline">
								documentation
							</a>
							.
						</p>
					</div>
				</div>
			</section>

			{/* FAQ */}
			<FAQSection />

			{/* CTA */}
			<CTASection />
		</>
	)
}
