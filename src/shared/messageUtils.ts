import type { ClineMessage } from "@roo-code/types"
import { isDiffStats } from "./typeGuards"

/**
 * Extract line statistics (added/removed) from tool approval messages in the message history.
 * This function scans messages for diff statistics from completed tool approval requests,
 * including both single file operations and batch operations.
 *
 * @param messages - Array of ClineMessage objects to analyze
 * @returns Object containing total lines added, removed, and whether any stats were found
 */
export function getLineStatsFromToolApprovalMessages(messages: ClineMessage[]): {
	linesAdded: number
	linesRemoved: number
	foundAnyStats: boolean
} {
	let linesAdded = 0
	let linesRemoved = 0
	let foundAnyStats = false

	for (const m of messages) {
		// Only count complete tool approval asks (avoid double-counting partial/streaming updates)
		if (!(m.type === "ask" && m.ask === "tool" && m.partial !== true)) continue
		if (typeof m.text !== "string" || m.text.length === 0) continue

		let payload: unknown
		try {
			payload = JSON.parse(m.text)
		} catch {
			continue
		}

		if (!payload || typeof payload !== "object") continue
		const p = payload as { diffStats?: unknown; batchDiffs?: unknown }

		if (isDiffStats(p.diffStats)) {
			linesAdded += p.diffStats.added
			linesRemoved += p.diffStats.removed
			foundAnyStats = true
		}

		if (Array.isArray(p.batchDiffs)) {
			for (const batchDiff of p.batchDiffs) {
				if (!batchDiff || typeof batchDiff !== "object") continue
				const bd = batchDiff as { diffStats?: unknown }
				if (!isDiffStats(bd.diffStats)) continue
				linesAdded += bd.diffStats.added
				linesRemoved += bd.diffStats.removed
				foundAnyStats = true
			}
		}
	}

	return { linesAdded, linesRemoved, foundAnyStats }
}
