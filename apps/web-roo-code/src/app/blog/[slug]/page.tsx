/**
 * Blog Post Page
 * MKT-69: Blog Post Page
 *
 * Renders a single blog post from Markdown.
 * Uses dynamic rendering (force-dynamic) for request-time publish gating.
 * Does NOT use generateStaticParams to avoid static generation.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import Script from "next/script"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getBlogPostBySlug, getAdjacentPosts, formatPostDatePt } from "@/lib/blog"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { BlogPostAnalytics } from "@/components/blog/BlogAnalytics"

// Force dynamic rendering for request-time publish gating
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface Props {
	params: Promise<{ slug: string }>
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

	// Article JSON-LD schema
	const articleSchema = {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: post.title,
		description: post.description,
		datePublished: post.publish_date,
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
							<p className="mt-4 text-muted-foreground">Posted {formatPostDatePt(post.publish_date)}</p>
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

						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							components={{
								// Custom heading styles - note: h1 in content becomes h2 to preserve single H1
								h1: ({ ...props }) => <h2 className="mt-12 text-2xl font-bold" {...props} />,
								h2: ({ ...props }) => <h2 className="mt-12 text-2xl font-bold" {...props} />,
								h3: ({ ...props }) => <h3 className="mt-8 text-xl font-semibold" {...props} />,
								// Links open in new tab
								a: ({ ...props }) => (
									<a
										className="text-primary hover:underline"
										target="_blank"
										rel="noopener noreferrer"
										{...props}
									/>
								),
								// Styled blockquotes
								blockquote: ({ ...props }) => (
									<blockquote
										className="border-l-4 border-primary pl-4 italic text-muted-foreground"
										{...props}
									/>
								),
								// Code blocks
								code: ({ className, children, ...props }) => {
									const isInline = !className
									if (isInline) {
										return (
											<code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
												{children}
											</code>
										)
									}
									return (
										<code className={className} {...props}>
											{children}
										</code>
									)
								},
								// Strong text
								strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
								// Paragraphs
								p: ({ ...props }) => <p className="leading-7 [&:not(:first-child)]:mt-6" {...props} />,
								// Lists
								ul: ({ ...props }) => <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props} />,
								ol: ({ ...props }) => <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props} />,
							}}>
							{post.content}
						</ReactMarkdown>
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
