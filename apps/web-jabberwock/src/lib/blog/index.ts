/**
 * Blog content layer exports
 * MKT-67: Blog Content Layer
 */

// Types
export type { BlogPost, BlogPostFrontmatter, BlogSource, NowPt } from "./types"
export type { PaginatedBlogPosts } from "./content"

// Content loading
export {
	getAllBlogPosts,
	getBlogPostBySlug,
	getAdjacentPosts,
	getPaginatedBlogPosts,
	getCuratedBlogPosts,
	POSTS_PER_PAGE,
} from "./content"

// Featured posts
export { isCuratedPost, filterFeaturedPosts } from "./curated"

// Time utilities
export {
	getNowPt,
	parsePublishTimePt,
	isPublished,
	formatPostDatePt,
	calculateReadingTime,
	formatReadingTime,
} from "./time"

// Validation
export { BlogFrontmatterSchema, type ValidatedFrontmatter } from "./validation"

// Analytics
export { trackBlogIndexView, trackBlogPostView, trackSubstackClick } from "./analytics"
