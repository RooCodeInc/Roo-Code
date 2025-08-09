/**
 * Gitignore Pattern Parser
 *
 * This module provides utilities for handling .gitignore patterns correctly.
 *
 * IMPORTANT: .gitignore patterns are NOT regular expressions!
 * They use a glob-like syntax with specific rules that differ from regex:
 *
 * Key differences from regex:
 * 1. Character classes like [A-/] are valid in gitignore but invalid in regex
 *    - In gitignore, invalid ranges are treated as literal characters
 *    - Example: pqh[A-/] in gitignore matches pqh followed by 'A' (not a range)
 *
 * 2. Wildcards have different meanings:
 *    - * in gitignore matches any string except /
 *    - ** in gitignore matches any string including /
 *    - ? in gitignore matches any single character except /
 *
 * 3. Path separators are significant:
 *    - Patterns starting with / are anchored to the root
 *    - Patterns containing / (but not starting with /) match relative paths
 *    - Patterns without / match anywhere in the tree
 *
 * 4. Negation:
 *    - Patterns starting with ! are negation patterns
 *
 * 5. Directory matching:
 *    - Patterns ending with / only match directories
 *
 * @see https://git-scm.com/docs/gitignore for full specification
 */

import ignore, { Ignore } from "ignore"

/**
 * Result of parsing a gitignore pattern
 */
export interface GitignoreParseResult {
	/** Successfully parsed patterns */
	validPatterns: string[]
	/** Patterns that failed to parse with the ignore library */
	invalidPatterns: Array<{
		pattern: string
		error: string
	}>
	/** Patterns that were transformed to be compatible */
	transformedPatterns: Array<{
		original: string
		transformed: string
		reason: string
	}>
}

/**
 * Attempts to sanitize a gitignore pattern to make it compatible with the ignore library.
 *
 * The ignore library uses JavaScript regex internally, which has stricter rules than
 * git's pattern matching. This function attempts to transform patterns that are valid
 * in gitignore but would cause errors in the ignore library.
 *
 * @param pattern The original gitignore pattern
 * @returns The sanitized pattern or null if it cannot be sanitized
 */
export function sanitizeGitignorePattern(pattern: string): { transformed: string; reason: string } | null {
	const trimmed = pattern.trim()

	// Skip empty lines and comments
	if (!trimmed || trimmed.startsWith("#")) {
		return null
	}

	let transformed = trimmed
	let reason = ""

	// Handle invalid character ranges in character classes
	// Example: [A-/] is valid in gitignore but invalid in regex
	// Git treats this as matching just 'A', not as a range
	const invalidRangeRegex = /\[([^[\]]*[A-Z]-[^A-Za-z][^[\]]*)\]/g
	if (invalidRangeRegex.test(transformed)) {
		transformed = transformed.replace(invalidRangeRegex, (match, rangeContent) => {
			// Extract the starting character of the invalid range
			const rangeMatch = rangeContent.match(/([A-Z])-[^A-Za-z]/)
			if (rangeMatch) {
				const startChar = rangeMatch[1]
				// Replace the entire character class with just the starting character
				reason = `Invalid character range in pattern - treating as literal '${startChar}'`
				return startChar
			}
			return match
		})
	}

	// Handle reverse ranges like [Z-A]
	// We need to escape the problematic ranges in our own regex!
	const reverseRangeRegex = /\[([^[\]]*[ZYXWVUTSRQzyxwvutsrq]-[ABCDEFGHIJKLMNOPabcdefghijklmnop][^[\]]*)\]/g
	if (reverseRangeRegex.test(transformed)) {
		transformed = transformed.replace(reverseRangeRegex, (match, rangeContent) => {
			const rangeMatch = rangeContent.match(/([A-Za-z])-([A-Za-z])/)
			if (rangeMatch && rangeMatch[1] > rangeMatch[2]) {
				const startChar = rangeMatch[1]
				reason = `Reverse character range in pattern - treating as literal '${startChar}'`
				return startChar
			}
			return match
		})
	}

	// If we made any transformations, return the result
	if (transformed !== trimmed) {
		return { transformed, reason }
	}

	return null
}

/**
 * Parses gitignore content and returns an ignore instance with valid patterns.
 *
 * This function handles invalid patterns gracefully by:
 * 1. Attempting to sanitize patterns that are valid in gitignore but not in regex
 * 2. Skipping patterns that cannot be parsed
 * 3. Logging warnings for problematic patterns
 *
 * @param content The content of a .gitignore file
 * @param logWarnings Whether to log warnings for invalid patterns
 * @returns An ignore instance and parse results
 */
export function parseGitignoreContent(
	content: string,
	logWarnings = true,
): { ignoreInstance: Ignore; parseResult: GitignoreParseResult } {
	const ignoreInstance = ignore()
	const parseResult: GitignoreParseResult = {
		validPatterns: [],
		invalidPatterns: [],
		transformedPatterns: [],
	}

	// First, try to add all content at once (fastest path)
	try {
		ignoreInstance.add(content)
		// Always add .gitignore itself
		ignoreInstance.add(".gitignore")

		// If successful, check for patterns that should be transformed
		const lines = content.split("\n")
		let hasTransformations = false

		for (const line of lines) {
			const trimmed = line.trim()
			if (!trimmed || trimmed.startsWith("#")) {
				continue
			}

			// Check if this pattern would benefit from transformation
			const sanitized = sanitizeGitignorePattern(trimmed)
			if (sanitized) {
				hasTransformations = true
				break
			}
		}

		// If there are no transformations needed, return early
		if (!hasTransformations) {
			const validLines = lines.filter((line) => {
				const trimmed = line.trim()
				return trimmed && !trimmed.startsWith("#")
			})
			parseResult.validPatterns = validLines
			parseResult.validPatterns.push(".gitignore")
			return { ignoreInstance, parseResult }
		}

		// If there are transformations, fall through to line-by-line parsing
		if (logWarnings) {
			console.warn(
				"Warning: .gitignore contains patterns that may not work as expected. " +
					"Analyzing patterns for compatibility.",
			)
		}
	} catch (error) {
		// Bulk parsing failed, parse line by line
		if (logWarnings) {
			console.warn(
				"Warning: .gitignore contains patterns that could not be parsed in bulk. " +
					"Parsing line by line to identify problematic patterns.",
			)
		}
	}

	// Reset the ignore instance for line-by-line parsing
	const freshIgnoreInstance = ignore()

	// Parse line by line to identify and handle problematic patterns
	const lines = content.split("\n")
	for (const line of lines) {
		const trimmed = line.trim()

		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith("#")) {
			continue
		}

		// Check if this pattern needs transformation
		const sanitized = sanitizeGitignorePattern(trimmed)

		if (sanitized) {
			// Pattern needs transformation
			try {
				const testIgnore = ignore()
				testIgnore.add(sanitized.transformed)
				freshIgnoreInstance.add(sanitized.transformed)
				parseResult.transformedPatterns.push({
					original: trimmed,
					transformed: sanitized.transformed,
					reason: sanitized.reason,
				})

				if (logWarnings) {
					console.warn(
						`Transformed gitignore pattern "${trimmed}" to "${sanitized.transformed}": ${sanitized.reason}`,
					)
				}
			} catch (transformError) {
				// Even the transformed pattern failed
				parseResult.invalidPatterns.push({
					pattern: trimmed,
					error: transformError instanceof Error ? transformError.message : String(transformError),
				})

				if (logWarnings) {
					console.warn(`Skipping invalid .gitignore pattern: "${trimmed}"`)
				}
			}
		} else {
			// Pattern doesn't need transformation, try it as-is
			try {
				const testIgnore = ignore()
				testIgnore.add(trimmed)
				freshIgnoreInstance.add(trimmed)
				parseResult.validPatterns.push(trimmed)
			} catch (error) {
				// Pattern failed and couldn't be sanitized
				parseResult.invalidPatterns.push({
					pattern: trimmed,
					error: error instanceof Error ? error.message : String(error),
				})

				if (logWarnings) {
					console.warn(`Skipping invalid .gitignore pattern: "${trimmed}"`)
				}
			}
		}
	}

	// Always add .gitignore itself
	try {
		freshIgnoreInstance.add(".gitignore")
		if (!parseResult.validPatterns.includes(".gitignore")) {
			parseResult.validPatterns.push(".gitignore")
		}
	} catch {
		// Even this basic pattern failed, but continue anyway
	}

	// Use the fresh instance if we did line-by-line parsing
	return { ignoreInstance: freshIgnoreInstance, parseResult }
}

/**
 * Creates an ignore instance from a .gitignore file path.
 *
 * @param gitignorePath Path to the .gitignore file
 * @param logWarnings Whether to log warnings for invalid patterns
 * @returns A promise that resolves to an ignore instance and parse results
 */
export async function createIgnoreInstanceFromFile(
	gitignorePath: string,
	logWarnings = true,
): Promise<{ ignoreInstance: Ignore; parseResult: GitignoreParseResult | null }> {
	const fs = await import("fs/promises")

	try {
		const content = await fs.readFile(gitignorePath, "utf8")
		return parseGitignoreContent(content, logWarnings)
	} catch (error) {
		if (logWarnings) {
			console.info(".gitignore file not found or could not be read, proceeding without gitignore patterns")
		}

		const ignoreInstance = ignore()
		// Add .gitignore itself even if the file doesn't exist
		try {
			ignoreInstance.add(".gitignore")
		} catch {
			// Continue even if this fails
		}

		return { ignoreInstance, parseResult: null }
	}
}
