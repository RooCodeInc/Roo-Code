/**
 * Hook result types for pre/post tool interception
 */

import type { TraceEntry } from "./TraceTypes"

export type HookAction = "allow" | "block" | "modify" | "inject"

export interface HookContext {
	tool_name: string
	tool_args: Record<string, unknown>
	intent_id?: string
	timestamp: string
}

export interface HookResult {
	action: HookAction
	shouldProceed: boolean
	modifiedArgs?: Record<string, unknown>
	contextToInject?: string
	error?: string
}

export type PreHookResult = HookResult

export interface PostHookResult extends HookResult {
	trace_entry?: TraceEntry
}
