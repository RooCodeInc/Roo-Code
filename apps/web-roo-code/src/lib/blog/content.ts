import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { ZodError } from "zod"
import type { BlogPost } from "./types"
import { blogFrontmatterSchema } from "./types"
import { getNowPt } from "./pt-time"
import { isPublished } from "./publishing"

/**
 * Path to the blog content directory (relative to project root).
 */
const CONTENT_DIR = "content/blog"

/**
 * Get the absolute path to the blog content directory.
 */
function getContentDir(): string {
	return path.join(process.cwd(), CONTENT_DIR)
}

/**
 * Error thrown when blog content validation fails.
 */
export class BlogContentError extends Error {
	constructor(
		message: string,
		public filename?: string,
	) {
		super(filename ? `[${filename}] ${message}` : message)
		this.name = "BlogContentError"
	}
}

/**
 * Parse a single markdown file into a BlogPost object.
 *
 * @param filename - Name of the markdown file (e.g., "my-post.md")
 * @returns Parsed BlogPost object
 * @throws BlogContentError if frontmatter is invalid
 */
function parseMarkdownFile(filename: string): BlogPost {
	const filePath = path.join(getContentDir(), filename)
	const fileContent = fs.readFileSync(filePath, "utf8")

	// Parse frontmatter using gray-matter
	const { data, content } = matter(fileContent)

	// Validate frontmatter with zod
	try {
		const frontmatter = blogFrontmatterSchema.parse(data)

		// Verify slug matches filename (without .md extension)
		const expectedSlug = filename.replace(/\.md$/, "")
		if (frontmatter.slug !== expectedSlug) {
			throw new BlogContentError(
				`Slug mismatch: frontmatter slug "${frontmatter.slug}" does not match filename "${expectedSlug}"`,
				filename,
			)
		}

		return {
			...frontmatter,
			content,
			filename,
		}
	} catch (error) {
		if (error instanceof ZodError) {
			const issues = error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
			throw new BlogContentError(`Invalid frontmatter:\n${issues}`, filename)
		}
		throw error
	}
}

/**
 * Load all markdown files from the content directory.
 *
 * @returns Array of all parsed blog posts (including drafts)
 * @throws BlogContentError if any file has invalid frontmatter or duplicate slugs
 */
function loadAllPosts(): BlogPost[] {
	const contentDir = getContentDir()

	// Check if content directory exists
	if (!fs.existsSync(contentDir)) {
		return []
	}

	// Get all .md files
	const files = fs.readdirSync(contentDir).filter((file) => file.endsWith(".md"))

	// Parse all files
	const posts: BlogPost[] = []
	const slugToFilename = new Map<string, string>()

	for (const filename of files) {
		const post = parseMarkdownFile(filename)

		// Check for duplicate slugs
		const existingFilename = slugToFilename.get(post.slug)
		if (existingFilename) {
			throw new BlogContentError(
				`Duplicate slug "${post.slug}" found in files: "${existingFilename}" and "${filename}"`,
			)
		}
		slugToFilename.set(post.slug, filename)

		posts.push(post)
	}

	return posts
}

/**
 * Options for getAllBlogPosts.
 */
export interface GetAllBlogPostsOptions {
	/**
	 * Include draft posts in the results.
	 * @default false
	 */
	includeDrafts?: boolean
}

/**
 * Get all blog posts, optionally filtered by publish status.
 *
 * By default, only returns published posts that are past their scheduled
 * publish time (evaluated at request time in Pacific Time).
 *
 * @param options - Options for filtering posts
 * @returns Array of blog posts, sorted by publish_date (newest first)
 *
 * @example
 * ```ts
 * // Get only published posts (default)
 * const posts = getAllBlogPosts();
 *
 * // Include drafts (e.g., for preview in CMS)
 * const allPosts = getAllBlogPosts({ includeDrafts: true });
 * ```
 */
export function getAllBlogPosts(options: GetAllBlogPostsOptions = {}): BlogPost[] {
	const { includeDrafts = false } = options

	const allPosts = loadAllPosts()
	const nowPt = getNowPt()

	// Filter posts based on publish status
	const filteredPosts = includeDrafts ? allPosts : allPosts.filter((post) => isPublished(post, nowPt))

	// Sort by publish_date (newest first), then by publish_time_pt
	return filteredPosts.sort((a, b) => {
		// Compare dates first (descending)
		const dateCompare = b.publish_date.localeCompare(a.publish_date)
		if (dateCompare !== 0) {
			return dateCompare
		}
		// Same date - compare times (descending)
import { getNowPt, parsePublishTimePt } from "./pt-time"
	})
}

/**
 * Get a single blog post by its slug.
 *
 * Only returns the post if it's published and past its scheduled publish time.
 * Draft posts and future-scheduled posts will return null.
 *
 * @param slug - The URL slug of the post
 * @returns The blog post if found and published, null otherwise
 *
 * @example
 * ```ts
 * const post = getBlogPostBySlug('my-great-article');
 * if (post) {
 *   // Render the post
 * } else {
 *   // Show 404
 * }
 * ```
 */
export function getBlogPostBySlug(slug: string): BlogPost | null {
	const allPosts = loadAllPosts()
	const nowPt = getNowPt()

	const post = allPosts.find((p) => p.slug === slug)

	// Post not found
	if (!post) {
		return null
	}

	// Check if published
	if (!isPublished(post, nowPt)) {
		return null
	}

	return post
}

/**
 * Get all valid slugs for published posts.
 * Useful for generating static paths or sitemaps.
 *
 * @returns Array of slugs for published posts
 */
export function getPublishedSlugs(): string[] {
	return getAllBlogPosts().map((post) => post.slug)
}
