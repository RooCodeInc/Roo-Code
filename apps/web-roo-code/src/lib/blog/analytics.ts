/**
 * Blog Analytics Events
 *
 * PostHog tracking events for the blog section.
 * These events help understand blog engagement and attribution.
 */

import posthog from "posthog-js"
import type { BlogPost } from "./types"

/**
 * Track blog index page view
 * Called when user views /blog
 */
export function trackBlogIndexView(postCount: number): void {
	if (typeof window === "undefined" || !posthog.__loaded) return

	posthog.capture("blog_index_view", {
		post_count: postCount,
	})
}

/**
 * Track blog post view
 * Called when user views /blog/[slug]
 */
export function trackBlogPostView(post: BlogPost): void {
	if (typeof window === "undefined" || !posthog.__loaded) return

	posthog.capture("blog_post_view", {
		slug: post.slug,
		title: post.title,
		tags: post.tags,
		publish_date: post.publish_date,
		publish_time_pt: post.publish_time_pt,
	})
}

/**
 * Track Substack subscribe click
 * Called when user clicks the Substack subscribe link
 */
export function trackBlogSubstackClick(source: "footer" | "blog_index" | "blog_post"): void {
	if (typeof window === "undefined" || !posthog.__loaded) return

	posthog.capture("blog_substack_click", {
		source,
	})
}

/**
 * Track blog post scroll depth
 * Called at various scroll thresholds (25%, 50%, 75%, 100%)
 */
export function trackBlogPostScrollDepth(post: BlogPost, depth: 25 | 50 | 75 | 100): void {
	if (typeof window === "undefined" || !posthog.__loaded) return

	posthog.capture("blog_post_scroll_depth", {
		post_slug: post.slug,
		post_title: post.title,
		scroll_depth: depth,
	})
}

/**
 * Track blog post share
 * Called when user clicks a share button
 */
export function trackBlogPostShare(post: BlogPost, platform: string): void {
	if (typeof window === "undefined" || !posthog.__loaded) return

	posthog.capture("blog_post_shared", {
		post_slug: post.slug,
		post_title: post.title,
		share_platform: platform,
	})
}

/**
 * Track blog post CTA click
 * Called when user clicks a CTA within a blog post
 */
export function trackBlogPostCTAClick(post: BlogPost, ctaType: string, ctaTarget: string): void {
	if (typeof window === "undefined" || !posthog.__loaded) return

	posthog.capture("blog_post_cta_click", {
		post_slug: post.slug,
		post_title: post.title,
		cta_type: ctaType,
		cta_target: ctaTarget,
	})
}

/**
 * Track time spent on blog post
 * Called when user leaves the page (or at intervals)
 */
export function trackBlogPostTimeSpent(post: BlogPost, timeMs: number): void {
	if (typeof window === "undefined" || !posthog.__loaded) return

	posthog.capture("blog_post_time_spent", {
		post_slug: post.slug,
		post_title: post.title,
		time_spent_ms: timeMs,
		time_spent_seconds: Math.round(timeMs / 1000),
	})
}
