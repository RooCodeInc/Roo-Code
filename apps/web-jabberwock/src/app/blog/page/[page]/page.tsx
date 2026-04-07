/**
 * Blog Paginated Index Page
 * Handles pages 2+ of the blog listing
 *
 * URL structure: /blog/page/2, /blog/page/3, etc.
 * Page 1 redirects to /blog for canonical URL consistency.
 */

import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Script from "next/script"
import { getPaginatedBlogPosts, getAllBlogPosts, POSTS_PER_PAGE } from "@/lib/blog"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { BlogIndexAnalytics } from "@/components/blog/BlogAnalytics"
import { BlogPostList } from "@/components/blog/BlogPostList"
import { BlogPagination } from "@/components/blog/BlogPagination"
import { BlogPostCTA } from "@/components/blog/BlogPostCTA"

// Force dynamic rendering for request-time publish gating
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface PageProps {
	params: Promise<{ page: string }>
}

const BASE_TITLE = "Blog"
const DESCRIPTION = "How teams use agents to iterate, review, and ship PRs with proof."
const BASE_PATH = "/blog"

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { page: pageParam } = await params
	const pageNumber = parseInt(pageParam, 10)
	const title = `${BASE_TITLE} - Page ${pageNumber}`
	const path = `${BASE_PATH}/page/${pageNumber}`

	return {
		title,
		description: DESCRIPTION,
		alternates: {
			canonical: `${SEO.url}${path}`,
		},
		openGraph: {
			title,
			description: DESCRIPTION,
			url: `${SEO.url}${path}`,
			siteName: SEO.name,
			images: [
				{
					url: ogImageUrl(title, DESCRIPTION),
					width: 1200,
					height: 630,
					alt: title,
				},
			],
			locale: SEO.locale,
			type: "website",
		},
		twitter: {
			card: SEO.twitterCard,
			title,
			description: DESCRIPTION,
			images: [ogImageUrl(title, DESCRIPTION)],
		},
		keywords: [...SEO.keywords, "blog", "articles", "engineering", "AI development"],
		robots: {
			index: true,
			follow: true,
		},
	}
}

/**
 * Generate static params for known pages at build time
 * This helps with initial page load performance
 */
export async function generateStaticParams() {
	const allPosts = getAllBlogPosts()
	const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE)

	// Generate params for pages 2 through totalPages
	const params = []
	for (let page = 2; page <= totalPages; page++) {
		params.push({ page: page.toString() })
	}

	return params
}

export default async function BlogPaginatedPage({ params }: PageProps) {
	const { page: pageParam } = await params
	const pageNumber = parseInt(pageParam, 10)

	// Validate page number
	if (isNaN(pageNumber) || pageNumber < 1) {
		notFound()
	}

	// Redirect page 1 to /blog for canonical URL
	if (pageNumber === 1) {
		redirect("/blog")
	}

	const { posts, currentPage, totalPages, totalPosts } = getPaginatedBlogPosts(pageNumber)

	// If page is beyond total pages, 404
	if (pageNumber > totalPages && totalPages > 0) {
		notFound()
	}

	const title = `${BASE_TITLE} - Page ${pageNumber}`
	const path = `${BASE_PATH}/page/${pageNumber}`

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
				item: `${SEO.url}${BASE_PATH}`,
			},
			{
				"@type": "ListItem",
				position: 3,
				name: `Page ${pageNumber}`,
				item: `${SEO.url}${path}`,
			},
		],
	}

	// Calculate post range for display
	const startPost = (currentPage - 1) * POSTS_PER_PAGE + 1
	const endPost = Math.min(currentPage * POSTS_PER_PAGE, totalPosts)

	return (
		<>
			<Script
				id="breadcrumb-schema"
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
			/>

			<BlogIndexAnalytics />

			<div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-4xl">
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">{title}</h1>
					<p className="mt-4 text-lg text-muted-foreground">{DESCRIPTION}</p>

					<p className="mt-2 text-sm text-muted-foreground">
						Showing posts {startPost}-{endPost} of {totalPosts}
					</p>

					<BlogPostList posts={posts} />

					<BlogPagination currentPage={currentPage} totalPages={totalPages} />

					{/* Cloud CTA - shown after pagination */}
					<BlogPostCTA />
				</div>
			</div>
		</>
	)
}
