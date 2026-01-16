/**
 * Hook Matcher
 *
 * Provides pattern matching for hooks against tool names.
 * Supports exact match, regex patterns, glob patterns, and match-all.
 */

import { ResolvedHook } from "./types"

/**
 * Result of compiling a matcher pattern.
 */
interface CompiledMatcher {
	/** The original pattern string */
	pattern: string

	/** Type of matching to use */
	type: "all" | "exact" | "regex" | "glob"

	/** Compiled regex for regex/glob matching */
	regex?: RegExp

	/** Test if a tool name matches this pattern */
	matches: (toolName: string) => boolean
}

/**
 * Compile a matcher pattern into an efficient matcher function.
 *
 * Supports:
 * - Exact tool name: "Write"
 * - Regex pattern: "Edit|Write" (contains | or regex metacharacters)
 * - Glob pattern: "mcp__*" (contains * or ?)
 * - Match all: "*" or undefined/empty
 *
 * @param pattern - The matcher pattern string (or undefined for match-all)
 * @returns Compiled matcher object
 */
export function compileMatcher(pattern: string | undefined): CompiledMatcher {
	// Handle match-all cases
	if (!pattern || pattern === "*") {
		return {
			pattern: pattern || "*",
			type: "all",
			matches: () => true,
		}
	}

	// Check if pattern looks like a regex (contains regex metacharacters except * and ?)
	const regexMetaChars = /[|^$+.()[\]{}\\]/
	const isRegexPattern = regexMetaChars.test(pattern)

	// Check if pattern looks like a glob (contains * or ?)
	const isGlobPattern = /[*?]/.test(pattern) && !isRegexPattern

	if (isRegexPattern) {
		// Treat as regex pattern
		try {
			const regex = new RegExp(`^(?:${pattern})$`, "i")
			return {
				pattern,
				type: "regex",
				regex,
				matches: (toolName: string) => regex.test(toolName),
			}
		} catch (e) {
			// If regex compilation fails, fall back to exact match
			console.warn(`Invalid regex pattern "${pattern}", falling back to exact match:`, e)
			return {
				pattern,
				type: "exact",
				matches: (toolName: string) => toolName.toLowerCase() === pattern.toLowerCase(),
			}
		}
	}

	if (isGlobPattern) {
		// Convert glob to regex
		// * matches any characters, ? matches single character
		const regexPattern = pattern
			.replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars except * and ?
			.replace(/\*/g, ".*") // * -> .*
			.replace(/\?/g, ".") // ? -> .

		try {
			const regex = new RegExp(`^${regexPattern}$`, "i")
			return {
				pattern,
				type: "glob",
				regex,
				matches: (toolName: string) => regex.test(toolName),
			}
		} catch (e) {
			// If regex compilation fails, fall back to exact match
			console.warn(`Invalid glob pattern "${pattern}", falling back to exact match:`, e)
			return {
				pattern,
				type: "exact",
				matches: (toolName: string) => toolName.toLowerCase() === pattern.toLowerCase(),
			}
		}
	}

	// Exact match (case-insensitive)
	return {
		pattern,
		type: "exact",
		matches: (toolName: string) => toolName.toLowerCase() === pattern.toLowerCase(),
	}
}

/**
 * Cache of compiled matchers for performance.
 * Key is the pattern string, value is the compiled matcher.
 */
const matcherCache = new Map<string, CompiledMatcher>()

/**
 * Get a compiled matcher, using cache when possible.
 *
 * @param pattern - The matcher pattern string (or undefined for match-all)
 * @returns Compiled matcher object
 */
export function getMatcher(pattern: string | undefined): CompiledMatcher {
	const cacheKey = pattern || "*"

	let matcher = matcherCache.get(cacheKey)
	if (!matcher) {
		matcher = compileMatcher(pattern)
		matcherCache.set(cacheKey, matcher)
	}

	return matcher
}

/**
 * Clear the matcher cache (useful for testing).
 */
export function clearMatcherCache(): void {
	matcherCache.clear()
}

/**
 * Filter hooks that match a given tool name.
 *
 * @param hooks - Array of hooks to filter
 * @param toolName - Tool name to match against
 * @returns Hooks that match the tool name
 */
export function filterMatchingHooks(hooks: ResolvedHook[], toolName: string): ResolvedHook[] {
	return hooks.filter((hook) => {
		const matcher = getMatcher(hook.matcher)
		return matcher.matches(toolName)
	})
}

/**
 * Check if a single hook matches a tool name.
 *
 * @param hook - The hook to check
 * @param toolName - Tool name to match against
 * @returns Whether the hook matches
 */
export function hookMatchesTool(hook: ResolvedHook, toolName: string): boolean {
	const matcher = getMatcher(hook.matcher)
	return matcher.matches(toolName)
}
