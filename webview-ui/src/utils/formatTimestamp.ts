export type TimestampFormat = "12hour" | "24hour"

/**
 * Formats a Unix timestamp (in milliseconds) to a human-readable time string.
 *
 * Requirements from Issue #10539:
 * - Configurable 12-hour (2:34 PM) or 24-hour (14:34) format
 * - Full date for messages from previous days (e.g., "Jan 7, 14:34" or "Jan 7, 2:34 PM")
 * - Text-size same as header row text
 *
 * @param ts - Unix timestamp in milliseconds
 * @param format - Time format: "12hour" for AM/PM, "24hour" for 24-hour format (default: "24hour")
 * @returns Formatted time string
 */
export function formatTimestamp(ts: number, format: TimestampFormat = "24hour"): string {
	const date = new Date(ts)
	const now = new Date()

	// Check if the message is from today
	const isToday =
		date.getDate() === now.getDate() &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear()

	// Format the time based on the selected format
	const time = formatTime(date, format)

	if (isToday) {
		// Just show time for today's messages
		return time
	}

	// For older messages, show abbreviated month, day, and time
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
	const month = months[date.getMonth()]
	const day = date.getDate()

	return `${month} ${day}, ${time}`
}

/**
 * Formats just the time portion of a date.
 *
 * @param date - Date object to format
 * @param format - Time format: "12hour" for AM/PM, "24hour" for 24-hour format
 * @returns Formatted time string
 */
function formatTime(date: Date, format: TimestampFormat): string {
	const hours24 = date.getHours()
	const minutes = date.getMinutes().toString().padStart(2, "0")

	if (format === "12hour") {
		const hours12 = hours24 % 12 || 12 // Convert 0 to 12 for midnight
		const period = hours24 < 12 ? "AM" : "PM"
		return `${hours12}:${minutes} ${period}`
	}

	// 24-hour format
	const hours = hours24.toString().padStart(2, "0")
	return `${hours}:${minutes}`
}
