/**
 * Frontend-only normalization helper.
 * - If a unified diff already exists, return it.
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
	// Remove diff noise lines like "\ No newline at end of file"
	raw = raw.replace(/(^|\n)[ \t]*(?:\\ )?No newline at end of file[ \t]*(?=\n|$)/gi, "$1")

	// Explicit new file: build a unified diff from raw content
	if ((params.toolName || "").toLowerCase() === "newfilecreated") {
		return convertNewFileToUnifiedDiff(raw, filePath)
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
	const hasHeaders = /(^|\n)---\s|(^|\n)\+\+\+\s/.test(s)
	return hasHunk || hasHeaders
}

/** Remove CDATA markers and any HTML-encoded variants */
function stripCData(s: string): string {
	return (
		s
			// First, normalize HTML-encoded CDATA markers to raw
			.replace(/&lt;!\[CDATA\[/gi, "<![CDATA[")
			.replace(/\]\]&gt;/gi, "]]>")
			// Then strip raw markers
			.replace(/<!\[CDATA\[/gi, "")
			.replace(/\]\]>/gi, "")
	)
}

/** Build a unified diff for a brand new file (all content lines are additions).
 * Trailing newline is ignored for line counting and emission.
 */
function convertNewFileToUnifiedDiff(content: string, filePath?: string): string {
	const fileName = filePath || "file"
	// Normalize EOLs to keep counts consistent
	const normalized = content.replace(/\r\n/g, "\n")
	const parts = normalized.split("\n")
	// Drop trailing empty item produced by a final newline so we count only real content lines
	const contentLines = parts[parts.length - 1] === "" ? parts.slice(0, -1) : parts

	const count = contentLines.length
	let diff = `--- /dev/null\n`
	diff += `+++ ${fileName}\n`
	diff += `@@ -0,0 +${count ? 1 : 0},${count} @@\n`

	for (const line of contentLines) {
		diff += `+${line}\n`
	}

	return diff
}
