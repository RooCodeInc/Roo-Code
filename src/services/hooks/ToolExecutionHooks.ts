/**
 * Tool Execution Hooks Service
 *
 * Provides integration between the tool execution pipeline and the hooks system.
 * Handles PreToolUse, PostToolUse, PostToolUseFailure, and PermissionRequest events.
 */

import type {
	IHookManager,
	HookEventType,
	HookContext,
	HookSessionContext,
	HookProjectContext,
	HookToolContext,
	HooksExecutionResult,
} from "./types"

import type { HookExecutionOutputStatusPayload } from "@roo-code/types"

/**
 * Tool execution context for hooks.
 */
export interface ToolExecutionContext {
	/** Tool name being executed */
	toolName: string
	/** Tool input parameters */
	toolInput: Record<string, unknown>
	/** Session context */
	session: HookSessionContext
	/** Project context */
	project: HookProjectContext
}

/**
 * Result from PreToolUse hook execution.
 */
export interface PreToolUseResult {
	/** Whether the tool execution should proceed */
	proceed: boolean
	/** If blocked, the reason */
	blockReason?: string
	/** Modified tool input (if hooks modified it) */
	modifiedInput?: Record<string, unknown>
	/** Hook execution result for debugging */
	hookResult: HooksExecutionResult
}

/**
 * Result from PermissionRequest hook execution.
 */
export interface PermissionRequestResult {
	/** Whether the permission request should proceed to user */
	proceed: boolean
	/** If blocked, the reason */
	blockReason?: string
	/** Hook execution result for debugging */
	hookResult: HooksExecutionResult
}

/**
 * Callback for emitting hook execution status to webview.
 */
export type HookStatusCallback = (status: {
	status: "running" | "completed" | "failed" | "blocked"
	event: HookEventType
	toolName?: string
	hookId?: string
	duration?: number
	error?: string
	blockMessage?: string
	modified?: boolean
}) => void

/**
 * Callback for streaming terminal-style hook execution output status updates to the webview.
 */
export type HookOutputStatusCallback = (payload: HookExecutionOutputStatusPayload) => void

/**
 * Callback for emitting messages to chat history.
 */
export type SayCallback = (type: string, text?: string) => Promise<void>

export type UpdateSayCallback = (messageTs: number, type: string, text?: string) => Promise<void>

/**
 * Callback to check if hooks are globally enabled.
 */
export type HooksEnabledGetter = () => boolean

/**
 * Tool Execution Hooks Service
 *
 * Orchestrates hook execution for tool lifecycle events.
 */
export class ToolExecutionHooks {
	private hookManager: IHookManager | null
	private statusCallback?: HookStatusCallback
	private outputStatusCallback?: HookOutputStatusCallback
	private sayCallback?: SayCallback
	private updateSayCallback?: UpdateSayCallback
	private hooksEnabledGetter?: HooksEnabledGetter

	constructor(
		hookManager: IHookManager | null,
		statusCallback?: HookStatusCallback,
		outputStatusCallback?: HookOutputStatusCallback,
		sayCallback?: SayCallback,
		updateSayCallback?: UpdateSayCallback,
		hooksEnabledGetter?: HooksEnabledGetter,
	) {
		this.hookManager = hookManager
		this.statusCallback = statusCallback
		this.outputStatusCallback = outputStatusCallback
		this.sayCallback = sayCallback
		this.updateSayCallback = updateSayCallback
		this.hooksEnabledGetter = hooksEnabledGetter
	}

	/**
	 * Update the hook manager instance.
	 */
	setHookManager(hookManager: IHookManager | null): void {
		this.hookManager = hookManager
	}

	/**
	 * Update the status callback.
	 */
	setStatusCallback(callback: HookStatusCallback | undefined): void {
		this.statusCallback = callback
	}

	/**
	 * Update the output status callback.
	 */
	setOutputStatusCallback(callback: HookOutputStatusCallback | undefined): void {
		this.outputStatusCallback = callback
	}

	/**
	 * Update the say callback.
	 */
	setSayCallback(callback: SayCallback | undefined): void {
		this.sayCallback = callback
	}

	setUpdateSayCallback(callback: UpdateSayCallback | undefined): void {
		this.updateSayCallback = callback
	}

	/**
	 * Update the hooks enabled getter.
	 */
	setHooksEnabledGetter(getter: HooksEnabledGetter | undefined): void {
		this.hooksEnabledGetter = getter
	}

	/**
	 * Check if hooks are globally enabled.
	 * Returns true if no getter is set (backwards compatibility) or if the getter returns true.
	 */
	private isHooksEnabled(): boolean {
		if (!this.hooksEnabledGetter) {
			return true // Default to enabled for backwards compatibility
		}
		return this.hooksEnabledGetter()
	}

	/**
	 * Execute PreToolUse hooks before a tool is executed.
	 *
	 * @returns Result indicating whether to proceed, and optionally modified input
	 */
	async executePreToolUse(context: ToolExecutionContext): Promise<PreToolUseResult> {
		// Check global hooks enabled state first
		if (!this.isHooksEnabled() || !this.hookManager) {
			// No hooks configured - proceed normally
			return {
				proceed: true,
				hookResult: {
					results: [],
					blocked: false,
					totalDuration: 0,
				},
			}
		}

		const hookContext = this.buildToolHookContext("PreToolUse", context)

		// Emit running status
		this.emitStatus({
			status: "running",
			event: "PreToolUse",
			toolName: context.toolName,
		})

		try {
			const result = await this.hookManager.executeHooks("PreToolUse", {
				context: hookContext,
				executionId: `${context.session.taskId}:${Date.now()}`,
				outputStatusCallback: this.outputStatusCallback,
				hookExecutionCallback: this.buildHookExecutionCallback(),
			})

			// Legacy: hook_triggered rows are deprecated by hook_execution and would duplicate.

			if (result.blocked) {
				// Hook blocked the execution
				this.emitStatus({
					status: "blocked",
					event: "PreToolUse",
					toolName: context.toolName,
					blockMessage: result.blockMessage,
					duration: result.totalDuration,
				})

				return {
					proceed: false,
					blockReason: result.blockMessage || "Blocked by PreToolUse hook",
					hookResult: result,
				}
			}

			// Check for modifications
			const modified = !!result.modification
			const modifiedInput = result.modification?.toolInput

			this.emitStatus({
				status: "completed",
				event: "PreToolUse",
				toolName: context.toolName,
				duration: result.totalDuration,
				modified,
			})

			return {
				proceed: true,
				modifiedInput,
				hookResult: result,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			this.emitStatus({
				status: "failed",
				event: "PreToolUse",
				toolName: context.toolName,
				error: errorMessage,
			})

			// On hook execution error, proceed with original execution
			// (fail-open for safety)
			return {
				proceed: true,
				hookResult: {
					results: [],
					blocked: false,
					totalDuration: 0,
				},
			}
		}
	}

	/**
	 * Execute PostToolUse hooks after successful tool execution.
	 * This is non-blocking and fire-and-forget.
	 */
	async executePostToolUse(
		context: ToolExecutionContext,
		output: unknown,
		duration: number,
	): Promise<HooksExecutionResult> {
		// Check global hooks enabled state first
		if (!this.isHooksEnabled() || !this.hookManager) {
			return {
				results: [],
				blocked: false,
				totalDuration: 0,
			}
		}

		const hookContext = this.buildToolHookContext("PostToolUse", context, {
			output,
			duration,
		})

		this.emitStatus({
			status: "running",
			event: "PostToolUse",
			toolName: context.toolName,
		})

		try {
			const result = await this.hookManager.executeHooks("PostToolUse", {
				context: hookContext,
				executionId: `${context.session.taskId}:${Date.now()}`,
				outputStatusCallback: this.outputStatusCallback,
				hookExecutionCallback: this.buildHookExecutionCallback(),
			})

			// Legacy: hook_triggered rows are deprecated by hook_execution and would duplicate.

			this.emitStatus({
				status: "completed",
				event: "PostToolUse",
				toolName: context.toolName,
				duration: result.totalDuration,
			})

			return result
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			this.emitStatus({
				status: "failed",
				event: "PostToolUse",
				toolName: context.toolName,
				error: errorMessage,
			})

			return {
				results: [],
				blocked: false,
				totalDuration: 0,
			}
		}
	}

	/**
	 * Execute PostToolUseFailure hooks after failed tool execution.
	 * This is non-blocking and fire-and-forget.
	 */
	async executePostToolUseFailure(
		context: ToolExecutionContext,
		error: string,
		errorMessage: string,
	): Promise<HooksExecutionResult> {
		// Check global hooks enabled state first
		if (!this.isHooksEnabled() || !this.hookManager) {
			return {
				results: [],
				blocked: false,
				totalDuration: 0,
			}
		}

		const hookContext = this.buildToolHookContext("PostToolUseFailure", context, {
			error,
			errorMessage,
		})

		this.emitStatus({
			status: "running",
			event: "PostToolUseFailure",
			toolName: context.toolName,
		})

		try {
			const result = await this.hookManager.executeHooks("PostToolUseFailure", {
				context: hookContext,
				executionId: `${context.session.taskId}:${Date.now()}`,
				outputStatusCallback: this.outputStatusCallback,
				hookExecutionCallback: this.buildHookExecutionCallback(),
			})

			// Legacy: hook_triggered rows are deprecated by hook_execution and would duplicate.

			this.emitStatus({
				status: "completed",
				event: "PostToolUseFailure",
				toolName: context.toolName,
				duration: result.totalDuration,
			})

			return result
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err)

			this.emitStatus({
				status: "failed",
				event: "PostToolUseFailure",
				toolName: context.toolName,
				error: errMsg,
			})

			return {
				results: [],
				blocked: false,
				totalDuration: 0,
			}
		}
	}

	/**
	 * Execute PermissionRequest hooks before showing approval prompt.
	 *
	 * Note: Even if hooks indicate "block", this does NOT auto-approve restricted tools.
	 * The hook can only prevent the approval dialog from appearing (denying the tool),
	 * not bypass the existing approval/auto-approval rules.
	 *
	 * @returns Result indicating whether to proceed with showing the prompt
	 */
	async executePermissionRequest(context: ToolExecutionContext): Promise<PermissionRequestResult> {
		// Check global hooks enabled state first
		if (!this.isHooksEnabled() || !this.hookManager) {
			return {
				proceed: true,
				hookResult: {
					results: [],
					blocked: false,
					totalDuration: 0,
				},
			}
		}

		const hookContext = this.buildToolHookContext("PermissionRequest", context)

		this.emitStatus({
			status: "running",
			event: "PermissionRequest",
			toolName: context.toolName,
		})

		try {
			const result = await this.hookManager.executeHooks("PermissionRequest", {
				context: hookContext,
				executionId: `${context.session.taskId}:${Date.now()}`,
				outputStatusCallback: this.outputStatusCallback,
				hookExecutionCallback: this.buildHookExecutionCallback(),
			})

			// Legacy: hook_triggered rows are deprecated by hook_execution and would duplicate.

			if (result.blocked) {
				// Hook blocked - do not show approval dialog, deny the tool
				this.emitStatus({
					status: "blocked",
					event: "PermissionRequest",
					toolName: context.toolName,
					blockMessage: result.blockMessage,
					duration: result.totalDuration,
				})

				return {
					proceed: false,
					blockReason: result.blockMessage || "Blocked by PermissionRequest hook",
					hookResult: result,
				}
			}

			this.emitStatus({
				status: "completed",
				event: "PermissionRequest",
				toolName: context.toolName,
				duration: result.totalDuration,
			})

			return {
				proceed: true,
				hookResult: result,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			this.emitStatus({
				status: "failed",
				event: "PermissionRequest",
				toolName: context.toolName,
				error: errorMessage,
			})

			// On hook execution error, proceed with showing approval prompt
			// (fail-open for safety)
			return {
				proceed: true,
				hookResult: {
					results: [],
					blocked: false,
					totalDuration: 0,
				},
			}
		}
	}

	/**
	 * Check if hooks are configured and available.
	 */
	hasHooks(): boolean {
		return this.isHooksEnabled() && this.hookManager !== null && this.hookManager.getConfigSnapshot() !== null
	}

	/**
	 * Build hook context for tool-related events.
	 */
	private buildToolHookContext(
		event: HookEventType,
		context: ToolExecutionContext,
		extra?: {
			output?: unknown
			duration?: number
			error?: string
			errorMessage?: string
		},
	): HookContext {
		const toolContext: HookToolContext = {
			name: context.toolName,
			input: context.toolInput,
		}

		if (extra?.output !== undefined) {
			toolContext.output = extra.output
		}

		if (extra?.duration !== undefined) {
			toolContext.duration = extra.duration
		}

		if (extra?.error !== undefined) {
			toolContext.error = extra.error
		}

		if (extra?.errorMessage !== undefined) {
			toolContext.errorMessage = extra.errorMessage
		}

		return {
			event,
			timestamp: new Date().toISOString(),
			session: context.session,
			project: context.project,
			tool: toolContext,
		}
	}

	/**
	 * Emit status to webview if callback is set.
	 */
	private emitStatus(status: Parameters<HookStatusCallback>[0]): void {
		if (this.statusCallback) {
			try {
				this.statusCallback(status)
			} catch {
				// Ignore callback errors
			}
		}
	}

	// Persisted hook_execution rows need to be stable across all hook runs for a task.
	// Keep this mapping on the instance so multiple executeHooks() calls don't lose update ability.
	private hookExecutionMessageTsByExecutionId = new Map<string, number>()
	private hookExecutionCallbackInstance?: NonNullable<import("./types").ExecuteHooksOptions["hookExecutionCallback"]>

	private buildHookExecutionCallback(): NonNullable<import("./types").ExecuteHooksOptions["hookExecutionCallback"]> {
		if (this.hookExecutionCallbackInstance) {
			return this.hookExecutionCallbackInstance
		}

		this.hookExecutionCallbackInstance = async (evt) => {
			if (!this.sayCallback) return

			if (evt.phase === "started") {
				// Create one persisted row per hook run.
				// We include an embedded messageTs so we can update the exact row later.
				const messageTs = Date.now()
				this.hookExecutionMessageTsByExecutionId.set(evt.executionId, messageTs)

				const payload = {
					executionId: evt.executionId,
					hookId: evt.hookId,
					event: evt.event,
					toolName: evt.toolName,
					command: evt.command,
					// Required for stable updates.
					messageTs,
				}

				await this.sayCallback("hook_execution", JSON.stringify(payload))
				return
			}

			// Terminal states: update persisted row with a compressed output summary.
			const messageTs = this.hookExecutionMessageTsByExecutionId.get(evt.executionId)
			if (!messageTs || !this.updateSayCallback) {
				return
			}

			const payload = {
				executionId: evt.executionId,
				hookId: evt.hookId,
				event: evt.event,
				toolName: evt.toolName,
				command: evt.command,
				messageTs,
				result: {
					phase: evt.phase,
					exitCode: evt.exitCode,
					durationMs: evt.durationMs,
					blockMessage: evt.blockMessage,
					error: evt.error,
					modified: evt.modified,
					outputSummary: evt.outputSummary,
				},
			}

			await this.updateSayCallback(messageTs, "hook_execution", JSON.stringify(payload))
		}

		return this.hookExecutionCallbackInstance
	}
}

/**
 * Create a ToolExecutionHooks instance.
 */
export function createToolExecutionHooks(
	hookManager: IHookManager | null,
	statusCallback?: HookStatusCallback,
	outputStatusCallback?: HookOutputStatusCallback,
	sayCallback?: SayCallback,
	updateSayCallback?: UpdateSayCallback,
	hooksEnabledGetter?: HooksEnabledGetter,
): ToolExecutionHooks {
	return new ToolExecutionHooks(
		hookManager,
		statusCallback,
		outputStatusCallback,
		sayCallback,
		updateSayCallback,
		hooksEnabledGetter,
	)
}
