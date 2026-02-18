/**
 * Phase 2 — .intentignore Loader
 *
 * Loads and parses a `.intentignore` file from the workspace root.
 * Files matching patterns in `.intentignore` are exempted from intent
 * scope enforcement.
 *
 * Format (one pattern per line, comments with #):
 * ```
 * # Build output — excluded from scope enforcement
 * dist/
 * node_modules/
 * *.log
 * ```
 *
 * Matching is simple string-prefix / suffix matching (no glob library).
 * This keeps the implementation dependency-free per architecture constraints.
 */

import * as fs from "fs"
import * as path from "path"

/** Relative path to the ignore file from workspace root */
export const INTENT_IGNORE_PATH = ".intentignore"

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse `.intentignore` content into a list of patterns.
 * Blank lines and lines starting with `#` are skipped.
 */
export function parseIntentIgnore(content: string): string[] {
	return content
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"))
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load ignore patterns from `.intentignore` in the given workspace root.
 * Returns an empty array if the file doesn't exist.
 */
export function loadIntentIgnorePatterns(cwd: string): string[] {
	const ignorePath = path.join(cwd, INTENT_IGNORE_PATH)
	try {
		const content = fs.readFileSync(ignorePath, "utf-8")
		return parseIntentIgnore(content)
	} catch {
		// File does not exist or is unreadable → nothing is ignored
		return []
	}
}

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

/**
 * Check whether a file path should be ignored (exempted from scope
 * enforcement) based on `.intentignore` patterns.
 *
 * Matching rules (simple, no external glob dependency):
 * 1. Exact match         → `dist/index.js` matches `dist/index.js`
 * 2. Prefix match (dir)  → `dist/` matches `dist/index.js`
 * 3. Suffix / extension  → `*.log` matches `app.log`, `src/debug.log`
 * 4. Contains match      → `node_modules` matches `foo/node_modules/bar.js`
 *
 * @param filePath         - Relative file path to check
 * @param ignorePatterns   - Patterns loaded from `.intentignore`
 * @returns true if the file should be IGNORED (exempted from enforcement)
 */
export function isIgnoredByIntent(filePath: string, ignorePatterns: string[]): boolean {
	if (ignorePatterns.length === 0) {
		return false
	}

	// Normalise to forward slashes for consistency
	const normalised = filePath.replace(/\\/g, "/")

	for (const pattern of ignorePatterns) {
		const p = pattern.replace(/\\/g, "/")

		// 1. Exact match
		if (normalised === p) {
			return true
		}

		// 2. Prefix match (directory pattern like "dist/" or "dist")
		const dirPrefix = p.endsWith("/") ? p : p + "/"
		if (normalised.startsWith(dirPrefix)) {
			return true
		}

		// 3. Suffix / extension match (e.g. "*.log")
		if (p.startsWith("*")) {
			const suffix = p.slice(1) // e.g. ".log"
			if (normalised.endsWith(suffix)) {
				return true
			}
		}

		// 4. Contains match (e.g. "node_modules" matches any path containing it)
		if (!p.includes("/") && !p.startsWith("*") && normalised.includes(p)) {
			return true
		}
	}

	return false
}
