/**
 * Hook Matcher
 *
 * Provides pattern matching for hooks against tool names.
 * Supports exact match, regex patterns, glob patterns, group names, and match-all.
 */

import { ResolvedHook } from "./types"
import { getToolsForGroup } from "../../shared/tools"

/**
 * Expand group patterns in a matcher pattern.
 * Only expands groups if the pattern is a simple group name or alternation of group names.
 * For complex regex patterns, groups are not expanded to avoid breaking existing behavior.
 */
function expandGroupPatterns(pattern: string): string {
	// Don't expand groups in patterns that contain | (to preserve existing regex alternation behavior)
	if (pattern.includes("|")) {
		return pattern
	}

	// Don't expand groups in complex patterns that contain regex metacharacters
	const regexMetaChars = /[*^$+.()[\]{}\\]/
	if (regexMetaChars.test(pattern)) {
		return pattern // Keep complex patterns as-is
	}

	// Single group name
	const tools = getToolsForGroup(pattern)
	if (tools) {
		// It's a known group, expand to all tools in the group
		return tools.join("|")
	} else {
		// Not a group, keep as-is, but warn if it looks like it was intended as a group
		console.warn(`Unknown tool group "${pattern}". Treating as literal tool name.`)
		return pattern
	}
}

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

	// Expand group patterns before processing
	const expandedPattern = expandGroupPatterns(pattern)

	// Check if expanded pattern looks like a regex (contains regex metacharacters except * and ?)
	const regexMetaChars = /[|^$+.()[\]{}\\]/
	const isRegexPattern = regexMetaChars.test(expandedPattern)

	// Check if expanded pattern looks like a glob (contains * or ?)
	const isGlobPattern = /[*?]/.test(expandedPattern) && !isRegexPattern

	if (isRegexPattern) {
		// Treat as regex pattern
		try {
			const regex = new RegExp(`^(?:${expandedPattern})$`, "i")
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
				matches: (toolName: string) => toolName.toLowerCase() === expandedPattern.toLowerCase(),
			}
		}
	}

	if (isGlobPattern) {
		// Convert glob to regex
		// * matches any characters, ? matches single character
		const regexPattern = expandedPattern
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
				matches: (toolName: string) => toolName.toLowerCase() === expandedPattern.toLowerCase(),
			}
		}
	}

	// Exact match (case-insensitive)
	return {
		pattern,
		type: "exact",
		matches: (toolName: string) => toolName.toLowerCase() === expandedPattern.toLowerCase(),
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
