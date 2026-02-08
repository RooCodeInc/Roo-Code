/**
 * Blog-specific PostHog analytics events
 * MKT-74: Blog Analytics (PostHog)
 */

import posthog from "posthog-js"
import type { BlogPost } from "./types"

/**
 * Track blog index page view
 */
export function trackBlogIndexView(): void {
	if (typeof window !== "undefined" && posthog.__loaded) {
		posthog.capture("blog_index_view")
	}
}

/**
 * Track individual blog post view
 */
export function trackBlogPostView(post: BlogPost): void {
	if (typeof window !== "undefined" && posthog.__loaded) {
		posthog.capture("blog_post_view", {
			slug: post.slug,
			title: post.title,
			publish_date: post.publish_date,
			publish_time_pt: post.publish_time_pt,
			tags: post.tags,
		})
	}
}

/**
 * Track Substack subscribe click
 */
export function trackSubstackClick(): void {
	if (typeof window !== "undefined" && posthog.__loaded) {
		posthog.capture("blog_substack_click")
	}
}
