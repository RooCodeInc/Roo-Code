"use client"

/**
 * Client-side blog analytics components
 * MKT-74: Blog Analytics (PostHog)
 */

import { useEffect } from "react"
import { trackBlogIndexView, trackBlogPostView } from "@/lib/blog/analytics"
import type { BlogPost } from "@/lib/blog/types"

/**
 * Tracks blog index page view
 * Place this component on the blog index page
 */
export function BlogIndexAnalytics() {
	useEffect(() => {
		trackBlogIndexView()
	}, [])

	return null
}

/**
 * Tracks individual blog post view
 * Place this component on blog post pages
 */
export function BlogPostAnalytics({ post }: { post: BlogPost }) {
	useEffect(() => {
		trackBlogPostView(post)
	}, [post])

	return null
}

/**
 * Serializable post data for client component
 * Use this type when passing post data to BlogPostAnalytics
 */
export interface SerializablePostData {
	slug: string
	title: string
	publish_date: string
	publish_time_pt: string
	tags: string[]
	status: "draft" | "published"
	description: string
	content: string
	filepath: string
}
