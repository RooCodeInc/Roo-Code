import {
	ArrowRight,
	Users,
	Settings,
	Github,
	Slack,
	BarChart3,
	Lock,
	Puzzle,
	ShieldCheck,
	UserCog,
	DollarSign,
	Share2,
	LucideIcon,
	Server,
	FileKey,
	Building,
} from "lucide-react"
import type { Metadata } from "next"

import { Button } from "@/components/ui"
import { AnimatedBackground } from "@/components/homepage"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { EXTERNAL_LINKS } from "@/lib/constants"

const TITLE = "Roo Code Cloud Team Plan"
const DESCRIPTION =
	"Scale your development with team collaboration features. Centralized billing, shared configuration, team-wide analytics, and unified GitHub and Slack integrations."
const OG_DESCRIPTION = "Team collaboration for AI-powered development"
const PATH = "/cloud/team"

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
		"team",
		"collaboration",
		"enterprise",
		"organization",
		"centralized billing",
		"team management",
	],
}

const keyBenefits = [
	{
		title: "No Per-Seat Costs",
		description: "Add unlimited team members without worrying about escalating per-seat charges.",
		icon: Users,
	},
	{
		title: "Centralized Billing",
		description:
			"Single billing point for all team members using Cloud Agents and the Roo Code Cloud Provider. No more API key management.",
		icon: DollarSign,
	},
	{
		title: "Unified Integrations",
		description:
			"Connect GitHub and Slack once for the entire team. No need for each member to set up individual integrations.",
		icon: Settings,
	},
	{
		title: "Team-Wide Visibility",
		description: "Access task history and usage analytics across your entire team with granular per-user filters.",
		icon: BarChart3,
	},
	{
		title: "Configuration Enforcement",
		description:
			"Set policies for providers, models, and MCP servers to ensure your team follows organizational standards.",
		icon: ShieldCheck,
	},
	{
		title: "Secure Environment Variables",
		description:
			"Centrally manage secrets, API keys, and environment variables for Cloud Agents in our encrypted secret store.",
		icon: Lock,
	},
]

interface Feature {
	icon: LucideIcon
	title: string
	description: string
}

const features: Feature[] = [
	{
		icon: UserCog,
		title: "Team Member Management",
		description:
			"Invite, remove, and manage permissions for team members. Assign Admin or regular member roles to control access.",
	},
	{
		icon: Building,
		title: "Organization Profile",
		description: "Customize your organization with logo, name, and branding to create a cohesive team identity.",
	},
	{
		icon: Github,
		title: "GitHub Integration",
		description:
			"Centralized GitHub connection for the entire team. Agents can review PRs and collaborate on your repositories.",
	},
	{
		icon: Slack,
		title: "Slack Integration",
		description:
			"Connect Slack once for your organization. Team members can interact with agents directly from channels.",
	},
	{
		icon: Server,
		title: "Cloud Model Providers",
		description:
			"Configure and manage model providers for Cloud Agents with centralized API key management and team-wide access.",
	},
	{
		icon: BarChart3,
		title: "Extension Task Sync",
		description:
			"Require task syncing from VS Code Extension and control visibility settings for who can view each other's tasks.",
	},
	{
		icon: Share2,
		title: "Task Sharing Controls",
		description: "Enable per-task sharing with customizable audience controls and link expiration times.",
	},
	{
		icon: FileKey,
		title: "Environment Variables",
		description:
			"Securely store connection strings, package manager URLs, keys, and secrets for Cloud Agents in encrypted storage.",
	},
	{
		icon: Puzzle,
		title: "Marketplace MCP Management",
		description: "Create allow/deny lists for MCPs from the Roo Code marketplace available to team members.",
	},
	{
		icon: Puzzle,
		title: "Custom MCP Servers",
		description: "Deploy vetted, custom MCP servers and make them available to all team members automatically.",
	},
	{
		icon: Settings,
		title: "Extension Provider Control",
		description:
			"Manage which inference providers team members can use in the VS Code Extension with allow/deny lists.",
	},
	{
		icon: ShieldCheck,
		title: "Connection Policy Enforcement",
		description:
			"Require team members to log in to the VS Code Extension so policies can be enforced via MDM distribution.",
	},
]

export default function CloudTeamPage() {
	return (
		<>
			{/* Hero Section */}
			<section className="relative flex pt-32 pb-20 items-center overflow-hidden">
				<AnimatedBackground />
				<div className="container relative flex flex-col items-center h-full z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center max-w-4xl mx-auto mb-12">
						<h1 className="text-4xl font-bold tracking-tight mb-6 md:text-6xl">Roo Code Cloud Team</h1>
						<h2 className="text-2xl font-bold tracking-tight mb-6 md:text-4xl">
							Built for <span className="text-violet-500">AI-Forward Teams</span>
						</h2>
						<p className="text-xl text-muted-foreground mb-8 mx-auto">
							Empower your entire team with confidence with team-wide configuration, centralized billing,
							analytics and more. No per-seat costs, no API key juggling.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Button
								size="xl"
								className="bg-violet-600 hover:bg-violet-700 text-white transition-all duration-300 shadow-lg hover:shadow-violet-500/25"
								asChild>
								<a
									href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP + "?redirect_url=/checkout/team"}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-center">
									Start 14-Day Free Trial
									<ArrowRight className="ml-2 size-5" />
								</a>
							</Button>
							<Button variant="outline" size="xl" className="backdrop-blur-sm" asChild>
								<a href="/pricing" className="flex items-center justify-center">
									View Pricing
								</a>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Key Benefits Section */}
			<section className="relative overflow-hidden border-t border-border py-32">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
						<div className="absolute left-1/2 top-1/2 h-[400px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 dark:bg-blue-700/20 blur-[140px]" />
					</div>

					<div className="mx-auto mb-12 md:mb-24 max-w-5xl text-center">
						<div>
							<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">Why Teams Choose Roo</h2>
							<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
								Streamline collaboration and scale your development capacity with team-first features.
							</p>
						</div>
					</div>

					<div className="relative mx-auto md:max-w-[1200px]">
						<ul className="grid grid-cols-1 place-items-center gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
							{keyBenefits.map((benefit, index) => {
								const Icon = benefit.icon
								return (
									<li
										key={index}
										className="relative h-full w-full border border-border rounded-2xl bg-background p-8 transition-all duration-300 hover:shadow-lg">
										{Icon && (
											<div className="bg-violet-100 dark:bg-violet-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
												<Icon className="size-6 text-violet-600 dark:text-violet-400" />
											</div>
										)}
										<h3 className="mb-3 text-xl font-semibold text-foreground">{benefit.title}</h3>
										<div className="leading-relaxed font-light text-muted-foreground">
											{benefit.description}
										</div>
									</li>
								)
							})}
						</ul>
					</div>
				</div>
			</section>

			{/* Features Grid */}
			<section className="py-24 bg-muted/30">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
						<div className="absolute left-1/2 top-1/2 h-[800px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 dark:bg-violet-700/20 blur-[140px]" />
					</div>
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Complete Team Management</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							Access all capabilities from your Organization Settings. Everything you need to manage your
							team in one place.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto relative">
						{features.map((feature, index) => {
							const Icon = feature.icon
							return (
								<div
									key={index}
									className="bg-background p-8 rounded-2xl border border-border hover:shadow-lg transition-all duration-300">
									<div className="bg-violet-100 dark:bg-violet-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
										<Icon className="size-6 text-violet-600 dark:text-violet-400" />
									</div>
									<h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
									<p className="text-muted-foreground leading-relaxed">{feature.description}</p>
								</div>
							)
						})}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-24">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-blue-500/5 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-white/10 sm:p-16">
						<h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
							Ready to scale your team&apos;s development?
						</h2>
						<p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
							Start your free 14-day trial today. Got questions? Get in touch.
						</p>
						<div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
							<Button
								size="lg"
								className="bg-foreground text-background hover:bg-foreground/90 transition-all duration-300"
								asChild>
								<a
									href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP + "?redirect_url=/checkout/team"}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-center">
									Start Free Trial
									<ArrowRight className="ml-2 h-4 w-4" />
								</a>
							</Button>
							<Button variant="outline" size="lg" className="backdrop-blur-sm" asChild>
								<a href={EXTERNAL_LINKS.SUPPORT} className="flex items-center justify-center">
									Contact Support
								</a>
							</Button>
						</div>
					</div>
				</div>
			</section>
		</>
	)
}
