/**
 * Blog Post Page
 * MKT-69: Blog Post Page
 *
 * Renders a single blog post from Markdown.
 * Uses dynamic rendering (force-dynamic) for request-time publish gating.
 * Does NOT use generateStaticParams to avoid static generation.
 *
 * AEO Enhancement: Parses FAQ sections from markdown, renders as accordion,
 * and generates FAQPage JSON-LD schema for AI search optimization.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import Script from "next/script"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import {
	getBlogPostBySlug,
	getAdjacentPosts,
	formatPostDatePt,
	calculateReadingTime,
	formatReadingTime,
} from "@/lib/blog"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { BlogPostAnalytics } from "@/components/blog/BlogAnalytics"
import { BlogContent } from "@/components/blog/BlogContent"
import { BlogFAQ, type FAQItem } from "@/components/blog/BlogFAQ"
import { BlogPostCTA } from "@/components/blog/BlogPostCTA"

// Force dynamic rendering for request-time publish gating
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface Props {
	params: Promise<{ slug: string }>
}

/**
 * Parse FAQ section from markdown content
 *
 * Looks for a section starting with "## Frequently asked questions"
 * and extracts H3 questions with their content as answers.
 *
 * Returns the FAQ items and the content with FAQ section removed.
 */
function parseFAQFromMarkdown(content: string): {
	faqItems: FAQItem[]
	contentWithoutFAQ: string
} {
	// Match FAQ section: ## Frequently asked questions (case-insensitive)
	const faqSectionRegex = /^## Frequently asked questions\s*$/im
	const faqMatch = content.match(faqSectionRegex)

	if (!faqMatch || faqMatch.index === undefined) {
		return { faqItems: [], contentWithoutFAQ: content }
	}

	const faqStartIndex = faqMatch.index
	const beforeFAQ = content.slice(0, faqStartIndex).trim()
	const faqSection = content.slice(faqStartIndex)

	// Find where FAQ section ends (next H2 or end of content)
	const nextH2Match = faqSection.slice(faqMatch[0].length).match(/^## /m)
	const faqContent =
		nextH2Match && nextH2Match.index !== undefined
			? faqSection.slice(0, faqMatch[0].length + nextH2Match.index)
			: faqSection

	const afterFAQ =
		nextH2Match && nextH2Match.index !== undefined ? faqSection.slice(faqMatch[0].length + nextH2Match.index) : ""

	// Parse individual FAQ items (### Question followed by content)
	const faqItems: FAQItem[] = []
	const questionRegex = /^### (.+?)$\s*([\s\S]*?)(?=^### |$(?![\s\S]))/gm
	let match

	while ((match = questionRegex.exec(faqContent)) !== null) {
		const question = match[1]?.trim()
		const answer = match[2]?.trim()
		if (question && answer) {
			faqItems.push({ question, answer })
		}
	}

	const contentWithoutFAQ = (beforeFAQ + "\n\n" + afterFAQ).trim()

	return { faqItems, contentWithoutFAQ }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params
	const post = getBlogPostBySlug(slug)

	if (!post) {
		return {}
	}

	const path = `/blog/${post.slug}`

	return {
		title: post.title,
		description: post.description,
		alternates: {
			canonical: `${SEO.url}${path}`,
		},
		openGraph: {
			title: post.title,
			description: post.description,
			url: `${SEO.url}${path}`,
			siteName: SEO.name,
			images: [
				{
					url: ogImageUrl(post.title, post.description),
					width: 1200,
					height: 630,
					alt: post.title,
				},
			],
			locale: SEO.locale,
			type: "article",
			publishedTime: post.publish_date,
		},
		twitter: {
			card: SEO.twitterCard,
			title: post.title,
			description: post.description,
			images: [ogImageUrl(post.title, post.description)],
		},
		keywords: [...SEO.keywords, ...post.tags],
	}
}

export default async function BlogPostPage({ params }: Props) {
	const { slug } = await params
	const post = getBlogPostBySlug(slug)

	if (!post) {
		notFound()
	}

	const { previous, next } = getAdjacentPosts(slug)

	// Calculate reading time
	const readingTime = calculateReadingTime(post.content)
	const readingTimeDisplay = formatReadingTime(readingTime)

	// Parse FAQ section from markdown content
	const { faqItems, contentWithoutFAQ } = parseFAQFromMarkdown(post.content)
	const hasFAQ = faqItems.length > 0

	// BlogPosting JSON-LD schema (more specific than Article for SEO)
	const articleSchema = {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: post.title,
		description: post.description,
		datePublished: post.publish_date,
		image: ogImageUrl(post.title, post.description),
		wordCount: post.content.split(/\s+/).filter(Boolean).length,
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": `${SEO.url}/blog/${post.slug}`,
		},
		url: `${SEO.url}/blog/${post.slug}`,
		author: {
			"@type": "Organization",
			"@id": `${SEO.url}#org`,
			name: SEO.name,
		},
		publisher: {
			"@type": "Organization",
			"@id": `${SEO.url}#org`,
			name: SEO.name,
			logo: {
				"@type": "ImageObject",
				url: `${SEO.url}/android-chrome-512x512.png`,
			},
		},
	}

	// Breadcrumb schema
	const breadcrumbSchema = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{
				"@type": "ListItem",
				position: 1,
				name: "Home",
				item: SEO.url,
			},
			{
				"@type": "ListItem",
				position: 2,
				name: "Blog",
				item: `${SEO.url}/blog`,
			},
			{
				"@type": "ListItem",
				position: 3,
				name: post.title,
				item: `${SEO.url}/blog/${post.slug}`,
			},
		],
	}

	// FAQPage schema (only if post has FAQ section) - AEO optimization
	const faqSchema = hasFAQ
		? {
				"@context": "https://schema.org",
				"@type": "FAQPage",
				mainEntity: faqItems.map((item) => ({
					"@type": "Question",
					name: item.question,
					acceptedAnswer: {
						"@type": "Answer",
						text: item.answer,
					},
				})),
			}
		: null

	return (
		<>
			<Script
				id="article-schema"
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
			/>
			<Script
				id="breadcrumb-schema"
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
			/>
			{faqSchema && (
				<Script
					id="faq-schema"
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
				/>
			)}

			<BlogPostAnalytics post={post} />

			<article className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-4xl">
					{/* Visual Breadcrumb Navigation */}
					<nav aria-label="Breadcrumb" className="mb-8">
						<ol className="flex items-center gap-1 text-sm text-muted-foreground">
							<li>
								<Link href="/blog" className="transition-colors hover:text-foreground">
									Blog
								</Link>
							</li>
							<li>
								<ChevronRight className="h-4 w-4" />
							</li>
							<li className="truncate text-foreground" aria-current="page">
								{post.title}
							</li>
						</ol>
					</nav>

					<div className="prose prose-lg dark:prose-invert">
						<header className="not-prose mb-8">
							<h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">{post.title}</h1>
							<div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
								<span>{formatPostDatePt(post.publish_date)}</span>
								<span className="text-border">•</span>
								<span className="flex items-center gap-1">
									<Clock className="h-4 w-4" />
									{readingTimeDisplay}
								</span>
							</div>
							{post.tags.length > 0 && (
								<div className="mt-4 flex flex-wrap gap-2">
									{post.tags.map((tag) => (
										<span
											key={tag}
											className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
											{tag}
										</span>
									))}
								</div>
							)}
						</header>

						<BlogContent content={contentWithoutFAQ} />

						{/* FAQ Section rendered as accordion */}
						{hasFAQ && <BlogFAQ items={faqItems} />}

						{/* Product CTA Module - Inspired by Vercel's blog design
						    Default variant prioritizes Roo Code Cloud sign-up */}
						<BlogPostCTA />
					</div>

					{/* Previous/Next Post Navigation */}
					{(previous || next) && (
						<nav aria-label="Post navigation" className="mt-12 border-t border-border pt-8">
							<div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
								{previous ? (
									<Link
										href={`/blog/${previous.slug}`}
										className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
										<ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
										<div className="flex flex-col">
											<span className="text-xs uppercase tracking-wide">Previous</span>
											<span className="font-medium text-foreground">{previous.title}</span>
										</div>
									</Link>
								) : (
									<div />
								)}
								{next ? (
									<Link
										href={`/blog/${next.slug}`}
										className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex-row-reverse sm:text-right">
										<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
										<div className="flex flex-col">
											<span className="text-xs uppercase tracking-wide">Next</span>
											<span className="font-medium text-foreground">{next.title}</span>
										</div>
									</Link>
								) : (
									<div />
								)}
							</div>
						</nav>
					)}
				</div>
			</article>
		</>
	)
}
