/**
 * ScopeEnforcer.ts — Phase 2: Owned Scope Enforcement
 *
 * Enforces that file-write operations only target files within the active
 * intent's owned_scope. This is the architectural boundary that prevents
 * an agent working on "JWT Authentication Migration" from accidentally
 * modifying unrelated billing or UI code.
 *
 * The owned_scope field in active_intents.yaml uses glob patterns (e.g.,
 * "src/auth/**", "src/middleware/jwt.ts"). This module validates that the
 * target file path of any write operation matches at least one of these
 * patterns.
 *
 * If the target file is OUTSIDE the scope:
 *   - The operation is BLOCKED immediately
 *   - A structured "Scope Violation" error is returned via AutonomousRecovery
 *   - The AI receives guidance to request scope expansion or change approach
 *
 * Uses the `minimatch` algorithm (via picomatch) for glob matching.
 *
 * @see AutonomousRecovery.ts — formats the scope violation error
 * @see active_intents.yaml — defines owned_scope per intent
 * @see TRP1 Challenge Week 1, Phase 2: Scope Enforcement
 */

import * as path from "node:path"

// ── Scope Check Result ───────────────────────────────────────────────────

export interface ScopeCheckResult {
	/** Whether the file is within the owned scope */
	allowed: boolean

	/** The file path that was checked (normalized) */
	checkedPath: string

	/** The owned scope patterns that were evaluated */
	ownedScope: string[]

	/** The specific pattern that matched (if allowed) */
	matchedPattern?: string

	/** Human-readable reason */
	reason: string
}

// ── Simple Glob Matcher ──────────────────────────────────────────────────

/**
 * Minimal glob matcher that handles the patterns used in active_intents.yaml:
 *   - "src/auth/**"       → matches any file under src/auth/
 *   - "src/middleware/*.ts" → matches .ts files in src/middleware/
 *   - "tests/auth/**"     → matches any file under tests/auth/
 *   - "src/api/weather/**" → matches any file under src/api/weather/
 *
 * Supports:
 *   - ** (matches any number of directories)
 *   - *  (matches any filename segment, excluding /)
 *   - Exact file paths
 *
 * We use a simple implementation to avoid adding external dependencies.
 * For production, consider using picomatch or micromatch.
 */
/**
 * Characters that need escaping in regex patterns.
 * Maps each special regex character to its escaped form.
 */
const REGEX_ESCAPE_MAP: ReadonlyMap<string, string> = new Map([
	[".", String.raw`\.`],
	["+", String.raw`\+`],
	["^", String.raw`\^`],
	["$", String.raw`\$`],
	["{", String.raw`\{`],
	["}", String.raw`\}`],
	["(", String.raw`\(`],
	[")", String.raw`\)`],
	["|", String.raw`\|`],
	["[", String.raw`\[`],
	["]", String.raw`\]`],
])

function globToRegex(pattern: string): RegExp {
	// Normalize path separators to forward slashes
	let normalized = pattern.replaceAll("\\", "/")

	// Replace glob wildcards with placeholders BEFORE escaping
	normalized = normalized.replaceAll("**", "§GLOBSTAR§")
	normalized = normalized.replaceAll("*", "§WILDCARD§")

	// Escape regex special characters
	for (const [char, escaped] of REGEX_ESCAPE_MAP) {
		normalized = normalized.replaceAll(char, escaped)
	}

	// Replace placeholders with regex equivalents
	normalized = normalized.replaceAll("§GLOBSTAR§", ".*")
	normalized = normalized.replaceAll("§WILDCARD§", "[^/]*")

	return new RegExp(`^${normalized}$`)
}

/**
 * Test if a file path matches a glob pattern.
 *
 * @param filePath - The file path to test (relative to workspace root)
 * @param pattern  - The glob pattern from owned_scope
 * @returns true if the path matches the pattern
 */
function matchesGlob(filePath: string, pattern: string): boolean {
	// Normalize both to forward slashes
	const normalizedPath = filePath.replaceAll("\\", "/")
	const regex = globToRegex(pattern)
	return regex.test(normalizedPath)
}

// ── Scope Enforcer ───────────────────────────────────────────────────────

export class ScopeEnforcer {
	/**
	 * Check if a target file path is within the active intent's owned_scope.
	 *
	 * @param targetPath   - The absolute or relative file path being written
	 * @param ownedScope   - Array of glob patterns from the active intent
	 * @param cwd          - Workspace root path (for normalizing absolute paths)
	 * @returns ScopeCheckResult indicating whether the write is allowed
	 */
	static check(targetPath: string, ownedScope: string[], cwd: string): ScopeCheckResult {
		// If no scope is defined, allow all writes (backwards compatibility)
		if (!ownedScope || ownedScope.length === 0) {
			return {
				allowed: true,
				checkedPath: targetPath,
				ownedScope,
				reason: "No owned_scope defined — all writes allowed.",
			}
		}

		// Normalize the target path to be relative to workspace root
		let relativePath = targetPath

		// If it's an absolute path, make it relative
		if (path.isAbsolute(targetPath)) {
			relativePath = path.relative(cwd, targetPath)
		}

		// Normalize to forward slashes for consistent matching
		relativePath = relativePath.replaceAll("\\", "/")

		// Remove any leading ./ or /
		relativePath = relativePath.replace(/^\.\//, "").replace(/^\//, "")

		// Check against each scope pattern
		for (const pattern of ownedScope) {
			if (matchesGlob(relativePath, pattern)) {
				return {
					allowed: true,
					checkedPath: relativePath,
					ownedScope,
					matchedPattern: pattern,
					reason: `File "${relativePath}" matches scope pattern "${pattern}".`,
				}
			}
		}

		// No pattern matched — scope violation
		return {
			allowed: false,
			checkedPath: relativePath,
			ownedScope,
			reason:
				`Scope Violation: File "${relativePath}" is not authorized under intent's owned_scope. ` +
				`Allowed patterns: [${ownedScope.join(", ")}].`,
		}
	}

	/**
	 * Extract the target file path from tool parameters.
	 * Different file-writing tools use different parameter names.
	 *
	 * @param toolName - The tool being called
	 * @param params   - The tool parameters
	 * @returns The target file path, or null if not a file-write tool
	 */
	static extractTargetPath(toolName: string, params: Record<string, unknown>): string | null {
		// Common parameter names for file paths across different tools
		const pathKeys = ["path", "file_path", "filePath", "target_file", "file"]

		for (const key of pathKeys) {
			if (params[key] && typeof params[key] === "string") {
				return params[key]
			}
		}

		// For apply_diff and apply_patch, the path might be embedded differently
		if (params.diff && typeof params.diff === "string") {
			// Try to extract path from unified diff header
			const diffMatch = /^---\s+(?:a\/)?(.+)$/m.exec(params.diff)
			if (diffMatch) {
				return diffMatch[1]
			}
		}

		return null
	}
}
