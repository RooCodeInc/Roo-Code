/**
 * Trigger detection logic for autocomplete overlays.
 *
 * Pure functions that detect when a trigger character is typed
 * and extract the search query. No JSX or rendering logic here.
 *
 * Trigger characters:
 * - `/` — slash commands (line-start only)
 * - `@` — file search (anywhere in line)
 * - `!` — mode switcher (line-start only)
 * - `?` — help shortcuts (line-start only)
 * - `#` — task history (line-start only)
 */

export type TriggerType = "slash" | "file" | "mode" | "help" | "history"

export interface TriggerDetection {
	type: TriggerType
	query: string
	triggerIndex: number
}

/**
 * Detect which trigger (if any) is active given the current input text.
 * Returns the first matching trigger, prioritized by specificity.
 *
 * @param text — the current full text of the input
 * @returns TriggerDetection or null if no trigger active
 */
export function detectTrigger(text: string): TriggerDetection | null {
	// We only examine the current line (last line of multi-line input)
	const lines = text.split("\n")
	const line = lines[lines.length - 1] ?? ""

	// Line-start triggers: check if line starts with trigger char (after optional whitespace)
	const trimmed = line.trimStart()
	const leadingWhitespace = line.length - trimmed.length

	// ? — help (line-start, first char only)
	if (trimmed.startsWith("?")) {
		const query = trimmed.substring(1)
		if (!query.includes(" ")) {
			return { type: "help", query, triggerIndex: leadingWhitespace }
		}
	}

	// / — slash commands (line-start)
	if (trimmed.startsWith("/")) {
		const query = trimmed.substring(1)
		if (!query.includes(" ")) {
			return { type: "slash", query, triggerIndex: leadingWhitespace }
		}
	}

	// ! — mode switcher (line-start)
	if (trimmed.startsWith("!")) {
		const query = trimmed.substring(1)
		if (!query.includes(" ")) {
			return { type: "mode", query, triggerIndex: leadingWhitespace }
		}
	}

	// # — task history (line-start)
	if (trimmed.startsWith("#")) {
		const query = trimmed.substring(1)
		// Note: no space check for history — allow full search
		return { type: "history", query, triggerIndex: leadingWhitespace }
	}

	// @ — file search (anywhere in line)
	const atIndex = line.lastIndexOf("@")
	if (atIndex !== -1) {
		const query = line.substring(atIndex + 1)
		if (!query.includes(" ")) {
			return { type: "file", query, triggerIndex: atIndex }
		}
	}

	return null
}

/**
 * Format a timestamp as a relative time string (e.g., "2 days ago").
 */
export function formatRelativeTime(ts: number): string {
	const now = Date.now()
	const diff = now - ts

	const seconds = Math.floor(diff / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)

	if (days > 0) return days === 1 ? "1 day ago" : `${days} days ago`
	if (hours > 0) return hours === 1 ? "1 hour ago" : `${hours} hours ago`
	if (minutes > 0) return minutes === 1 ? "1 min ago" : `${minutes} mins ago`
	return "just now"
}

/**
 * Truncate text to a max length with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text
	return text.substring(0, maxLength - 1) + "…"
}

/**
 * Generate replacement text for a trigger selection.
 * Replaces the trigger + query with the selected value.
 */
export function getReplacementText(
	type: TriggerType,
	selectedValue: string,
	currentLine: string,
	triggerIndex: number,
): string {
	const before = currentLine.substring(0, triggerIndex)

	switch (type) {
		case "slash":
			return `${before}/${selectedValue} `
		case "file":
			return `${before}@/${selectedValue} `
		case "mode":
			// Mode switching clears the input
			return ""
		case "help":
			// Help selection inserts the trigger char or clears
			return selectedValue
		case "history":
			// History selection clears the input (task is resumed)
			return ""
		default:
			return currentLine
	}
}
