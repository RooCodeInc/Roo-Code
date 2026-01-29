import type { PtMoment } from "./types"
import { PUBLISH_TIME_PT_PATTERN } from "./types"

/**
 * Pacific Time timezone identifier.
 */
const PT_TIMEZONE = "America/Los_Angeles"

/**
 * Get the current moment in Pacific Time.
 *
 * @returns PtMoment with date (YYYY-MM-DD) and minutes since midnight
 *
 * @example
 * ```ts
 * const now = getNowPt();
 * // { date: '2026-01-29', minutes: 540 } // 9:00am PT
 * ```
 */
export function getNowPt(): PtMoment {
	const now = new Date()

	// Format date as YYYY-MM-DD in PT
	const dateFormatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: PT_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	})
	const date = dateFormatter.format(now)

	// Get hours and minutes in PT
	const timeFormatter = new Intl.DateTimeFormat("en-US", {
		timeZone: PT_TIMEZONE,
		hour: "numeric",
		minute: "numeric",
		hour12: false,
	})
	const timeParts = timeFormatter.formatToParts(now)
	const hour = parseInt(timeParts.find((p) => p.type === "hour")?.value ?? "0", 10)
	const minute = parseInt(timeParts.find((p) => p.type === "minute")?.value ?? "0", 10)
	const minutes = hour * 60 + minute

	return { date, minutes }
}

/**
 * Parse a publish_time_pt string (h:mmam/pm) to minutes since midnight.
 *
 * @param time - Time string in h:mmam/pm format (e.g., "9:00am", "12:30pm")
 * @returns Minutes since midnight (0-1439)
 * @throws Error if the time format is invalid
 *
 * @example
 * ```ts
 * parsePublishTimePt('9:00am');   // 540  (9 * 60)
 * parsePublishTimePt('12:30pm');  // 750  (12 * 60 + 30)
 * parsePublishTimePt('12:00am');  // 0    (midnight)
 * parsePublishTimePt('11:59pm');  // 1439 (23 * 60 + 59)
 * ```
 */
export function parsePublishTimePt(time: string): number {
	if (!PUBLISH_TIME_PT_PATTERN.test(time)) {
		throw new Error(`Invalid publish_time_pt format: "${time}". Must be h:mmam/pm (e.g., "9:00am", "12:30pm")`)
	}

	// Extract components: "9:00am" -> ["9", "00", "am"]
	const match = time.match(/^(\d{1,2}):(\d{2})(am|pm)$/)
	if (!match || !match[1] || !match[2] || !match[3]) {
		throw new Error(`Failed to parse publish_time_pt: "${time}"`)
	}

	let hour = parseInt(match[1], 10)
	const minute = parseInt(match[2], 10)
	const period = match[3]

	// Convert 12-hour to 24-hour format
	if (period === "am") {
		// 12:xxam = 0:xx (midnight hour)
		if (hour === 12) {
			hour = 0
		}
	} else {
		// pm
		// 12:xxpm = 12:xx (noon hour)
		// 1:xxpm = 13:xx, etc.
		if (hour !== 12) {
			hour += 12
		}
	}

	return hour * 60 + minute
}

/**
 * Format a publish_date for display.
 * Returns the date as-is since it's already in YYYY-MM-DD format.
 *
 * @param publishDate - Date string in YYYY-MM-DD format
 * @returns Formatted date string (YYYY-MM-DD)
 *
 * @example
 * ```ts
 * formatPostDatePt('2026-01-29'); // '2026-01-29'
 * ```
 */
export function formatPostDatePt(publishDate: string): string {
	// The publish_date is already in YYYY-MM-DD format (Pacific Time)
	// Per spec, we display date only, no time shown to users
	return publishDate
}
