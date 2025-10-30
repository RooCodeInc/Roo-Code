/**
 * Frontend-only normalization helper.
 * - If a unified diff already exists, return it.
 * - If a Roo SEARCH/REPLACE block is provided, convert to unified diff.
 * - If it's a new file with raw content, synthesize a unified diff with all lines as additions.
 * - Otherwise, pass through raw content (DiffView will no-op if not unified).
 */
export function extractUnifiedDiff(params: {
	toolName?: string
	path?: string
	diff?: string
	content?: string
}): string {
	const filePath = params.path || "file"
	let raw = (params.diff ?? params.content ?? "") || ""

	if (!raw) return ""

	raw = stripCData(raw)

	// Explicit new file: build a unified diff from raw content
	if ((params.toolName || "").toLowerCase() === "newfilecreated") {
		return convertNewFileToUnifiedDiff(raw, filePath)
	}

	// SEARCH/REPLACE blocks → unified
	if (isSearchReplace(raw)) {
		return convertSearchReplaceToUnifiedDiff(raw, filePath)
	}

	// Already unified?
	if (isUnifiedDiff(raw)) {
		return raw
	}

	// Fallback: return as-is (non-unified content)
	return raw
}

/** Detects unified diff by presence of headers/hunks */
function isUnifiedDiff(s: string): boolean {
	const hasHunk = /(^|\n)@@\s+-[0-9,]+\s+\+[0-9,]+\s+@@/.test(s)
	const hasHeaders = /(^|\n)---\s|\n\+\+\+\s/.test(s)
	return hasHunk || hasHeaders
}

/** Detects Roo SEARCH/REPLACE multi-block format */
function isSearchReplace(s: string): boolean {
	return (
		/(^|\n)<<<<<<< ?SEARCH|(^|\n)<<<<<<<? ?SEARCH|(^|\n)<<<<<<< SEARCH>/.test(s) || /(^|\n)<<<<<<< ?SEARCH/.test(s)
	)
}

/** Remove CDATA markers and any HTML-encoded variants */
function stripCData(s: string): string {
	return (
		s
			// Remove HTML-encoded and raw CDATA open
			.replace(/<!\[CDATA\[/gi, "")
			.replace(/<!\[CDATA\[/g, "")
			// Remove HTML-encoded and raw CDATA close
			.replace(/\]\]>/gi, "")
			.replace(/\]\]>/g, "")
	)
}

/**
 * Convert Roo SEARCH/REPLACE blocks into unified diff using the diff library.
 * Matches optional metadata lines and optional '-------' separator.
 */
export function convertSearchReplaceToUnifiedDiff(content: string, filePath?: string): string {
	// Backend-compatible regex: captures :start_line: and :end_line:, optional '-------', and SEARCH/REPLACE bodies
	const blockRegex =
		/(?:^|\n)(?<!\\)<<<<<<< SEARCH>?\s*\n((?::start_line:\s*(\d+)\s*\n))?((?::end_line:\s*(\d+)\s*\n))?((?<!\\)-------\s*\n)?([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)=======\s*\n)([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)>>>>>>> REPLACE)(?=\n|$)/g

	const fileName = filePath || "file"
	let hasBlocks = false
	let headerEmitted = false
	let unified = ""

	// Helper to normalize EOLs and get stable line arrays without trailing empty caused by final newline
	const toStableLines = (s: string): string[] => {
		const norm = s.replace(/\r\n/g, "\n")
		if (norm === "") return []
		const parts = norm.split("\n")
		return parts[parts.length - 1] === "" ? parts.slice(0, -1) : parts
	}

	let match: RegExpExecArray | null
	while ((match = blockRegex.exec(content)) !== null) {
		hasBlocks = true

		// 1: full start_line line, 2: start_line number, 3: full end_line line, 4: end_line number
		const startLine = match[2] ? parseInt(match[2], 10) : 1
		const endLine = match[4] ? parseInt(match[4], 10) : undefined

		// 6: SEARCH body, 7: REPLACE body
		const searchBody = match[6] ?? ""
		const replaceBody = match[7] ?? ""

		const searchLines = toStableLines(searchBody)
		const replaceLines = toStableLines(replaceBody)

		// Old/new hunk metadata. If end_line is present, prefer it for oldLines; otherwise count SEARCH lines.
		const oldStart = startLine
		const oldLines = endLine !== undefined ? Math.max(0, endLine - startLine + 1) : searchLines.length
		const newStart = startLine
		const newLines = replaceLines.length

		// Emit file headers once so parsePatch can recognize a complete unified diff
		if (!headerEmitted) {
			unified += `--- a/${fileName}\n`
			unified += `+++ b/${fileName}\n`
			headerEmitted = true
		}

		// Hunk header
		unified += `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@\n`

		// We don't have surrounding context here; emit deletions then additions to visualize the change
		for (const line of searchLines) unified += `-${line}\n`
		for (const line of replaceLines) unified += `+${line}\n`
	}

	return hasBlocks ? unified : content
}

/** Build a unified diff for a brand new file (all content lines are additions).
 * Trailing newline is ignored for line counting and emission.
 */
export function convertNewFileToUnifiedDiff(content: string, filePath?: string): string {
	const fileName = filePath || "file"
	// Normalize EOLs to keep counts consistent
	const normalized = content.replace(/\r\n/g, "\n")
	const parts = normalized.split("\n")
	// Drop trailing empty item produced by a final newline so we count only real content lines
	const contentLines = parts[parts.length - 1] === "" ? parts.slice(0, -1) : parts

	let diff = `--- /dev/null\n`
	diff += `+++ ${fileName}\n`
	diff += `@@ -0,0 +1,${contentLines.length} @@\n`

	for (const line of contentLines) {
		diff += `+${line}\n`
	}

	return diff
}
