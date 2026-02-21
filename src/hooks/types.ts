/**
 * Type definitions for the Intent-Governed Hook Middleware system.
 */

/**
 * Intent status enumeration
 */
export type IntentStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED"

/**
 * Mutation class enumeration
 */
export type MutationClass = "CREATE" | "MODIFY"

/**
 * Active Intent entity
 */
export interface ActiveIntent {
	id: string
	name: string
	description: string
	status: IntentStatus
	ownedScope: string[]
	constraints: string[]
	acceptanceCriteria: string[]
	metadata?: Record<string, unknown>
}

/**
 * Trace Log Entry entity (internal).
 */
export interface TraceLogEntry {
	intentId: string
	contentHash: string
	filePath: string
	mutationClass: MutationClass
	lineRanges?: Array<{ start: number; end: number }>
	timestamp: string
	toolName: string
	gitSha?: string
}

/**
 * Spec-aligned trace entry written to agent_trace.jsonl.
 */
export type TraceClassification = "INTENT_EVOLUTION" | "AST_REFACTOR"

export interface SpecTraceLogEntry {
	timestamp: string
	intent_id: string
	operation: "WRITE"
	file_path: string
	content_hash: string
	classification: TraceClassification
}

/**
 * File State Lock entity for optimistic locking
 */
export interface FileStateLock {
	filePath: string
	expectedHash: string
	operationId: string
	timestamp: string
}

/**
 * YAML structure for active_intents.yaml
 */
export interface ActiveIntentsYaml {
	intents: ActiveIntent[]
}

/**
 * Tool execution context passed to hooks
 */
export interface ToolExecutionContext {
	toolName: string
	toolParams: Record<string, unknown>
	taskId: string
	workspacePath: string
	activeIntentId?: string
}

/**
 * Pre-hook result
 */
export interface PreHookResult {
	allowed: boolean
	error?: string
	modifiedParams?: Record<string, unknown>
}

/**
 * Post-hook result
 */
export interface PostHookResult {
	success: boolean
	error?: string
	traceEntry?: TraceLogEntry
}
