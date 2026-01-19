import type { HistoryItem } from "@roo-code/types"

import type { ClineProvider } from "./ClineProvider"
import type { WebviewMessage } from "../../shared/WebviewMessage"

const MAX_TITLE_LENGTH = 255

/**
 * Sanitizes and normalizes a title string:
 * - Removes control characters
 * - Normalizes whitespace
 * - Trims leading/trailing whitespace
 * - Truncates if too long
 * - Returns undefined for empty strings
 */
function normalizeTitle(title: string | undefined | null, ids?: string[]): string | undefined {
	const rawTitle = title ?? ""

	// Sanitize: remove control characters and normalize whitespace
	const sanitized = rawTitle
		// eslint-disable-next-line no-control-regex
		.replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Remove control characters
		.replace(/\s+/g, " ") // Normalize whitespace
		.trim()

	// Clear empty titles
	if (sanitized.length === 0) {
		return undefined
	}

	// Truncate if too long
	if (sanitized.length > MAX_TITLE_LENGTH) {
		const truncated = sanitized.slice(0, MAX_TITLE_LENGTH).trim()
		console.warn(
			`[setTaskTitle] Title truncated from ${sanitized.length} to ${MAX_TITLE_LENGTH} chars for task(s): ${ids?.join(", ") ?? "unknown"}`,
		)
		return truncated
	}

	return sanitized
}

/**
 * Handles the setTaskTitle webview message.
 * Updates task titles for one or more history items, with deduplication and no-op detection.
 */
export async function handleSetTaskTitle(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	// 1. Validate and deduplicate incoming task IDs
	const ids = Array.isArray(message.ids)
		? Array.from(new Set(message.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)))
		: []

	if (ids.length === 0) {
		return
	}

	// 2. Normalize the incoming title (with sanitization and truncation)
	const normalizedTitle = normalizeTitle(message.text, ids)

	// 3. Get task history from state
	const { taskHistory } = await provider.getState()
	if (!Array.isArray(taskHistory) || taskHistory.length === 0) {
		return
	}

	// 4. Create a map for O(1) lookups
	const historyById = new Map(taskHistory.map((item) => [item.id, item] as const))

	// 5. Process each ID, skipping no-ops
	let hasUpdates = false

	for (const id of ids) {
		const existingItem = historyById.get(id)
		if (!existingItem) {
			console.warn(`[setTaskTitle] Unable to locate task history item with id ${id}`)
			continue
		}

		// Normalize existing title for comparison
		const normalizedExistingTitle =
			existingItem.title && existingItem.title.trim().length > 0 ? existingItem.title.trim() : undefined

		// Skip if title is unchanged
		if (normalizedExistingTitle === normalizedTitle) {
			continue
		}

		// Update the history item
		const updatedItem: HistoryItem = {
			...existingItem,
			title: normalizedTitle,
		}

		await provider.updateTaskHistory(updatedItem)
		hasUpdates = true
	}

	// 6. Sync webview state if there were changes
	if (hasUpdates) {
		await provider.postStateToWebview()
	}
}
