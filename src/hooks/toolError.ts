/**
 * Phase 2 — Standardised Tool-Error Builder (Autonomous Recovery)
 *
 * Requirement 3: When a destructive action is rejected/blocked, return a
 * standardised JSON tool-error payload that the LLM can parse and use to
 * self-correct without crashing.
 *
 * Shape:
 * ```json
 * {
 *   "status": "error",
 *   "message": "<human readable>",
 *   "error": {
 *     "code": "<SHORT_CODE>",
 *     "details": { ... }
 *   }
 * }
 * ```
 */

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

/** Well-known error codes returned in the `error.code` field. */
export const HookErrorCode = {
	/** User rejected the tool call via the authorization dialog */
	AUTHORIZATION_REJECTED: "AUTHORIZATION_REJECTED",

	/** Tool target is outside the active intent's owned_scope */
	SCOPE_VIOLATION: "SCOPE_VIOLATION",

	/** No active intent selected but a governed workspace requires one */
	NO_ACTIVE_INTENT: "NO_ACTIVE_INTENT",

	/** Generic hook rejection */
	HOOK_BLOCKED: "HOOK_BLOCKED",
} as const

export type HookErrorCodeValue = (typeof HookErrorCode)[keyof typeof HookErrorCode]

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a standardised JSON tool-error string.
 *
 * The returned string is JSON.stringify'd so it can be directly used as
 * a `tool_result` content fed back to the LLM.
 *
 * @param code    - Short error code (e.g. "SCOPE_VIOLATION")
 * @param message - Human-readable description
 * @param details - Optional extra context (file paths, intent IDs, etc.)
 * @returns JSON string
 */
export function buildToolError(code: HookErrorCodeValue, message: string, details?: Record<string, unknown>): string {
	const payload = {
		status: "error" as const,
		message,
		error: {
			code,
			...(details ? { details } : {}),
		},
	}
	return JSON.stringify(payload)
}

/**
 * Build a scope-violation error.
 *
 * Requirement 4 specifies the exact wording:
 * "Scope Violation: REQ-001 is not authorized to edit [filename].
 *  Request scope expansion."
 *
 * @param intentId - Active intent ID
 * @param filePath - The file the tool tried to modify
 * @param ownedScope - The intent's allowed scope globs
 */
export function buildScopeViolationError(intentId: string, filePath: string, ownedScope: string[]): string {
	const message = `Scope Violation: ${intentId} is not authorized to edit ${filePath}. ` + `Request scope expansion.`

	return buildToolError(HookErrorCode.SCOPE_VIOLATION, message, {
		intentId,
		filePath,
		ownedScope,
	})
}

/**
 * Build an authorization-rejected error.
 *
 * @param toolName - The tool that was rejected
 * @param intentId - The active intent context (if any)
 */
export function buildAuthorizationRejectedError(toolName: string, intentId?: string): string {
	const message =
		`Authorization rejected: user declined execution of "${toolName}". ` +
		`Try a different approach or ask the user for guidance.`

	return buildToolError(HookErrorCode.AUTHORIZATION_REJECTED, message, {
		toolName,
		...(intentId ? { intentId } : {}),
	})
}
