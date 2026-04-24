import path from "path"

export interface ScopeValidationResult {
	isWithinScope: boolean
	reason?: string
	allowedPaths?: string[]
	attemptedPath?: string
}

/**
 * Validates that proposed changes align with intent scope boundaries
 *
 * Scope enforcement prevents agents from:
 * 1. Drifting into unrelated code areas
 * 2. Making changes that violate intent constraints
 * 3. Modifying files outside owned_scope without explicit override
 *
 * Validation uses glob patterns matching:
 * - Exact paths: src/auth/middleware.ts
 * - Directory patterns: src/auth/ matches any file under src/auth/
 * - Wildcard patterns: src/*
 */
export class ScopeValidator {
	/**
	 * Check if a file path matches any pattern in the scope list
	 *
	 * Supports:
	 * - Exact file matches: "src/auth/middleware.ts"
	 * - Directory patterns: "src/services/" (trailing slash)
	 * - Glob patterns: "src/**\/hooks.ts", "src/*\/utils.ts"
	 */
	static isPathInScope(filePath: string, ownedScope: string[]): ScopeValidationResult {
		if (!ownedScope || ownedScope.length === 0) {
			return {
				isWithinScope: false,
				reason: "No scope defined for this intent",
				attemptedPath: filePath,
			}
		}

		// Normalize the file path (convert backslashes to forward slashes)
		const normalizedPath = filePath.replace(/\\/g, "/")

		for (const scopeEntry of ownedScope) {
			if (this.matchesPattern(normalizedPath, scopeEntry)) {
				return {
					isWithinScope: true,
					allowedPaths: ownedScope,
				}
			}
		}

		return {
			isWithinScope: false,
			reason: `File "${filePath}" is outside the intent's owned_scope`,
			allowedPaths: ownedScope,
			attemptedPath: filePath,
		}
	}

	/**
	 * Validate multiple file paths against scope
	 */
	static arePathsInScope(filePaths: string[], ownedScope: string[]): ScopeValidationResult {
		const results = filePaths.map((p) => this.isPathInScope(p, ownedScope))

		// All paths must be in scope
		const allInScope = results.every((r) => r.isWithinScope)

		if (allInScope) {
			return {
				isWithinScope: true,
				allowedPaths: ownedScope,
			}
		}

		const outOfScope = filePaths.filter((p) => {
			const result = this.isPathInScope(p, ownedScope)
			return !result.isWithinScope
		})

		return {
			isWithinScope: false,
			reason: `${outOfScope.length} file(s) outside scope: ${outOfScope.join(", ")}`,
			allowedPaths: ownedScope,
			attemptedPath: outOfScope[0],
		}
	}

	/**
	 * Check if a path matches a scope pattern
	 * Supports exact matches, directory patterns, and basic globs
	 */
	private static matchesPattern(filePath: string, scopePattern: string): boolean {
		const normalized = scopePattern.replace(/\\/g, "/")

		// Exact file match
		if (filePath === normalized) {
			return true
		}

		// Directory match (trailing slash)
		if (normalized.endsWith("/")) {
			return filePath.startsWith(normalized)
		}

		// Wildcard patterns: convert simple glob to regex
		const regexPattern = this.globToRegex(normalized)
		return regexPattern.test(filePath)
	}

	/**
	 * Convert simple glob patterns to regex
	 * Supports:
	 * - * matches anything except /
	 * - ** matches anything including /
	 * - ? matches single character
	 */
	private static globToRegex(glob: string): RegExp {
		let pattern = glob

		// Handle ** first (before escaping * to avoid issues)
		const doubleStar = "__DOUBLE_STAR__"
		pattern = pattern.replace(/\*\*/g, doubleStar)

		// Now escape regex special characters
		pattern = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")

		// * -> anything except /
		pattern = pattern.replace(/\*/g, "[^/]*")

		// ? -> single character except /
		pattern = pattern.replace(/\?/g, "[^/]")

		// Finally, replace the placeholder with the proper regex for **
		pattern = pattern.replace(new RegExp(doubleStar, "g"), ".*")

		return new RegExp(`^${pattern}$`)
	}

	/**
	 * Extract file paths from a unified diff
	 * Returns array of files that would be modified
	 */
	static extractFilesFromDiff(diff: string): string[] {
		const files = new Set<string>()
		const lines = diff.split("\n")

		for (const line of lines) {
			// Match unified diff file headers
			// --- a/path/to/file
			// +++ b/path/to/file
			const match = line.match(/^[+-]{3}\s[ab]\/(.+)$/)
			if (match) {
				files.add(match[1])
			}

			// Also match lines that look like file paths in diff context
			// diff --git a/path to/file b/path to/file
			const gitDiffMatch = line.match(/^diff --git a\/(.+) b\/.+$/)
			if (gitDiffMatch) {
				files.add(gitDiffMatch[1])
			}
		}

		return Array.from(files)
	}
}
