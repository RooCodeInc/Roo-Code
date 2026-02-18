/**
 * types.ts — Shared type definitions for the Hook Engine system.
 *
 * These types define the contracts between the HookEngine, pre-hooks,
 * post-hooks, and the intent data model. They provide strong typing
 * for the entire middleware pipeline.
 *
 * @see HookEngine.ts — Orchestrator that uses these types
 * @see TRP1 Challenge Week 1, Phase 1
 */

// ── Hook Context ─────────────────────────────────────────────────────────

/**
 * Context object passed to every hook at invocation time.
 * Contains all information a hook needs to make decisions.
 */
export interface HookContext {
	/** The canonical name of the tool being called (e.g., "write_to_file") */
	toolName: string

	/** The tool parameters as provided by the AI agent */
	params: Record<string, unknown>

	/** The workspace root path (cwd) where .orchestration/ lives */
	cwd: string

	/** The currently active intent ID (null if none declared) */
	activeIntentId: string | null
}

// ── Pre-Hook Results ─────────────────────────────────────────────────────

/**
 * Result from a pre-hook execution.
 *
 * - "allow"  — the hook has no objection; continue to next hook or execute tool
 * - "block"  — the hook blocks execution; return toolResult as error
 * - "inject" — the hook intercepts the call and provides its own tool result
 *              (used by select_active_intent to return the <intent_context> block)
 */
export type PreHookResult =
	| { action: "allow" }
	| { action: "block"; toolResult: string }
	| { action: "inject"; toolResult: string }

// ── Intent Data Model ────────────────────────────────────────────────────

/**
 * Represents a single intent entry from .orchestration/active_intents.yaml.
 * This is the TypeScript representation of the YAML schema defined in the
 * TRP1 challenge specification.
 *
 * Example YAML entry:
 * ```yaml
 * - id: "INT-001"
 *   name: "JWT Authentication Migration"
 *   status: "IN_PROGRESS"
 *   owned_scope:
 *     - "src/auth/**"
 *     - "src/middleware/jwt.ts"
 *   constraints:
 *     - "Must not use external auth providers"
 *     - "Must maintain backward compatibility with Basic Auth"
 *   acceptance_criteria:
 *     - "Unit tests in tests/auth/ pass"
 * ```
 */
export interface IntentEntry {
	/** Unique identifier (e.g., "INT-001") */
	id: string

	/** Human-readable name (e.g., "JWT Authentication Migration") */
	name: string

	/** Current lifecycle status */
	status: string

	/** File globs that this intent is authorized to modify */
	owned_scope: string[]

	/** Architectural constraints the agent must respect */
	constraints: string[]

	/** Definition of Done — criteria for completion */
	acceptance_criteria: string[]
}

/**
 * Root structure of .orchestration/active_intents.yaml
 */
export interface ActiveIntentsFile {
	active_intents: IntentEntry[]
}

// ── Mutating Tool Classification ─────────────────────────────────────────

/**
 * Tools that perform mutating/destructive operations on the workspace.
 * These require an active intent to be declared before execution.
 *
 * Read-only tools (read_file, list_files, search_files, etc.) and
 * meta tools (ask_followup_question, attempt_completion, switch_mode, etc.)
 * are exempt from the gatekeeper check.
 */
export const MUTATING_TOOLS: readonly string[] = [
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"execute_command",
	"generate_image",
] as const

/**
 * Tools that are exempt from the gatekeeper intent check.
 * These include read-only operations, meta tools, and the
 * select_active_intent tool itself (to avoid circular blocking).
 */
export const EXEMPT_TOOLS: readonly string[] = [
	// The handshake tool itself
	"select_active_intent",
	// Read-only tools
	"read_file",
	"list_files",
	"search_files",
	"codebase_search",
	"read_command_output",
	// Meta tools / conversation
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"update_todo_list",
	"run_slash_command",
	"skill",
	// MCP tools (governed separately)
	"use_mcp_tool",
	"access_mcp_resource",
] as const
