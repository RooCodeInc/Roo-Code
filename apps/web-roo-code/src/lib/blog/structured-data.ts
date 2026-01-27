import { SEO } from "../seo"
import type { BlogPost } from "./types"

/**
 * Organization reference used across all blog structured data
 */
const ORG_ID = `${SEO.url}#org`

/**
 * Blog section reference
 */
const BLOG_ID = `${SEO.url}/blog#blog`

/**
 * Get the canonical URL for a blog post
 */
export function getBlogPostUrl(slug: string): string {
	return `${SEO.url}/blog/${slug}`
}

/**
 * Generate Article JSON-LD for a blog post
 *
 * @see https://schema.org/Article
 * @see https://developers.google.com/search/docs/appearance/structured-data/article
 */
export function getArticleStructuredData(post: BlogPost) {
	const url = getBlogPostUrl(post.slug)

	return {
		"@context": "https://schema.org",
		"@type": "Article",
		"@id": `${url}#article`,
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": url,
		},
		url,
		headline: post.title,
		description: post.description,
		datePublished: post.publish_date,
		// dateModified not available in MVP - use publish_date
		dateModified: post.publish_date,
		author: {
			"@type": "Organization",
			"@id": ORG_ID,
			name: SEO.name,
		},
		publisher: {
			"@type": "Organization",
			"@id": ORG_ID,
			name: SEO.name,
			logo: {
				"@type": "ImageObject",
				url: `${SEO.url}/android-chrome-512x512.png`,
				width: 512,
				height: 512,
			},
		},
		isPartOf: {
			"@type": "Blog",
			"@id": BLOG_ID,
		},
		// Keywords from tags
		keywords: post.tags.join(", "),
	}
}

/**
 * Generate CollectionPage + ItemList JSON-LD for blog index
 *
 * @see https://schema.org/CollectionPage
 * @see https://schema.org/ItemList
 */
export function getBlogCollectionStructuredData(posts: BlogPost[]) {
	const blogUrl = `${SEO.url}/blog`

	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Blog",
				"@id": BLOG_ID,
				name: `${SEO.name} Blog`,
				description:
					"Insights on AI-powered software development, engineering workflows, and the future of coding with Roo Code.",
				url: blogUrl,
				publisher: {
					"@type": "Organization",
					"@id": ORG_ID,
				},
			},
			{
				"@type": "CollectionPage",
				"@id": `${blogUrl}#collection`,
				url: blogUrl,
				name: "Blog",
				description:
					"Insights on AI-powered software development, engineering workflows, and the future of coding with Roo Code.",
				isPartOf: {
					"@type": "WebSite",
					"@id": `${SEO.url}#website`,
				},
				mainEntity: {
					"@type": "ItemList",
					numberOfItems: posts.length,
					itemListElement: posts.map((post, index) => ({
						"@type": "ListItem",
						position: index + 1,
						url: getBlogPostUrl(post.slug),
						name: post.title,
					})),
				},
			},
		],
	}
}

/**
 * Generate BreadcrumbList JSON-LD for blog index
 *
 * @see https://schema.org/BreadcrumbList
 */
export function getBlogBreadcrumbStructuredData() {
	return {
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
		],
	}
}

/**
 * Generate BreadcrumbList JSON-LD for a blog post
 *
 * @see https://schema.org/BreadcrumbList
 */
export function getBlogPostBreadcrumbStructuredData(post: BlogPost) {
	return {
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
				item: getBlogPostUrl(post.slug),
			},
		],
	}
}
