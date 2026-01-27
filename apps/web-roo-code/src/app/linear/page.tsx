import {
	ArrowRight,
	CheckCircle,
	CreditCard,
	Eye,
	GitBranch,
	GitPullRequest,
	Link2,
	MessageSquare,
	Settings,
	Shield,
	Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Metadata } from "next"

import { AnimatedBackground } from "@/components/homepage"
import { LinearIssueDemo } from "@/components/linear/linear-issue-demo"
import { Button } from "@/components/ui"
import { EXTERNAL_LINKS } from "@/lib/constants"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"

const TITLE = "Roo Code for Linear"
const DESCRIPTION = "Assign development work to @Roo Code directly from Linear. Get PRs back without switching tools."
const OG_DESCRIPTION = "Turn Linear Issues into Pull Requests"
const PATH = "/linear"

// Leave empty until video is ready - shows placeholder instead of broken iframe
const LINEAR_DEMO_YOUTUBE_ID = ""

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
		"linear integration",
		"issue to PR",
		"AI in Linear",
		"engineering workflow automation",
		"Roo Code Cloud",
	],
}

// Invalidate cache when a request comes in, at most once every hour.
export const revalidate = 3600

type ValueProp = {
	icon: LucideIcon
	title: string
	description: string
}

const VALUE_PROPS: ValueProp[] = [
	{
		icon: GitBranch,
		title: "Work where you already work.",
		description:
			"Assign development work to @Roo Code directly from Linear. No new tools to learn, no context switching required.",
	},
	{
		icon: Eye,
		title: "Progress is visible.",
		description:
			"Watch progress unfold in real-time. Roo Code posts updates as comments, so your whole team stays in the loop.",
	},
	{
		icon: MessageSquare,
		title: "Mention for refinement.",
		description:
			'Need changes? Just comment "@Roo Code also add dark mode support" and the agent picks up where it left off.',
	},
	{
		icon: Link2,
		title: "Full traceability.",
		description:
			"Every PR links back to the originating issue. Every issue shows its linked PR. Your audit trail stays clean.",
	},
	{
		icon: Settings,
		title: "Organization-level setup.",
		description:
			"Connect once, use everywhere. Your team members can assign issues to @Roo Code without individual configuration.",
	},
	{
		icon: Shield,
		title: "Safe by design.",
		description:
			"Agents never touch main/master directly. They produce branches and PRs. You review and approve before merge.",
	},
]

type WorkflowStep = {
	step: number
	title: string
	description: string
}

const WORKFLOW_STEPS: WorkflowStep[] = [
	{
		step: 1,
		title: "Create an issue",
		description: "Write your issue with acceptance criteria. Be as detailed as you like.",
	},
	{
		step: 2,
		title: "Call @Roo Code",
		description: "Mention @Roo Code in a comment to start. The agent begins working immediately.",
	},
	{
		step: 3,
		title: "Watch progress",
		description: "Roo Code posts status updates as comments. Refine with @-mentions if needed.",
	},
	{
		step: 4,
		title: "Review the PR",
		description: "When ready, the PR link appears in the issue. Review, iterate, and ship.",
	},
]

type OnboardingStep = {
	icon: LucideIcon
	title: string
	description: string
	link?: {
		href: string
		text: string
	}
}

const ONBOARDING_STEPS: OnboardingStep[] = [
	{
		icon: CreditCard,
		title: "1. Team Plan",
		description: "Linear integration requires a Team plan.",
		link: {
			href: EXTERNAL_LINKS.CLOUD_APP_TEAM_TRIAL,
			text: "Start a free trial",
		},
	},
	{
		icon: GitPullRequest,
		title: "2. Connect GitHub",
		description: "Link your repositories so Roo Code can open PRs on your behalf.",
	},
	{
		icon: Settings,
		title: "3. Connect Linear",
		description: "Authorize via OAuth. No API keys to manage or rotate.",
	},
	{
		icon: CheckCircle,
		title: "4. Link & Start",
		description: "Map your Linear project to a repo, then assign or mention @Roo Code.",
	},
]

function LinearIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
			<path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C19.3336 94.3417 5.63867 80.5968 1.22541 61.5228Z" />
			<path d="M.00189135 46.8891c-.01764375.2833.00143108.5765.05765765.8662.42870855 2.2073.93958605 4.3773 1.52844055 6.5063.3362 1.2154 1.8704 1.5324 2.6694.5765l42.7602-51.17121c.8082-.96676.3586-2.4829-.8213-2.74103-2.1092-.46189-4.2555-.84478-6.4348-1.14529-.2881-.03979-.5805-.05843-.8712-.05583-1.1371.01015-2.2285.57047-2.9144 1.46387L.543385 45.1098c-.35605.4555-.55221 1.0108-.541494 1.5765v.2028Z" />
			<path d="M7.47413 78.5763C5.95136 74.4783 4.89508 70.1874 4.34574 65.7571c-.11115-.8958.68135-1.6505 1.57048-1.4761l69.38238 13.6164c.8691.1706 1.2051 1.2165.583 1.8154-7.0838 6.8254-15.6512 12.091-25.2015 15.2757-.5174.1725-1.0869.131-1.5692-.1141L7.47413 78.5763Z" />
			<path d="M10.0667 87.1726c1.6311 1.5358 3.3347 2.9962 5.1042 4.3749.7181.5592 1.7288.5197 2.3995-.0939l36.4528-33.3725c.6929-.6343.5923-1.7418-.2146-2.3164-3.9746-2.8318-8.1879-5.3425-12.6031-7.4955-.6973-.34-1.5254-.2662-2.1506.1918L10.1041 72.2827c-.6507.4768-.9474 1.2653-.7844 2.0279.6166 2.8848 1.3865 5.7086 2.3044 8.4624.2101.6303.6234 1.1744 1.1681 1.5379l-2.7255 2.8617Z" />
			<path d="M30.9098 21.0292c-3.1675 5.2947-5.7485 10.9641-7.6686 16.9177-.2455.7611.0375 1.5912.6928 2.0326l26.7913 18.0587c.7022.4737 1.6445.3348 2.186-.3225l32.2427-39.1412c.549-.6667.353-1.6701-.4187-2.1215a99.30965 99.30965 0 0 0-16.6623-8.02636c-.6649-.2588-1.4207-.14022-1.9703.309L30.9098 21.0292Z" />
			<path d="M52.8822 97.4268c4.7332-.7003 9.2986-1.9013 13.6391-3.5563.6692-.2552 1.1306-.8583 1.1994-1.5696L72.341 47.4856c.0692-.7162-.2759-1.4034-.8986-1.7878l-34.8323-21.5036c-.73-.4504-1.6842-.2715-2.1975.4123L2.93488 64.0894c-.5248.6986-.35685 1.6987.36563 2.176 11.7672 7.7756 25.6851 12.5163 40.60049 13.3819.5851.034 1.1478-.2018 1.5036-.6305L52.8822 97.4268Z" />
		</svg>
	)
}

export default function LinearPage(): JSX.Element {
	return (
		<>
			{/* Hero Section */}
			<section className="relative flex pt-32 pb-20 items-center overflow-hidden">
				<AnimatedBackground />
				<div className="container relative flex flex-col items-center h-full z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
						<div className="text-center lg:text-left">
							<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium mb-6">
								<LinearIcon className="size-4" />
								Powered by Roo Code Cloud
							</div>
							<h1 className="text-4xl font-bold tracking-tight mb-6 md:text-5xl lg:text-6xl">
								Turn Linear Issues into <span className="text-indigo-500">Pull&nbsp;Requests</span>
							</h1>
							<p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0">
								Assign development work to @Roo Code directly from Linear. Get PRs back without
								switching tools.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
								<Button
									size="xl"
									className="bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-300 shadow-lg hover:shadow-indigo-500/25"
									asChild>
									<a
										href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center justify-center">
										Get Started
										<ArrowRight className="ml-2 size-5" />
									</a>
								</Button>
								<Button variant="outline" size="xl" className="backdrop-blur-sm" asChild>
									<a href="#demo" className="flex items-center justify-center">
										Watch Demo
									</a>
								</Button>
							</div>
						</div>

						<div className="flex justify-center lg:justify-end">
							<LinearIssueDemo />
						</div>
					</div>
				</div>
			</section>

			{/* Value Props Section */}
			<section className="py-24 bg-muted/30">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
						<div className="absolute left-1/2 top-1/2 h-[800px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 dark:bg-indigo-700/20 blur-[140px]" />
					</div>
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
							Why your team will love using Roo Code in&nbsp;Linear
						</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							AI agents that understand context, keep your team in the loop, and deliver PRs you can
							review.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto relative">
						{VALUE_PROPS.map((prop, index) => {
							const Icon = prop.icon
							return (
								<div
									key={index}
									className="bg-background p-8 rounded-2xl border border-border hover:shadow-lg transition-all duration-300">
									<div className="bg-indigo-100 dark:bg-indigo-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
										<Icon className="size-6 text-indigo-600 dark:text-indigo-400" />
									</div>
									<h3 className="text-xl font-semibold mb-3">{prop.title}</h3>
									<p className="text-muted-foreground leading-relaxed">{prop.description}</p>
								</div>
							)
						})}
					</div>
				</div>
			</section>

			{/* Featured Workflow Section */}
			<section id="demo" className="relative overflow-hidden border-t border-border py-24 lg:py-32">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
						<div className="absolute left-1/2 top-1/2 h-[400px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 dark:bg-blue-700/20 blur-[140px]" />
					</div>

					<div className="mx-auto mb-12 max-w-5xl text-center">
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
							<Zap className="size-4" />
							Featured Workflow
						</div>
						<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">Issue to Shipped Feature</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							Stay in Linear from assignment to review. Roo Code keeps the issue updated and links the PR
							when it&apos;s ready.
						</p>
					</div>

					<div className="relative mx-auto max-w-6xl">
						<div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10 items-center">
							{/* YouTube Video Embed or Placeholder */}
							<div className="lg:col-span-3 overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
								{LINEAR_DEMO_YOUTUBE_ID ? (
									<iframe
										className="aspect-video w-full"
										src={`https://www.youtube-nocookie.com/embed/${LINEAR_DEMO_YOUTUBE_ID}?rel=0`}
										title="Roo Code Linear Integration Demo"
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
										referrerPolicy="strict-origin-when-cross-origin"
										allowFullScreen
									/>
								) : (
									<div className="aspect-video w-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-purple-500/10 text-center p-8">
										<LinearIcon className="size-16 text-indigo-500/50 mb-4" />
										<p className="text-lg font-semibold text-foreground mb-2">
											Demo Video Coming Soon
										</p>
										<p className="text-sm text-muted-foreground max-w-md">
											See the workflow in action: assign an issue to @Roo Code and watch as it
											analyzes requirements, writes code, and opens a PR.
										</p>
									</div>
								)}
							</div>

							{/* Workflow Steps */}
							<div className="lg:col-span-2 space-y-3">
								{WORKFLOW_STEPS.map((step) => (
									<div
										key={step.step}
										className="relative border border-border rounded-xl bg-background p-4 transition-all duration-300 hover:shadow-md hover:border-blue-500/30">
										<div className="flex items-start gap-3">
											<div className="bg-blue-100 dark:bg-blue-900/30 w-7 h-7 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
												{step.step}
											</div>
											<div className="min-w-0">
												<h3 className="text-base font-semibold text-foreground mb-0.5">
													{step.title}
												</h3>
												<p className="text-sm leading-snug text-muted-foreground">
													{step.description}
												</p>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Onboarding Section */}
			<section className="py-24 bg-muted/30">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Get started in minutes</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							Connect Linear and start assigning issues to AI.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
						{ONBOARDING_STEPS.map((step, index) => {
							const Icon = step.icon
							return (
								<div key={index} className="text-center">
									<div className="bg-indigo-100 dark:bg-indigo-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
										<Icon className="size-8 text-indigo-600 dark:text-indigo-400" />
									</div>
									<h3 className="text-lg font-semibold mb-2">{step.title}</h3>
									<p className="text-muted-foreground">
										{step.description}
										{step.link && (
											<>
												{" "}
												<a
													href={step.link.href}
													target="_blank"
													rel="noopener noreferrer"
													className="text-indigo-600 dark:text-indigo-400 hover:underline">
													{step.link.text} →
												</a>
											</>
										)}
									</p>
								</div>
							)
						})}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-24">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-blue-500/5 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-white/10 sm:p-16">
						<h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
							Start using Roo Code in Linear
						</h2>
						<p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
							Start a free 14 day Team trial.
						</p>
						<div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
							<Button
								size="lg"
								className="bg-foreground text-background hover:bg-foreground/90 transition-all duration-300"
								asChild>
								<a
									href={EXTERNAL_LINKS.CLOUD_APP_TEAM_TRIAL}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-center">
									Start free trial
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
