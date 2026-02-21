/**
 * Path matcher utility for glob pattern matching
 *
 * Handles glob pattern matching with support for:
 * - Inclusion patterns (e.g., "src/**\/*.ts")
 * - Exclusion patterns (e.g., "!**\/*.test.ts")
 * - Windows/Unix path normalization
 */

import * as path from "path"

/**
 * Check if a file path matches a glob pattern
 * @param filePath - Absolute or relative path to the file
 * @param pattern - Glob pattern (e.g., "src/**/*.ts")
 * @param workspaceRoot - Root directory of the workspace (for resolving relative paths)
 * @returns true if the path matches the pattern
 */
export function matchesGlobPattern(
	filePath: string,
	pattern: string,
	workspaceRoot: string,
): boolean {
	try {
		// Normalize the file path
		const absolutePath = path.isAbsolute(filePath)
			? filePath
			: path.resolve(workspaceRoot, filePath)

		// Normalize workspace root path
		const normalizedWorkspaceRoot = path.normalize(workspaceRoot)

		// Make path relative to workspace root
		const relativePath = path.relative(normalizedWorkspaceRoot, absolutePath)

		// Normalize separators for glob (always use forward slashes)
		const normalizedPath = relativePath.split(path.sep).join("/")

		// Check if pattern is a negation
		const isNegation = pattern.startsWith("!")
		const actualPattern = isNegation ? pattern.slice(1) : pattern

		// Convert glob pattern to regex
		const regexPattern = globToRegex(actualPattern)

		// Test the pattern
		const match = regexPattern.test(normalizedPath)

		return isNegation ? !match : match
	} catch (error) {
		console.error(`Error matching glob pattern: ${error}`)
		return false
	}
}

/**
 * Check if a file path matches any of the glob patterns
 * @param filePath - Absolute or relative path to the file
 * @param patterns - Array of glob patterns
 * @param workspaceRoot - Root directory of the workspace
 * @returns true if the path matches any pattern (considering negations)
 */
export function matchesAnyGlobPattern(
	filePath: string,
	patterns: string[],
	workspaceRoot: string,
): boolean {
	if (!patterns || patterns.length === 0) {
		return false
	}

	// Split into inclusion and exclusion patterns
	const inclusions: string[] = []
	const exclusions: string[] = []

	for (const pattern of patterns) {
		if (pattern.startsWith("!")) {
			exclusions.push(pattern)
		} else {
			inclusions.push(pattern)
		}
	}

	// If no inclusions, treat empty as no match (require explicit scope)
	if (inclusions.length === 0) {
		return false
	}

	// Check if path matches any inclusion
	let matchesInclusion = false
	for (const pattern of inclusions) {
		if (matchesGlobPattern(filePath, pattern, workspaceRoot)) {
			matchesInclusion = true
			break
		}
	}

	if (!matchesInclusion) {
		return false
	}

	// Check if path matches any exclusion
	for (const pattern of exclusions) {
		if (matchesGlobPattern(filePath, pattern, workspaceRoot)) {
			return false // Excluded
		}
	}

	return true
}

/**
 * Convert a glob pattern to a regex pattern
 * Supports common glob patterns: *, **, ?, character classes
 */
function globToRegex(globPattern: string): RegExp {
	// Escape special regex characters except *, ?, [, ]
	let regex = globPattern
		.replace(/[.+^${}()|\\]/g, "\\$&") // Escape regex special chars
		.replace(/\*\*/g, "___DOUBLE_STAR___") // Temporarily replace **
		.replace(/\*/g, "[^/]*") // * matches anything except /
		.replace(/___DOUBLE_STAR___/g, ".*") // ** matches anything including /
		.replace(/\?/g, "[^/]") // ? matches single char except /
		.replace(/\[!/g, "[^") // [!...] becomes [^...]
		.replace(/\[/g, "[") // Keep character classes
		.replace(/\]/g, "]") // Keep character classes

	// Anchor to start and end
	return new RegExp(`^${regex}$`)
}
