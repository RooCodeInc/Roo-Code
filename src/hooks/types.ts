/**
 * Hook Engine Types
 * Shared types for the Intent-Driven Governance Hook System.
 */

// The set of tool names that mutate the codebase and REQUIRE an active intent.
export const MUTATING_TOOLS = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"execute_command",
] as const)

// The set of tools that are purely destructive (need extra HITL warning).
export const DESTRUCTIVE_TOOLS = new Set(["execute_command"] as const)

// Tools that set intent (exempt from the intent gate check).
export const INTENT_TOOLS = new Set(["select_active_intent"] as const)

/**
 * The context passed to every hook.
 * Contains everything the hook needs to make a decision.
 */
export interface HookContext {
	taskId: string
	cwd: string // workspace root path
	toolName: string
	toolParams: Record<string, unknown>
	activeIntentId: string | null // currently declared intent for this task
}

/**
 * The result a hook returns.
 * If blocked=true, execution is stopped and reason is returned to the LLM.
 */
export interface HookResult {
	blocked: boolean
	reason?: string
}

/**
 * Per-task intent state tracked by the HookEngine.
 */
export interface IntentState {
	intentId: string
	intentName: string
	ownedScope: string[]
	constraints: string[]
	acceptanceCriteria: string[]
	activatedAt: string // ISO timestamp
}

/**
 * A single intent as parsed from active_intents.yaml.
 */
export interface ActiveIntent {
	id: string
	name: string
	status: string
	owned_scope: string[]
	constraints?: string[]
	acceptance_criteria?: string[]
}

/**
 * The full structure of active_intents.yaml.
 */
export interface ActiveIntentsFile {
	active_intents: ActiveIntent[]
}

/**
 * Classification of a mutation for the trace ledger.
 */
export type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION" | "BUG_FIX" | "UNKNOWN"

/**
 * A single record appended to agent_trace.jsonl.
 */
export interface TraceRecord {
	id: string
	timestamp: string
	intent_id: string | null
	vcs: { revision_id: string }
	files: Array<{
		relative_path: string
		contributor: {
			entity_type: "AI" | "HUMAN"
			model_identifier: string
		}
		ranges: Array<{
			start_line: number
			end_line: number
			content_hash: string
		}>
		mutation_class: MutationClass
		related: Array<{
			type: string
			value: string
		}>
	}>
}
