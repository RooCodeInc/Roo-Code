/**
 * Blog Post CTA Component
 * Inspired by Vercel's blog design - contextual call-to-action modules
 *
 * Provides end-of-article product CTAs to help convert readers into users.
 */

import Link from "next/link"
import { ArrowRight, Sparkles, Code2, GitPullRequest } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EXTERNAL_LINKS } from "@/lib/constants"

interface CTALink {
	label: string
	href: string
	description?: string
	external?: boolean
}

interface BlogPostCTAProps {
	/** The main headline for the CTA module */
	headline?: string
	/** Description text below the headline */
	description?: string
	/** Primary CTA button text */
	primaryButtonText?: string
	/** Primary CTA button link */
	primaryButtonHref?: string
	/** Secondary CTA button text */
	secondaryButtonText?: string
	/** Secondary CTA button link */
	secondaryButtonHref?: string
	/** Optional list of related links to show */
	links?: CTALink[]
	/** Variant style for the CTA */
	variant?: "default" | "extension" | "cloud" | "enterprise"
}

const variantConfig = {
	// Default prioritizes Cloud sign-up with workflow-truth messaging
	default: {
		headline: "Stop being the human glue between PRs",
		description:
			"Cloud Agents review code, catch issues, and suggest fixes before you open the diff. You review the results, not the process.",
		primaryText: "Try Cloud Free",
		primaryHref: EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME,
		secondaryText: "See How It Works",
		secondaryHref: "/cloud",
		icon: Sparkles,
	},
	extension: {
		headline: "Stop copy-pasting between terminal and chat",
		description:
			"The agent runs commands, sees the output, and iterates until the tests pass. You review the diff and approve.",
		primaryText: "Install for VS Code",
		primaryHref: EXTERNAL_LINKS.MARKETPLACE,
		secondaryText: "View Docs",
		secondaryHref: EXTERNAL_LINKS.DOCUMENTATION,
		icon: Code2,
	},
	cloud: {
		headline: "Let Cloud Agents handle the review queue",
		description:
			"PR Reviewer checks out your branch, runs your linters, and leaves inline suggestions. You decide what to merge.",
		primaryText: "Start Free",
		primaryHref: EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME,
		secondaryText: "View Pricing",
		secondaryHref: "/pricing",
		icon: Sparkles,
	},
	enterprise: {
		headline: "Thinking about security, compliance, or adoption?",
		description:
			"We're explicit about data handling, control boundaries, and what runs where. Talk to us about your constraints.",
		primaryText: "Talk to Sales",
		primaryHref: "/enterprise",
		secondaryText: "View Trust Center",
		secondaryHref: EXTERNAL_LINKS.SECURITY,
		icon: GitPullRequest,
	},
}

/**
 * A contextual CTA module for blog posts
 * Inspired by Vercel's "Get started" modules at the end of blog posts
 */
export function BlogPostCTA({
	headline,
	description,
	primaryButtonText,
	primaryButtonHref,
	secondaryButtonText,
	secondaryButtonHref,
	links,
	variant = "default",
}: BlogPostCTAProps) {
	const config = variantConfig[variant]
	const Icon = config.icon

	const finalHeadline = headline ?? config.headline
	const finalDescription = description ?? config.description
	const finalPrimaryText = primaryButtonText ?? config.primaryText
	const finalPrimaryHref = primaryButtonHref ?? config.primaryHref
	const finalSecondaryText = secondaryButtonText ?? config.secondaryText
	const finalSecondaryHref = secondaryButtonHref ?? config.secondaryHref

	const isExternalPrimary = finalPrimaryHref.startsWith("http")
	const isExternalSecondary = finalSecondaryHref.startsWith("http")

	return (
		<div className="not-prose mt-12 rounded-xl border border-border bg-muted/30 p-6 sm:p-8">
			<div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
				{/* Icon */}
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
					<Icon className="h-6 w-6 text-primary" />
				</div>

				{/* Content */}
				<div className="flex-1">
					<h3 className="text-xl font-semibold text-foreground">{finalHeadline}</h3>
					<p className="mt-2 text-muted-foreground">{finalDescription}</p>

					{/* Links list (optional, Vercel-style numbered list) */}
					{links && links.length > 0 && (
						<ol className="mt-4 space-y-2">
							{links.map((link, index) => (
								<li key={link.href} className="flex items-start gap-3">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
										{index + 1}
									</span>
									<div>
										{link.external ? (
											<a
												href={link.href}
												target="_blank"
												rel="noopener noreferrer"
												className="font-medium text-primary hover:underline">
												{link.label}
											</a>
										) : (
											<Link href={link.href} className="font-medium text-primary hover:underline">
												{link.label}
											</Link>
										)}
										{link.description && (
											<span className="text-muted-foreground"> — {link.description}</span>
										)}
									</div>
								</li>
							))}
						</ol>
					)}

					{/* Action buttons */}
					<div className="mt-6 flex flex-col gap-3 sm:flex-row">
						{isExternalPrimary ? (
							<Button asChild>
								<a href={finalPrimaryHref} target="_blank" rel="noopener noreferrer">
									{finalPrimaryText}
									<ArrowRight className="ml-1 h-4 w-4" />
								</a>
							</Button>
						) : (
							<Button asChild>
								<Link href={finalPrimaryHref}>
									{finalPrimaryText}
									<ArrowRight className="ml-1 h-4 w-4" />
								</Link>
							</Button>
						)}

						{isExternalSecondary ? (
							<Button variant="outline" asChild>
								<a href={finalSecondaryHref} target="_blank" rel="noopener noreferrer">
									{finalSecondaryText}
								</a>
							</Button>
						) : (
							<Button variant="outline" asChild>
								<Link href={finalSecondaryHref}>{finalSecondaryText}</Link>
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

/**
 * Get Started links component (Vercel-style numbered list)
 * Can be used standalone or within BlogPostCTA
 */
export function GetStartedLinks({ links }: { links: CTALink[] }) {
	return (
		<div className="not-prose mt-8 rounded-lg border border-border bg-muted/30 p-6">
			<h4 className="font-semibold text-foreground">Get started</h4>
			<ol className="mt-4 space-y-3">
				{links.map((link, index) => (
					<li key={link.href} className="flex items-start gap-3">
						<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
							{index + 1}
						</span>
						<div>
							{link.external ? (
								<a
									href={link.href}
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-primary hover:underline">
									{link.label}
								</a>
							) : (
								<Link href={link.href} className="font-medium text-primary hover:underline">
									{link.label}
								</Link>
							)}
							{link.description && <span className="text-muted-foreground"> — {link.description}</span>}
						</div>
					</li>
				))}
			</ol>
		</div>
	)
}
