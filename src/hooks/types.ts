import type { Task } from "../core/task/Task"

/**
 * Context passed to Pre-Hook before tool execution
 */
export interface PreHookContext {
	toolName: string
	params: any
	task: Task
}

/**
 * Result returned from Pre-Hook
 */
export interface PreHookResult {
	blocked: boolean
	reason?: string
	contextInjection?: string
}

/**
 * Context passed to Post-Hook after tool execution
 */
export interface PostHookContext {
	toolName: string
	params: any
	result: any
	task: Task
}
