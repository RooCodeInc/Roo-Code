/**
 * Hook Engine API Contracts
 *
 * Defines the TypeScript interfaces and types for the hook middleware system.
 * These contracts ensure type safety and clear API boundaries.
 */

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
 * Pre-hook validation result
 */
export interface PreHookResult {
	allowed: boolean
	error?: string
	modifiedParams?: Record<string, unknown>
}

/**
 * Post-hook execution result
 */
export interface PostHookResult {
	success: boolean
	error?: string
	traceEntry?: TraceLogEntry
}

/**
 * Hook function type for pre-execution interceptors
 */
export type PreHookFunction = (context: ToolExecutionContext) => Promise<PreHookResult>

/**
 * Hook function type for post-execution interceptors
 */
export type PostHookFunction = (context: ToolExecutionContext, result: unknown) => Promise<PostHookResult>

/**
 * Hook Engine interface
 */
export interface IHookEngine {
	/**
	 * Register a pre-execution hook
	 */
	registerPreHook(hook: PreHookFunction): void

	/**
	 * Register a post-execution hook
	 */
	registerPostHook(hook: PostHookFunction): void

	/**
	 * Execute all pre-hooks and return validation result
	 */
	executePreHooks(context: ToolExecutionContext): Promise<PreHookResult>

	/**
	 * Execute all post-hooks
	 */
	executePostHooks(context: ToolExecutionContext, result: unknown): Promise<PostHookResult>
}

/**
 * Intent Manager interface
 */
export interface IIntentManager {
	/**
	 * Load all intents from active_intents.yaml
	 */
	loadIntents(): Promise<ActiveIntent[]>

	/**
	 * Get intent by ID
	 */
	getIntent(intentId: string): Promise<ActiveIntent | null>

	/**
	 * Get active intent for a task
	 */
	getActiveIntent(taskId: string): Promise<ActiveIntent | null>

	/**
	 * Set active intent for a task
	 */
	setActiveIntent(taskId: string, intentId: string): Promise<void>

	/**
	 * Clear active intent for a task
	 */
	clearActiveIntent(taskId: string): Promise<void>
}

/**
 * Scope Validator interface
 */
export interface IScopeValidator {
	/**
	 * Validate file path against intent scope patterns
	 */
	validatePath(filePath: string, scopePatterns: string[]): Promise<boolean>

	/**
	 * Check if path matches any of the scope patterns
	 */
	matchesAnyPattern(filePath: string, patterns: string[]): boolean
}

/**
 * Trace Manager interface
 */
export interface ITraceManager {
	/**
	 * Append trace entry to agent_trace.jsonl
	 */
	appendTraceEntry(entry: TraceLogEntry): Promise<void>

	/**
	 * Create trace entry from operation context
	 */
	createTraceEntry(
		intentId: string,
		filePath: string,
		content: string,
		mutationClass: MutationClass,
	): Promise<TraceLogEntry>
}

/**
 * Optimistic Lock Manager interface
 */
export interface IOptimisticLockManager {
	/**
	 * Create a lock for a file operation
	 */
	createLock(filePath: string, expectedHash: string): Promise<FileStateLock>

	/**
	 * Validate lock before write operation
	 */
	validateLock(lock: FileStateLock): Promise<boolean>

	/**
	 * Release lock after operation completes
	 */
	releaseLock(lock: FileStateLock): Promise<void>
}

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
 * Trace Log Entry entity
 */
export interface TraceLogEntry {
	intentId: string
	contentHash: string
	filePath: string
	mutationClass: MutationClass
	lineRanges?: LineRange[]
	timestamp: string
	toolName: string
	gitSha?: string
}

/**
 * File State Lock entity
 */
export interface FileStateLock {
	filePath: string
	expectedHash: string
	operationId: string
	timestamp: string
}

/**
 * Line Range type
 */
export interface LineRange {
	start: number
	end: number
}

/**
 * Intent Status enum
 */
export enum IntentStatus {
	PENDING = "PENDING",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED",
	BLOCKED = "BLOCKED",
}

/**
 * Mutation Class enum
 */
export enum MutationClass {
	CREATE = "CREATE",
	MODIFY = "MODIFY",
}
