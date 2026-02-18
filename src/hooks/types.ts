/**
 * Type definitions for the Roo Code hook middleware system.
 *
 * Hooks are composable middleware that intercept tool execution at two points:
 * - PreToolUse: Before a tool executes (can modify params, block execution)
 * - PostToolUse: After a tool executes (can log results, trigger side effects)
 */

import type { ToolName } from "@roo-code/types"
import type { ToolUse } from "../shared/tools"
import type { Task } from "../core/task/Task"

/**
 * Result returned by hook functions.
 * Hooks can signal to continue, abort, or modify tool execution.
 */
export interface HookResult {
	/** Whether to continue with tool execution (false = abort) */
	continue: boolean
	/** Optional message to show user if execution is aborted */
	reason?: string
	/** Modified parameters to pass to the tool (for PreToolUse hooks) */
	modifiedParams?: Record<string, unknown>
	/** Additional context to inject into the next LLM prompt */
	contextToInject?: string
}

/**
 * Context passed to PreToolUse hooks before tool execution.
 */
export interface PreToolUseContext<TName extends ToolName = ToolName> {
	/** The Task instance executing this tool */
	task: Task
	/** The tool_use block from the LLM response */
	toolUse: ToolUse<TName>
	/** Parsed parameters for the tool */
	params: Record<string, unknown>
	/** Timestamp when the tool was invoked */
	timestamp: number
	/** Current workspace root path */
	cwd: string
}

/**
 * Context passed to PostToolUse hooks after tool execution.
 */
export interface PostToolUseContext<TName extends ToolName = ToolName> {
	/** The Task instance that executed this tool */
	task: Task
	/** The tool_use block from the LLM response */
	toolUse: ToolUse<TName>
	/** Parameters that were passed to the tool */
	params: Record<string, unknown>
	/** Result returned by the tool (can be string or structured data) */
	result: unknown
	/** Whether the tool execution succeeded */
	success: boolean
	/** Error object if execution failed */
	error?: Error
	/** Timestamp when tool execution started */
	startTime: number
	/** Timestamp when tool execution completed */
	endTime: number
	/** Duration in milliseconds */
	duration: number
}

/**
 * Intent context loaded from .orchestration/active_intents.yaml
 */
export interface IntentContext {
	/** Unique identifier for the intent */
	intentId: string
	/** Intent title/description */
	title: string
	/** Detailed context about the intent */
	context: string
	/** Related files mentioned in the intent */
	files?: string[]
	/** Additional metadata */
	metadata?: Record<string, unknown>
}

/**
 * Trace record for agent_trace.jsonl
 */
export interface AgentTraceRecord {
	/** Timestamp of the event */
	timestamp: string
	/** Type of event (tool_use, tool_result, etc.) */
	eventType: "tool_use" | "tool_result" | "approval_requested" | "approval_received"
	/** Tool name that was invoked */
	toolName: ToolName
	/** Tool parameters (sanitized for logging) */
	params?: Record<string, unknown>
	/** Tool result (sanitized for logging) */
	result?: unknown
	/** Whether the tool required approval */
	requiresApproval?: boolean
	/** Whether user approved the action */
	approved?: boolean
	/** Duration of tool execution in ms */
	duration?: number
	/** Task ID for correlation */
	taskId: string
	/** Additional context */
	context?: Record<string, unknown>
}

/**
 * Command classification result for security checks
 */
export interface CommandClassification {
	/** The command being executed */
	command: string
	/** Risk level: safe, medium, high, critical */
	riskLevel: "safe" | "medium" | "high" | "critical"
	/** Whether human approval is required */
	requiresApproval: boolean
	/** Reason for the classification */
	reason: string
	/** Suggested mitigation or alternative */
	mitigation?: string
}

/**
 * Hook function type for PreToolUse interceptors
 */
export type PreToolUseHook = <TName extends ToolName>(context: PreToolUseContext<TName>) => Promise<HookResult>

/**
 * Hook function type for PostToolUse interceptors
 */
export type PostToolUseHook = <TName extends ToolName>(context: PostToolUseContext<TName>) => Promise<HookResult>

/**
 * Registry of all active hooks
 */
export interface HookRegistry {
	/** Hooks to run before tool execution */
	preToolUseHooks: PreToolUseHook[]
	/** Hooks to run after tool execution */
	postToolUseHooks: PostToolUseHook[]
}
