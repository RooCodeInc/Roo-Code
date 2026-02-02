/**
 * Blog Index Page
 * MKT-68: Blog Index Page
 *
 * Lists published blog posts with pagination (12 posts per page).
 * Uses dynamic rendering (force-dynamic) for request-time publish gating.
 */

import type { Metadata } from "next"
import Script from "next/script"
import { getPaginatedBlogPosts, getAllBlogPosts } from "@/lib/blog"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { BlogIndexAnalytics } from "@/components/blog/BlogAnalytics"
import { BlogPostList } from "@/components/blog/BlogPostList"
import { BlogPagination } from "@/components/blog/BlogPagination"
import { BlogPostCTA } from "@/components/blog/BlogPostCTA"

// Force dynamic rendering for request-time publish gating
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TITLE = "Blog"
const DESCRIPTION = "How teams use agents to iterate, review, and ship PRs with proof."
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
	const { posts, currentPage, totalPages, totalPosts } = getPaginatedBlogPosts(1)
	const allPosts = getAllBlogPosts()

	// Schema.org CollectionPage + ItemList (includes all posts for SEO)
	const blogSchema = {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		name: TITLE,
		description: DESCRIPTION,
		url: `${SEO.url}${PATH}`,
		mainEntity: {
			"@type": "ItemList",
			itemListElement: allPosts.map((post, index) => ({
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

					{totalPosts > 0 && totalPages > 1 && (
						<p className="mt-2 text-sm text-muted-foreground">
							Showing {posts.length} of {totalPosts} posts
						</p>
					)}

					<BlogPostList posts={posts} />

					<BlogPagination currentPage={currentPage} totalPages={totalPages} />

					{/* Cloud CTA - shown after pagination */}
					<BlogPostCTA />
				</div>
			</div>
		</>
	)
}
