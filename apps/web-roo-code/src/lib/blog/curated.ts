/**
 * Curated/featured blog posts utilities
 *
 * Featured posts are determined by the `featured: true` frontmatter field.
 * This approach is scalable: edit the markdown file to add/remove from featured.
 */

import type { BlogPost } from "./types"

/**
 * Check if a post is featured based on frontmatter
 */
export function isCuratedPost(post: BlogPost): boolean {
	return post.featured === true
}

/**
 * Filter posts to only featured ones
 * Returns posts sorted by publish_date (newest first)
 */
export function filterFeaturedPosts(posts: BlogPost[]): BlogPost[] {
	return posts.filter((post) => post.featured === true)
}
