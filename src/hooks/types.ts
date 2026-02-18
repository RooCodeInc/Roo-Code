/**
 * Orchestration hook types for Intent–Code traceability (TRP1).
 * Data models and schemas for .orchestration/ sidecar storage.
 */

export interface ActiveIntent {
	id: string
	name: string
	status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED"
	owned_scope?: string[]
	constraints?: string[]
	acceptance_criteria?: string[]
}

export interface ActiveIntentsDoc {
	active_intents: ActiveIntent[]
}

export interface IntentContext {
	id: string
	name: string
	status: string
	constraints: string[]
	owned_scope: string[]
	acceptance_criteria?: string[]
}

export type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION" | "NEW_FILE" | "UNKNOWN"

export interface HookResult {
	blocked: boolean
	error?: string
	/** For select_active_intent: XML or text to inject as tool result */
	injectResult?: string
}

/** Per-file entry in agent_trace.jsonl */
export interface AgentTraceFileEntry {
	relative_path: string
	conversations: AgentTraceConversation[]
}

export interface AgentTraceConversation {
	url?: string
	contributor: {
		entity_type: "AI" | "human"
		model_identifier?: string
	}
	ranges: Array<{
		start_line: number
		end_line: number
		content_hash: string
	}>
	related: Array<{ type: string; value: string }>
}

export interface AgentTraceEntry {
	id: string
	timestamp: string
	vcs?: { revision_id: string }
	files: AgentTraceFileEntry[]
}

/** Safe = read-only; Destructive = write, delete, execute */
export type CommandClass = "safe" | "destructive"

export const DESTRUCTIVE_TOOLS = [
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"execute_command",
	"new_task",
	"generate_image",
] as const

export const SAFE_TOOLS = [
	"read_file",
	"list_files",
	"codebase_search",
	"search_files",
	"read_command_output",
	"use_mcp_tool",
	"access_mcp_resource",
	"ask_followup_question",
	"switch_mode",
	"update_todo_list",
	"attempt_completion",
	"run_slash_command",
	"skill",
] as const
