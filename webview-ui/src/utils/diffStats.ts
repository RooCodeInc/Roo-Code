/**
 * Shared utility for computing diff statistics from various diff formats
 */

/**
 * Compute +/− counts from a unified diff (ignores headers/hunk lines)
 */
export function computeUnifiedDiffStats(diff?: string): { added: number; removed: number } | null {
	if (!diff) return null

	let added = 0
	let removed = 0
	let sawPlusMinus = false

	for (const line of diff.split("\n")) {
		// Skip unified diff headers and hunk markers
		if (line.startsWith("+++ ") || line.startsWith("--- ") || line.startsWith("@@")) continue

		if (line.startsWith("+")) {
			added++
			sawPlusMinus = true
		} else if (line.startsWith("-")) {
			removed++
			sawPlusMinus = true
		}
	}

	if (sawPlusMinus && (added > 0 || removed > 0)) {
		return { added, removed }
	}

	return null
}

/**
 * Compute +/− counts from Roo's multi-search-replace block format
 */
export function computeSearchReplaceDiffStats(diff?: string): { added: number; removed: number } | null {
	if (!diff) return null

	// Matches optional metadata lines and optional '-------' line
	const blockRegex =
		/<<<<<<?\s*SEARCH[\s\S]*?(?:^:start_line:.*\n)?(?:^:end_line:.*\n)?(?:^-------\s*\n)?([\s\S]*?)^(?:=======\s*\n)([\s\S]*?)^(?:>>>>>>> REPLACE)/gim

	const asLines = (s: string) => {
		// Normalize Windows newlines and trim trailing newline so counts reflect real lines
		const norm = (s || "").replace(/\r\n/g, "\n")
		if (!norm) return 0
		const parts = norm.split("\n")
		return parts[parts.length - 1] === "" ? parts.length - 1 : parts.length
	}

	let hasBlocks = false
	let added = 0
	let removed = 0

	let match: RegExpExecArray | null
	while ((match = blockRegex.exec(diff)) !== null) {
		hasBlocks = true
		const searchContent = match[1] ?? ""
		const replaceContent = match[2] ?? ""
		const searchCount = asLines(searchContent)
		const replaceCount = asLines(replaceContent)

		if (replaceCount > searchCount) {
			added += replaceCount - searchCount
		} else if (searchCount > replaceCount) {
			removed += searchCount - replaceCount
		}
	}

	if (hasBlocks && (added > 0 || removed > 0)) {
		return { added, removed }
	}

	return null
}

/**
 * Compute diff stats from any supported diff format (unified or search-replace)
 * Tries unified diff format first, then falls back to search-replace format
 */
export function computeDiffStats(diff?: string): { added: number; removed: number } | null {
	if (!diff) return null

	// Try unified diff format first
	const unifiedStats = computeUnifiedDiffStats(diff)
	if (unifiedStats) return unifiedStats

	// Fall back to search-replace format
	return computeSearchReplaceDiffStats(diff)
}
