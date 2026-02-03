/**
 * Blog content loading from Markdown files
 * MKT-67: Blog Content Layer
 */

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { BlogFrontmatterSchema } from "./validation"
import type { BlogPost } from "./types"
import { getNowPt, isPublished, parsePublishTimePt } from "./time"
import { filterFeaturedPosts } from "./curated"

const BLOG_DIR = path.join(process.cwd(), "src/content/blog")

/** Posts per page for pagination */
export const POSTS_PER_PAGE = 12

/** Pagination result type */
export interface PaginatedBlogPosts {
	posts: BlogPost[]
	currentPage: number
	totalPages: number
	totalPosts: number
	hasNextPage: boolean
	hasPreviousPage: boolean
}

/**
 * Get all blog posts from the content directory
 * @param options.includeDrafts - If true, include draft and future posts
 * @returns Array of blog posts sorted by publish date (newest first)
 */
export function getAllBlogPosts(options?: { includeDrafts?: boolean }): BlogPost[] {
	const nowPt = getNowPt()

	// Ensure blog directory exists
	if (!fs.existsSync(BLOG_DIR)) {
		return []
	}

	const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"))

	const posts: BlogPost[] = []
	const slugs = new Map<string, string>() // slug -> filepath for duplicate detection

	for (const file of files) {
		const filepath = path.join(BLOG_DIR, file)
		const raw = fs.readFileSync(filepath, "utf8")
		const { data, content } = matter(raw)

		// Validate frontmatter
		const result = BlogFrontmatterSchema.safeParse(data)
		if (!result.success) {
			const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
			throw new Error(`Invalid frontmatter in ${file}: ${errors}`)
		}

		const frontmatter = result.data

		// Check for duplicate slugs
		if (slugs.has(frontmatter.slug)) {
			throw new Error(`Duplicate slug "${frontmatter.slug}" found in ${file} and ${slugs.get(frontmatter.slug)}`)
		}
		slugs.set(frontmatter.slug, file)

		const post: BlogPost = {
			...frontmatter,
			content,
			filepath: file,
		}

		// Filter based on options
		if (options?.includeDrafts) {
			posts.push(post)
		} else if (isPublished(post, nowPt)) {
			posts.push(post)
		}
	}

	// Sort by publish_date desc, then publish_time_pt desc
	return posts.sort((a, b) => {
		if (a.publish_date !== b.publish_date) {
			return b.publish_date.localeCompare(a.publish_date)
		}
		const aMinutes = parsePublishTimePt(a.publish_time_pt)
		const bMinutes = parsePublishTimePt(b.publish_time_pt)
		return bMinutes - aMinutes
	})
}

/**
 * Get paginated blog posts
 * @param page - Page number (1-indexed)
 * @param options.includeDrafts - If true, include draft and future posts
 * @returns Paginated result with posts and pagination metadata
 */
export function getPaginatedBlogPosts(page: number = 1, options?: { includeDrafts?: boolean }): PaginatedBlogPosts {
	const allPosts = getAllBlogPosts(options)
	const totalPosts = allPosts.length
	const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE)

	// Clamp page to valid range
	const currentPage = Math.max(1, Math.min(page, totalPages || 1))

	const startIndex = (currentPage - 1) * POSTS_PER_PAGE
	const endIndex = startIndex + POSTS_PER_PAGE
	const posts = allPosts.slice(startIndex, endIndex)

	return {
		posts,
		currentPage,
		totalPages,
		totalPosts,
		hasNextPage: currentPage < totalPages,
		hasPreviousPage: currentPage > 1,
	}
}

/**
 * Get a single blog post by slug
 * Returns null if not found or not published
 * @param slug - The post slug
 * @returns The blog post or null
 */
export function getBlogPostBySlug(slug: string): BlogPost | null {
	const nowPt = getNowPt()

	// Ensure blog directory exists
	if (!fs.existsSync(BLOG_DIR)) {
		return null
	}

	const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"))

	for (const file of files) {
		const filepath = path.join(BLOG_DIR, file)
		const raw = fs.readFileSync(filepath, "utf8")
		const { data, content } = matter(raw)

		// Validate frontmatter
		const result = BlogFrontmatterSchema.safeParse(data)
		if (!result.success) {
			continue // Skip invalid posts when looking up by slug
		}

		const frontmatter = result.data

		if (frontmatter.slug === slug) {
			const post: BlogPost = {
				...frontmatter,
				content,
				filepath: file,
			}

			// Only return if published
			if (isPublished(post, nowPt)) {
				return post
			}

			// Post exists but is not published (draft or scheduled)
			return null
		}
	}

	return null
}

/**
 * Get adjacent posts (previous and next) for navigation
 * Posts are ordered newest-first, so:
 * - "previous" = newer post (earlier in the array)
 * - "next" = older post (later in the array)
 * @param slug - The current post's slug
 * @returns Object with previous and next posts (or null if they don't exist)
 */
export function getAdjacentPosts(slug: string): { previous: BlogPost | null; next: BlogPost | null } {
	const posts = getAllBlogPosts()
	const currentIndex = posts.findIndex((p) => p.slug === slug)

	if (currentIndex === -1) {
		return { previous: null, next: null }
	}

	// Posts are sorted newest-first
	// "previous" = newer post (index - 1)
	// "next" = older post (index + 1)
	const previous = currentIndex > 0 ? (posts[currentIndex - 1] ?? null) : null
	const next = currentIndex < posts.length - 1 ? (posts[currentIndex + 1] ?? null) : null

	return { previous, next }
}

/**
 * Get featured blog posts
 *
 * Returns published posts with `featured: true` in frontmatter,
 * sorted by publish_date (newest first).
 *
 * @returns Array of featured blog posts
 */
export function getCuratedBlogPosts(): BlogPost[] {
	const allPosts = getAllBlogPosts()
	return filterFeaturedPosts(allPosts)
}
