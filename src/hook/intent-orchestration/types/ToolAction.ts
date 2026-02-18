/**
 * Tool action types for intent orchestration
 */

import type { HookContext, HookResult } from "./HookResult"

export type ToolName =
	| "select_active_intent"
	| "read_file"
	| "write_file"
	| "edit_file"
	| "execute_command"
	| "search_files"
	| "apply_diff"
	| "attempt_completion"

export interface ToolAction {
	name: ToolName
	args: Record<string, unknown>
	timestamp: string
}

export interface ToolCall {
	tool: ToolName
	params: Record<string, unknown>
}

export interface ToolRegistry {
	register(tool: ToolAction): void
	intercept(toolName: ToolName, handler: ToolInterceptor): void
}

export type ToolInterceptor = (tool: ToolAction, context: HookContext) => HookResult | Promise<HookResult>
