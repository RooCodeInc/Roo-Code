/**
 * Pacific Time utilities for blog publishing
 * MKT-67: Blog Content Layer
 */

import type { BlogPost, NowPt } from "./types"

/**
 * Get the current time in Pacific Time
 * Returns date as YYYY-MM-DD and minutes since midnight
 */
export function getNowPt(): NowPt {
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Los_Angeles",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	})

	const parts = formatter.formatToParts(new Date())
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""

	const date = `${get("year")}-${get("month")}-${get("day")}`
	const minutes = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10)

	return { date, minutes }
}

/**
 * Parse publish_time_pt string to minutes since midnight
 * @param time - Time string in h:mmam/pm format (e.g., "9:00am")
 * @returns Minutes since midnight
 * @throws Error if format is invalid
 */
export function parsePublishTimePt(time: string): number {
	const match = time.match(/^(1[0-2]|[1-9]):([0-5][0-9])(am|pm)$/i)
	if (!match) {
		throw new Error(`Invalid time format: ${time}. Expected h:mmam/pm (e.g., 9:00am)`)
	}

	const hoursStr = match[1]
	const minsStr = match[2]
	const amPm = match[3]

	if (!hoursStr || !minsStr || !amPm) {
		throw new Error(`Invalid time format: ${time}. Expected h:mmam/pm (e.g., 9:00am)`)
	}

	let hours = parseInt(hoursStr, 10)
	const mins = parseInt(minsStr, 10)
	const isPm = amPm.toLowerCase() === "pm"

	// Convert 12-hour to 24-hour
	if (hours === 12) {
		hours = isPm ? 12 : 0
	} else if (isPm) {
		hours += 12
	}

	return hours * 60 + mins
}

/**
 * Check if a blog post is published based on PT time
 * A post is public when:
 * - status is "published"
 * - AND (now_pt_date > publish_date OR (now_pt_date == publish_date AND now_pt_minutes >= publish_time_pt_minutes))
 */
export function isPublished(post: BlogPost, nowPt: NowPt): boolean {
	if (post.status !== "published") {
		return false
	}

	const postMinutes = parsePublishTimePt(post.publish_time_pt)

	// Public when: now_pt_date > publish_date
	if (nowPt.date > post.publish_date) {
		return true
	}

	// OR (now_pt_date == publish_date AND now_pt_minutes >= publish_time_pt_minutes)
	if (nowPt.date === post.publish_date && nowPt.minutes >= postMinutes) {
		return true
	}

	return false
}

/**
 * Format publish date for display
 * Returns the date as-is in YYYY-MM-DD format
 */
export function formatPostDatePt(publishDate: string): string {
	return publishDate
}

/**
 * Strip all angle brackets from text to remove any HTML tags or fragments.
 * This is used only for word-count purposes in reading-time calculation,
 * so a single-pass removal of every `<` and `>` is sufficient and
 * avoids the incomplete multi-character sanitization pattern that
 * iterative tag-stripping is vulnerable to.
 */
function stripHtmlTags(text: string): string {
	return text.replace(/[<>]/g, "")
}

/**
 * Calculate reading time for a piece of content
 * Uses average reading speed of 200 words per minute
 * @param content - The markdown content to calculate reading time for
 * @returns Reading time in minutes (minimum 1)
 */
export function calculateReadingTime(content: string): number {
	// Strip markdown syntax for more accurate word count
	const plainText = stripHtmlTags(
		content
			// Remove code blocks
			.replace(/```[\s\S]*?```/g, "")
			// Remove inline code
			.replace(/`[^`]+`/g, "")
			// Remove images
			.replace(/!\[.*?\]\(.*?\)/g, "")
			// Remove links but keep text
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
			// Remove headers markers
			.replace(/^#{1,6}\s+/gm, "")
			// Remove emphasis
			.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
			// Remove horizontal rules
			.replace(/^[-*_]{3,}\s*$/gm, ""),
	)

	// Count words (split on whitespace)
	const words = plainText
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0)
	const wordCount = words.length

	// Calculate reading time (200 words per minute average)
	const readingTime = Math.ceil(wordCount / 200)

	// Return minimum of 1 minute
	return Math.max(1, readingTime)
}

/**
 * Format reading time for display
 * @param minutes - Reading time in minutes
 * @returns Formatted string (e.g., "5 min read")
 */
export function formatReadingTime(minutes: number): string {
	return `${minutes} min read`
}
