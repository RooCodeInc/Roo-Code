import type { MetadataRoute } from "next"
import { SEO } from "@/lib/seo"
import { getAllBlogPosts } from "@/lib/blog"

// Force dynamic rendering to include newly-published scheduled posts
export const dynamic = "force-dynamic"

// Require Node.js runtime for filesystem reads
export const runtime = "nodejs"

/**
 * Generate sitemap for the website
 * Includes all static pages and dynamically generated blog post URLs
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = SEO.url

	// Static pages with their last modified dates and priorities
	const staticPages: MetadataRoute.Sitemap = [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 1,
		},
		{
			url: `${baseUrl}/pricing`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.9,
		},
		{
			url: `${baseUrl}/extension`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: `${baseUrl}/cloud`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: `${baseUrl}/slack`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.7,
		},
		{
			url: `${baseUrl}/provider`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.7,
		},
		{
			url: `${baseUrl}/enterprise`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: `${baseUrl}/evals`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/reviewer`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/pr-fixer`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.6,
		},
		// Blog index page
		{
			url: `${baseUrl}/blog`,
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 0.8,
		},
		// Legal pages
		{
			url: `${baseUrl}/terms`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.3,
		},
		{
			url: `${baseUrl}/privacy`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.3,
		},
		{
			url: `${baseUrl}/legal/cookies`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.2,
		},
		{
			url: `${baseUrl}/legal/subprocessors`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.2,
		},
	]

	// Get all published blog posts and generate URLs
	const blogPosts = getAllBlogPosts()
	const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
		url: `${baseUrl}/blog/${post.slug}`,
		lastModified: new Date(post.publish_date),
		changeFrequency: "monthly" as const,
		priority: 0.7,
	}))

	return [...staticPages, ...blogPages]
}
