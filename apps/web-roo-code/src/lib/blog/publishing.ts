import type { BlogPost, PtMoment } from "./types"
import { parsePublishTimePt } from "./pt-time"

/**
 * Check if a blog post is published and visible.
 *
 * A post is public when:
 * 1. status is "published"
 * 2. Current PT date/time is at or past the scheduled publish moment
 *
 * Publish logic comparison (Pacific Time):
 * - now_pt_date > publish_date → published
 * - now_pt_date === publish_date AND now_pt_minutes >= publish_time_pt_minutes → published
 * - Otherwise → not published
 *
 * @param post - The blog post to check
 * @param nowPt - Current moment in Pacific Time
 * @returns true if the post should be publicly visible
 *
 * @example
 * ```ts
 * const post = { status: 'published', publish_date: '2026-01-29', publish_time_pt: '9:00am', ... };
 * const now = { date: '2026-01-29', minutes: 540 }; // 9:00am
 * isPublished(post, now); // true
 * ```
 */
export function isPublished(post: BlogPost, nowPt: PtMoment): boolean {
	// Draft posts are never visible
	if (post.status !== "published") {
		return false
	}

	const publishMinutes = parsePublishTimePt(post.publish_time_pt)

	// Compare dates first
	if (nowPt.date > post.publish_date) {
		// Current date is after publish date - published
		return true
	}

	if (nowPt.date < post.publish_date) {
		// Current date is before publish date - not published
		return false
	}

	// Same date - compare minutes
	return nowPt.minutes >= publishMinutes
}
