import * as path from "path"
import { minimatch } from "minimatch"

/**
 * ScopeValidator validates file paths against intent scope patterns using glob matching.
 * Supports standard glob syntax including * (single segment) and ** (recursive).
 */
export class ScopeValidator {
	/**
	 * Checks if a file path matches any of the provided scope patterns.
	 * @param filePath The file path to validate (can be absolute or relative)
	 * @param patterns Array of glob patterns to match against
	 * @returns true if path matches any pattern, false otherwise
	 */
	matchesAnyPattern(filePath: string, patterns: string[]): boolean {
		if (patterns.length === 0) {
			return false
		}

		// Normalize path to use forward slashes (minimatch works best with forward slashes)
		const normalizedPath = this.normalizePath(filePath)

		// Check if any pattern matches
		return patterns.some((pattern) => {
			try {
				return minimatch(normalizedPath, pattern, {
					dot: true, // Allow matching hidden files/directories
					nocase: false, // Case-sensitive matching (important for cross-platform)
				})
			} catch (error) {
				// Invalid pattern - log and skip
				console.warn(`[ScopeValidator] Invalid glob pattern: ${pattern}`, error)
				return false
			}
		})
	}

	/**
	 * Validates a file path against scope patterns.
	 * @param filePath The file path to validate
	 * @param scopePatterns Array of glob patterns defining the allowed scope
	 * @returns true if path is within scope, false otherwise
	 */
	async validatePath(filePath: string, scopePatterns: string[]): Promise<boolean> {
		return this.matchesAnyPattern(filePath, scopePatterns)
	}

	/**
	 * Normalizes a file path for consistent matching.
	 * - Converts backslashes to forward slashes (Windows compatibility)
	 * - Removes leading ./ or .\ (relative path indicators)
	 * - Normalizes path separators
	 * @param filePath The path to normalize
	 * @returns Normalized path
	 */
	private normalizePath(filePath: string): string {
		// Convert to forward slashes
		let normalized = filePath.replace(/\\/g, "/")

		// Remove leading ./ or .\
		if (normalized.startsWith("./")) {
			normalized = normalized.slice(2)
		}

		// Remove leading drive letter on Windows (e.g., "C:/" -> "/")
		// This helps with absolute path matching
		if (/^[A-Za-z]:\//.test(normalized)) {
			normalized = normalized.slice(2)
		}

		return normalized
	}
}
