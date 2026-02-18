/**
 * Hook system types for TRP1: Intent-Code Traceability.
 * Pre/Post hooks intercept tool execution for context injection and trace logging.
 */

/** Phase of tool execution for hook interception */
export type HookPhase = "pre" | "post"

/** Tool names that the hook engine can intercept */
export type HookableToolName = "write_to_file" | "execute_command" | "select_active_intent"

/** Classification for write_file mutations (Phase 3) */
export type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION"

/** Context passed to pre-hooks (e.g. intent scope, constraints) */
export interface PreHookContext {
	toolName: HookableToolName
	params: Record<string, unknown>
	activeIntentId?: string
}

/** Context passed to post-hooks (e.g. for agent_trace.jsonl) */
export interface PostHookContext {
	toolName: HookableToolName
	params: Record<string, unknown>
	result?: unknown
	activeIntentId?: string
	mutationClass?: MutationClass
}

/** Result of a pre-hook: allow, block, or inject context */
export type PreHookResult =
	| { allow: true; injectedContext?: string }
	| { allow: false; error: string }
