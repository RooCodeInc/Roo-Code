/**
 * Formats a Unix timestamp (in milliseconds) to a human-readable time string.
 *
 * Requirements from Issue #10539:
 * - 24-hour format (14:34)
 * - Full date for messages from previous days (e.g., "Jan 7, 14:34")
 * - Text-size same as header row text
 *
 * @param ts - Unix timestamp in milliseconds
 * @returns Formatted time string
 */
export function formatTimestamp(ts: number): string {
	const date = new Date(ts)
	const now = new Date()

	// Check if the message is from today
	const isToday =
		date.getDate() === now.getDate() &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear()

	// Format hours and minutes in 24-hour format
	const hours = date.getHours().toString().padStart(2, "0")
	const minutes = date.getMinutes().toString().padStart(2, "0")
	const time = `${hours}:${minutes}`

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
