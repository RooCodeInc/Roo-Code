/**
 * Diff Parser
 *
 * Parses unified diff format to extract old and new text.
 * Used for displaying file changes in ACP tool calls.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Result of parsing a unified diff.
 */
export interface ParsedDiff {
	/** Original text (null for new files) */
	oldText: string | null
	/** New text content */
	newText: string
}

// =============================================================================
// Diff Parsing
// =============================================================================

/**
 * Parse a unified diff string to extract old and new text.
 *
 * Handles standard unified diff format:
 * ```
 * --- a/file.txt
 * +++ b/file.txt
 * @@ -1,3 +1,4 @@
 *  context line
 * -removed line
 * +added line
 *  more context
 * ```
 *
 * For non-diff content (raw file content), returns { oldText: null, newText: content }.
 *
 * @param diffString - The diff string to parse
 * @returns Parsed diff with old and new text, or null if invalid
 */
export function parseUnifiedDiff(diffString: string): ParsedDiff | null {
	if (!diffString) {
		return null
	}

	// Check if this is a unified diff format
	if (!diffString.includes("@@") && !diffString.includes("---") && !diffString.includes("+++")) {
		// Not a diff, treat as raw content
		return { oldText: null, newText: diffString }
	}

	const lines = diffString.split("\n")
	const oldLines: string[] = []
	const newLines: string[] = []
	let inHunk = false
	let isNewFile = false

	for (const line of lines) {
		// Check for new file indicator
		if (line.startsWith("--- /dev/null")) {
			isNewFile = true
			continue
		}

		// Skip diff headers
		if (line.startsWith("===") || line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@")) {
			if (line.startsWith("@@")) {
				inHunk = true
			}
			continue
		}

		if (!inHunk) {
			continue
		}

		if (line.startsWith("-")) {
			// Removed line (old content)
			oldLines.push(line.slice(1))
		} else if (line.startsWith("+")) {
			// Added line (new content)
			newLines.push(line.slice(1))
		} else if (line.startsWith(" ") || line === "") {
			// Context line (in both old and new)
			const contextLine = line.startsWith(" ") ? line.slice(1) : line
			oldLines.push(contextLine)
			newLines.push(contextLine)
		}
	}

	return {
		oldText: isNewFile ? null : oldLines.join("\n") || null,
		newText: newLines.join("\n"),
	}
}

/**
 * Check if a string appears to be a unified diff.
 */
export function isUnifiedDiff(content: string): boolean {
	return content.includes("@@") || (content.includes("---") && content.includes("+++"))
}
