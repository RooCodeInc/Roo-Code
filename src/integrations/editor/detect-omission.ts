/**
 * Detects potential AI-generated code omissions in the given file content.
 * Looks for comments containing omission keywords that weren't in the original file.
 * @param originalFileContent The original content of the file.
 * @param newFileContent The new content of the file to check.
 * @returns True if a potential omission is detected, false otherwise.
 */
export function detectCodeOmission(originalFileContent: string, newFileContent: string): boolean {
	const actualLineCount = newFileContent.split("\n").length

	// Skip checks for small files (less than 100 lines)
	if (actualLineCount < 100) {
		return false
	}

	const originalLines = originalFileContent.split("\n")
	const newLines = newFileContent.split("\n")
	const omissionKeywords = [
		"remain",
		"remains",
		"unchanged",
		"rest",
		"previous",
		"existing",
		"content",
		"same",
		"...",
	]

	const commentPatterns = [
		/^\s*\/\//, // Single-line comment for most languages
		/^\s*#/, // Single-line comment for Python, Ruby, etc.
		/^\s*\/\*/, // Multi-line comment opening
		/^\s*{\s*\/\*/, // JSX comment opening
		/^\s*<!--/, // HTML comment opening
		/^\s*\[/, // Square bracket notation
	]

	// Consider comments as suspicious if they weren't in the original file
	// and contain omission keywords
	for (const line of newLines) {
		if (commentPatterns.some((pattern) => pattern.test(line))) {
			const words = line.toLowerCase().split(/\s+/)
			if (omissionKeywords.some((keyword) => words.includes(keyword))) {
				if (!originalLines.includes(line)) {
					return true
				}
			}
		}
	}

	return false
}
