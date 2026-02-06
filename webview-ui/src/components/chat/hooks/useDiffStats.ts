import { useMemo } from "react"

import type { ClineMessage, ClineSayTool } from "@roo-code/types"

import { safeJsonParse } from "@roo/core"

/** Tools that produce file-editing diffs with diffStats. */
const FILE_EDIT_TOOLS = new Set(["editedExistingFile", "appliedDiff", "newFileCreated"])

export interface AggregatedDiffStats {
	totalAdded: number
	totalRemoved: number
}

/**
 * Extracts and aggregates diffStats from all file-editing tool messages in the
 * provided clineMessages array. Both `ask === "tool"` and `say === "tool"`
 * messages are inspected because the backend emits diffStats in both paths.
 *
 * Handles:
 * - Individual file tools with a top-level `diffStats` property.
 * - Batch diff tools with per-file `batchDiffs[].diffStats` entries.
 *
 * The result is memoized so it only recomputes when the messages array identity
 * or length changes.
 */
export function useDiffStats(clineMessages: ClineMessage[] | undefined): AggregatedDiffStats {
	return useMemo(() => aggregateDiffStats(clineMessages), [clineMessages])
}

/**
 * Pure function (no hooks) that performs the aggregation.  Useful in tests and
 * in non-React contexts.
 */
export function aggregateDiffStats(clineMessages: ClineMessage[] | undefined): AggregatedDiffStats {
	let totalAdded = 0
	let totalRemoved = 0

	if (!clineMessages || clineMessages.length === 0) {
		return { totalAdded, totalRemoved }
	}

	for (const msg of clineMessages) {
		// Tool messages can appear as ask="tool" or say="tool"
		const isTool = msg.ask === "tool" || (msg as any).say === "tool"
		if (!isTool || !msg.text) {
			continue
		}

		const parsed = safeJsonParse<ClineSayTool>(msg.text)
		if (!parsed) {
			continue
		}

		// Individual file tool
		if (FILE_EDIT_TOOLS.has(parsed.tool) && parsed.diffStats) {
			totalAdded += parsed.diffStats.added || 0
			totalRemoved += parsed.diffStats.removed || 0
		}

		// Batch diffs (e.g. appliedDiff with multiple files)
		if (parsed.batchDiffs && Array.isArray(parsed.batchDiffs)) {
			for (const entry of parsed.batchDiffs) {
				if (entry.diffStats) {
					totalAdded += entry.diffStats.added || 0
					totalRemoved += entry.diffStats.removed || 0
				}
			}
		}
	}

	return { totalAdded, totalRemoved }
}
