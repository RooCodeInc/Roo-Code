/**
 * Blog content pipeline for roocode.com/blog
 *
 * This module provides functions to load and manage blog posts from
 * markdown files with frontmatter.
 *
 * @see docs/blog.md for the full specification
 *
 * @example
 * ```ts
 * import { getAllBlogPosts, getBlogPostBySlug, formatPostDatePt } from '@/lib/blog';
 *
 * // Get all published posts
 * const posts = getAllBlogPosts();
 *
 * // Get a specific post
 * const post = getBlogPostBySlug('my-article');
 *
 * // Format date for display
 * const displayDate = formatPostDatePt(post.publish_date);
 * // "2026-01-29"
 * ```
 */

// Types
export type { BlogPost, BlogFrontmatter, PtMoment } from "./types"
export { blogFrontmatterSchema, SLUG_PATTERN, PUBLISH_TIME_PT_PATTERN, MAX_TAGS } from "./types"

// Content loading
export { getAllBlogPosts, getBlogPostBySlug, getPublishedSlugs, BlogContentError } from "./content"
export type { GetAllBlogPostsOptions } from "./content"

// PT timezone helpers
export { getNowPt, parsePublishTimePt, formatPostDatePt } from "./pt-time"

// Publishing helpers
export { isPublished } from "./publishing"

// Structured data (JSON-LD)
export {
	getArticleStructuredData,
	getBlogCollectionStructuredData,
	getBlogBreadcrumbStructuredData,
	getBlogPostBreadcrumbStructuredData,
	getBlogPostUrl,
} from "./structured-data"

// Analytics (PostHog events)
export {
	trackBlogIndexView,
	trackBlogPostView,
	trackBlogPostScrollDepth,
	trackBlogPostShare,
	trackBlogPostCTAClick,
	trackBlogPostTimeSpent,
	trackBlogSubstackClick,
} from "./analytics"
