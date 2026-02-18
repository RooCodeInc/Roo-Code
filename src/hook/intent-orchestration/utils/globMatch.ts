/**
 * Glob matching utility for scope enforcement
 */

/**
 * Match a file path against a glob pattern
 * Supports basic glob patterns: *, **, ?
 */
export function globMatch(filePath: string, pattern: string): boolean {
	// Convert glob pattern to regex
	const regexPattern = pattern
		// Escape special regex characters except glob wildcards
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		// ** matches any number of directories
		.replace(/\*\*/g, "___GLOBSTAR___")
		// * matches any characters except /
		.replace(/\*/g, "[^/]*")
		// ? matches single character
		.replace(/\?/g, ".")
		// Restore ** as .*
		.replace(/___GLOBSTAR___/g, ".*")

	const regex = new RegExp(`^${regexPattern}$`)
	return regex.test(filePath)
}

/**
 * Check if a file path matches any of the given patterns
 */
export function globMatchAny(filePath: string, patterns: string[]): boolean {
	return patterns.some((pattern) => globMatch(filePath, pattern))
}
