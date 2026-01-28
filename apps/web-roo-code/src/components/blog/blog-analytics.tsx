"use client"

import { useEffect, useRef } from "react"
import type { BlogPost } from "@/lib/blog/types"
import {
	trackBlogIndexView,
	trackBlogPostView,
	trackBlogPostScrollDepth,
	trackBlogPostTimeSpent,
} from "@/lib/blog/analytics"

interface BlogIndexAnalyticsProps {
	postCount: number
}

/**
 * Client component that tracks blog index page view
 * Place this inside the blog index page
 */
export function BlogIndexAnalytics({ postCount }: BlogIndexAnalyticsProps) {
	const tracked = useRef(false)

	useEffect(() => {
		if (!tracked.current) {
			trackBlogIndexView(postCount)
			tracked.current = true
		}
	}, [postCount])

	return null
}

interface BlogPostAnalyticsProps {
	post: {
		slug: string
		title: string
		description: string
		tags: string[]
		publish_date: string
		publish_time_pt: string
	}
}

/**
 * Client component that tracks blog post view, scroll depth, and time spent
 * Place this inside the blog post page
 */
export function BlogPostAnalytics({ post }: BlogPostAnalyticsProps) {
	const trackedView = useRef(false)
	const trackedDepths = useRef<Set<25 | 50 | 75 | 100>>(new Set())
	const trackedTimeSpent = useRef(false)
	const startTime = useRef<number>(Date.now())

	useEffect(() => {
		// Capture start time for cleanup function
		const effectStartTime = startTime.current

		// Track page view on mount
		if (!trackedView.current) {
			trackBlogPostView(post as BlogPost)
			trackedView.current = true
		}

		// Track scroll depth
		const handleScroll = () => {
			const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
			if (scrollHeight <= 0) return

			const scrollPercent = (window.scrollY / scrollHeight) * 100

			const depths: (25 | 50 | 75 | 100)[] = [25, 50, 75, 100]
			for (const depth of depths) {
				if (scrollPercent >= depth && !trackedDepths.current.has(depth)) {
					trackedDepths.current.add(depth)
					trackBlogPostScrollDepth(post as BlogPost, depth)
				}
			}
		}

		// Track time spent on page when leaving
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden" && !trackedTimeSpent.current) {
				trackedTimeSpent.current = true
				const timeSpent = Date.now() - effectStartTime
				trackBlogPostTimeSpent(post as BlogPost, timeSpent)
			}
		}

		window.addEventListener("scroll", handleScroll, { passive: true })
		document.addEventListener("visibilitychange", handleVisibilityChange)

		// Check initial scroll position
		handleScroll()

		return () => {
			window.removeEventListener("scroll", handleScroll)
			document.removeEventListener("visibilitychange", handleVisibilityChange)

			// Track time spent when component unmounts (only if not already tracked)
			if (!trackedTimeSpent.current) {
				trackedTimeSpent.current = true
				const timeSpent = Date.now() - effectStartTime
				trackBlogPostTimeSpent(post as BlogPost, timeSpent)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [post.slug])

	return null
}
