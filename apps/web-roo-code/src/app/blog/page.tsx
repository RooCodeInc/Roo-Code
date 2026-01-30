/**
 * Blog Index Page
 * MKT-68: Blog Index Page
 *
 * Lists all published blog posts, sorted newest-first.
 * Uses dynamic rendering (force-dynamic) for request-time publish gating.
 */

import type { Metadata } from "next"
import Link from "next/link"
import Script from "next/script"
import { getAllBlogPosts, formatPostDatePt } from "@/lib/blog"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { BlogIndexAnalytics } from "@/components/blog/BlogAnalytics"

// Force dynamic rendering for request-time publish gating
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TITLE = "Blog"
const DESCRIPTION =
	"Insights on AI-powered development, engineering practices, and building better software with Roo Code."
const PATH = "/blog"

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
				url: ogImageUrl(TITLE, DESCRIPTION),
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
		images: [ogImageUrl(TITLE, DESCRIPTION)],
	},
	keywords: [...SEO.keywords, "blog", "articles", "engineering", "AI development"],
}

export default function BlogIndexPage() {
	const posts = getAllBlogPosts()

	// Schema.org CollectionPage + ItemList
	const blogSchema = {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		name: TITLE,
		description: DESCRIPTION,
		url: `${SEO.url}${PATH}`,
		mainEntity: {
			"@type": "ItemList",
			itemListElement: posts.map((post, index) => ({
				"@type": "ListItem",
				position: index + 1,
				url: `${SEO.url}/blog/${post.slug}`,
				name: post.title,
			})),
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
				item: `${SEO.url}${PATH}`,
			},
		],
	}

	return (
		<>
			<Script
				id="blog-schema"
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
			/>
			<Script
				id="breadcrumb-schema"
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
			/>

			<BlogIndexAnalytics />

			<div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-4xl">
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Blog</h1>
					<p className="mt-4 text-lg text-muted-foreground">{DESCRIPTION}</p>

					{posts.length === 0 ? (
						<div className="mt-12 text-center">
							<p className="text-muted-foreground">No posts published yet. Check back soon!</p>
						</div>
					) : (
						<div className="mt-12 space-y-12">
							{posts.map((post) => (
								<article key={post.slug} className="border-b border-border pb-12 last:border-b-0">
									<Link href={`/blog/${post.slug}`} className="group">
										<h2 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-primary sm:text-2xl">
											{post.title}
										</h2>
									</Link>
									<p className="mt-2 text-sm text-muted-foreground">
										Posted {formatPostDatePt(post.publish_date)}
									</p>
									<p className="mt-3 text-muted-foreground">{post.description}</p>
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
									<Link
										href={`/blog/${post.slug}`}
										className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
										Read more →
									</Link>
								</article>
							))}
						</div>
					)}
				</div>
			</div>
		</>
	)
}
