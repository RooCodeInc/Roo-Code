export interface HookContext {
	taskId: string
	activeIntentId?: string
	mode?: string
	modelId?: string
	provider?: string
	toolName: string
	params: Record<string, unknown>
	toolCallId?: string
	cwd?: string
	userRole?: string
	timestamp: string
	mutationSummary?: string
	contentHash?: string
	category?: "safe" | "destructive" | "unknown"
}

export interface HookResult {
	allow: boolean
	message?: string
	isError?: boolean
}

/** Flat entry for simple logging (backward compatible). */
export interface HookTraceEntry {
	timestamp: string
	intent_id?: string
	task_id: string
	tool_name: string
	tool_use_id?: string
	mode?: string
	model_id?: string
	provider?: string
	category?: string
	params: Record<string, unknown>
	mutation_summary?: string
	content_hash?: string
	result?: string
	error?: string
}

/** TRP1 Agent Trace schema: append-only ledger linking intent → code hash → agent action. */
export interface AgentTraceEntryTRP1 {
	id: string
	timestamp: string
	vcs?: { revision_id?: string }
	files: Array<{
		relative_path: string
		conversations: Array<{
			url?: string
			contributor?: { entity_type: string; model_identifier?: string }
			ranges?: Array<{ start_line?: number; end_line?: number; content_hash?: string }>
			related?: Array<{ type: string; value: string }>
		}>
	}>
}

export type PreHook = (ctx: HookContext) => Promise<HookResult>
export type PostHook = (ctx: HookContext, result: HookResult) => Promise<void>
