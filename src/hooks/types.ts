/**
 * Phase 2 — Hook Middleware Types
 *
 * Shared type definitions for the Hook Engine. Every hook receives a
 * HookContext and returns a HookResult.
 */

// ---------------------------------------------------------------------------
// Command Classification
// ---------------------------------------------------------------------------

/**
 * Classification of a tool invocation.
 * - `safe`        → read-only / non-destructive — bypasses enforcement
 * - `destructive` → writes, deletes, executes — subject to authorization + scope
 */
export type ToolClassification = "safe" | "destructive"

// ---------------------------------------------------------------------------
// Hook Context
// ---------------------------------------------------------------------------

/**
 * Context object passed to every pre-/post-hook.
 * Contains everything the hooks need to make a decision.
 */
export interface HookContext {
	/** Name of the tool being invoked (e.g. "write_to_file", "execute_command") */
	toolName: string

	/** Raw tool parameters from the LLM (nativeArgs) */
	params: Record<string, unknown>

	/** Workspace root directory */
	cwd: string

	/** Currently selected intent ID (undefined = ungoverned / no intent) */
	activeIntentId?: string

	/**
	 * Owned scope globs for the active intent.
	 * Loaded from `.orchestration/active_intents.yaml` → `scope` field.
	 */
	activeIntentScope?: string[]

	/** Classification of the tool (populated by commandClassifier before other hooks) */
	classification?: ToolClassification
}

// ---------------------------------------------------------------------------
// Hook Result
// ---------------------------------------------------------------------------

/**
 * Outcome of a pre-hook evaluation.
 *
 * `proceed: true`  → tool execution may continue
 * `proceed: false` → tool is blocked; `error` contains the JSON payload
 *                     to feed back to the LLM so it can self-correct.
 */
export interface HookResult {
	proceed: boolean

	/**
	 * Standardised JSON tool-error string (Requirement 3 — Autonomous Recovery).
	 * Present only when `proceed === false`.
	 *
	 * Shape:
	 * ```json
	 * {
	 *   "status": "error",
	 *   "message": "<human-readable>",
	 *   "error": { "code": "<SHORT_CODE>", "details": { ... } }
	 * }
	 * ```
	 */
	error?: string

	/** Short human-readable reason (for logging / UI) */
	reason?: string
}

// ---------------------------------------------------------------------------
// Scope Check
// ---------------------------------------------------------------------------

/**
 * Result of checking a file path against intent scope.
 */
export interface ScopeCheckResult {
	/** true if the path is within the intent's owned_scope */
	allowed: boolean
	/** Present when `allowed === false` */
	violation?: string
}

// ---------------------------------------------------------------------------
// Hook Function Signature
// ---------------------------------------------------------------------------

/**
 * Signature for composable pre-hooks.
 * Each pre-hook receives the context and returns a HookResult.
 */
export type PreHookFn = (ctx: HookContext) => Promise<HookResult>

/**
 * Signature for composable post-hooks (optional, fire-and-forget).
 * Receives the context plus the tool's execution outcome.
 */
export type PostHookFn = (ctx: HookContext, outcome: { success: boolean; error?: string }) => Promise<void>
