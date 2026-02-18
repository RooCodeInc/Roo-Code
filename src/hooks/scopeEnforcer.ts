/**
 * Phase 2 — Scope Enforcer (Pre-Hook)
 *
 * Requirement 4: In the write_file Pre-Hook, check if the target file
 * matches the owned_scope of the active intent.
 *
 * - If valid  → proceed
 * - If invalid → BLOCK and return:
 *     "Scope Violation: REQ-001 is not authorized to edit [filename].
 *      Request scope expansion."
 *
 * Scope matching uses simple prefix / wildcard matching against the
 * intent's `scope` globs (e.g. `src/auth/*`, `src/**`).
 * No external glob dependency — just string-based matching.
 */

import type { HookContext, HookResult, ScopeCheckResult } from "./types"
import { buildScopeViolationError } from "./toolError"
import { loadIntentIgnorePatterns, isIgnoredByIntent } from "./intentIgnore"
import { loadActiveIntents, findIntentById } from "../core/context/activeIntents"

// ---------------------------------------------------------------------------
// Tools that carry a target file path
// ---------------------------------------------------------------------------

/**
 * Common parameter keys where tools store the target file path.
 * We check these in order and use the first truthy value.
 */
const PATH_PARAM_KEYS = ["path", "file_path", "filePath", "filename"] as const

// ---------------------------------------------------------------------------
// Scope Matching
// ---------------------------------------------------------------------------

/**
 * Check whether a relative file path is within any of the intent's scope globs.
 *
 * Matching rules (simple, no external glob library):
 * - `src/auth/*`   → matches any file directly in `src/auth/`
 * - `src/auth/**`  → matches any file at any depth under `src/auth/`
 * - `src/**`       → matches everything under `src/`
 * - Exact match    → `src/auth/login.ts` matches `src/auth/login.ts`
 *
 * @param filePath - Relative path to the target file
 * @param scopeGlobs - Array of scope patterns from the active intent
 */
export function isPathInScope(filePath: string, scopeGlobs: string[]): boolean {
	if (scopeGlobs.length === 0) {
		// No scope restrictions → everything is in scope
		return true
	}

	const normalised = filePath.replace(/\\/g, "/")

	for (const glob of scopeGlobs) {
		const g = glob.replace(/\\/g, "/")

		// Exact match
		if (normalised === g) {
			return true
		}

		// "dir/**" → recursive wildcard — matches any subpath
		if (g.endsWith("/**")) {
			const prefix = g.slice(0, -3) // "src/auth"
			if (normalised.startsWith(prefix + "/") || normalised === prefix) {
				return true
			}
		}

		// "dir/*" → single-level wildcard — matches files directly inside dir
		if (g.endsWith("/*") && !g.endsWith("/**")) {
			const prefix = g.slice(0, -2) // "src/auth"
			if (normalised.startsWith(prefix + "/")) {
				// Must not contain another "/" after the prefix
				const rest = normalised.slice(prefix.length + 1)
				if (!rest.includes("/")) {
					return true
				}
			}
		}

		// Plain directory prefix (e.g. "src/auth" without wildcard)
		if (!g.includes("*") && normalised.startsWith(g + "/")) {
			return true
		}
	}

	return false
}

// ---------------------------------------------------------------------------
// Pre-Hook: Scope Enforcement
// ---------------------------------------------------------------------------

/**
 * Extract the target file path from tool parameters.
 * Returns undefined if the tool doesn't operate on a file path.
 */
export function extractTargetPath(params: Record<string, unknown>): string | undefined {
	for (const key of PATH_PARAM_KEYS) {
		const value = params[key]
		if (typeof value === "string" && value.length > 0) {
			return value
		}
	}
	return undefined
}

/**
 * Scope enforcement pre-hook.
 *
 * Checks whether the tool's target file is within the active intent's
 * owned_scope. If not, blocks with a standardised scope-violation error.
 *
 * Skips enforcement when:
 * - The tool has no file path parameter (e.g. execute_command)
 * - No active intent is selected (gatekeeper already handles this)
 * - No scope is defined (intent allows everything)
 * - The file matches a `.intentignore` pattern
 */
export async function scopeEnforcerHook(ctx: HookContext): Promise<HookResult> {
	// No active intent → skip (gatekeeper handles this upstream)
	if (!ctx.activeIntentId) {
		return { proceed: true }
	}

	// Dynamically load scope from YAML if not already in context
	let scope = ctx.activeIntentScope
	if (!scope) {
		try {
			const intents = await loadActiveIntents(ctx.cwd)
			const intent = findIntentById(intents, ctx.activeIntentId)
			if (intent) {
				scope = intent.scope
				ctx.activeIntentScope = scope // cache for subsequent hooks
			}
		} catch {
			// YAML load failed — skip scope enforcement gracefully
			return { proceed: true }
		}
	}

	if (!scope || scope.length === 0) {
		// No scope restrictions → everything is in scope
		return { proceed: true }
	}

	// Extract target path from tool params
	const targetPath = extractTargetPath(ctx.params)
	if (!targetPath) {
		// Tool doesn't operate on a file → scope not applicable
		return { proceed: true }
	}

	// Make path relative to workspace root for matching
	const relativePath = targetPath.startsWith(ctx.cwd)
		? targetPath.slice(ctx.cwd.length).replace(/^[/\\]/, "")
		: targetPath

	// Check .intentignore — exempted files bypass scope enforcement
	const ignorePatterns = loadIntentIgnorePatterns(ctx.cwd)
	if (isIgnoredByIntent(relativePath, ignorePatterns)) {
		return { proceed: true }
	}

	// Check scope
	if (!isPathInScope(relativePath, scope)) {
		const errorPayload = buildScopeViolationError(ctx.activeIntentId, relativePath, scope)

		return {
			proceed: false,
			error: errorPayload,
			reason: `Scope Violation: ${ctx.activeIntentId} is not authorized to edit ${relativePath}`,
		}
	}

	return { proceed: true }
}

/**
 * Check scope directly (utility for testing / external callers).
 */
export function checkScopeViolation(filePath: string, intentId: string, scopeGlobs: string[]): ScopeCheckResult {
	if (isPathInScope(filePath, scopeGlobs)) {
		return { allowed: true }
	}
	return {
		allowed: false,
		violation: `Scope Violation: ${intentId} is not authorized to edit ${filePath}. Request scope expansion.`,
	}
}
