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
	ExecuteHooksOptions,
} from "./types"

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
 * Tool Execution Hooks Service
 *
 * Orchestrates hook execution for tool lifecycle events.
 */
export class ToolExecutionHooks {
	private hookManager: IHookManager | null
	private statusCallback?: HookStatusCallback

	constructor(hookManager: IHookManager | null, statusCallback?: HookStatusCallback) {
		this.hookManager = hookManager
		this.statusCallback = statusCallback
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
	 * Execute PreToolUse hooks before a tool is executed.
	 *
	 * @returns Result indicating whether to proceed, and optionally modified input
	 */
	async executePreToolUse(context: ToolExecutionContext): Promise<PreToolUseResult> {
		if (!this.hookManager) {
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
			const result = await this.hookManager.executeHooks("PreToolUse", { context: hookContext })

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
		if (!this.hookManager) {
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
			const result = await this.hookManager.executeHooks("PostToolUse", { context: hookContext })

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
		if (!this.hookManager) {
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
			const result = await this.hookManager.executeHooks("PostToolUseFailure", { context: hookContext })

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
		if (!this.hookManager) {
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
			const result = await this.hookManager.executeHooks("PermissionRequest", { context: hookContext })

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
		return this.hookManager !== null && this.hookManager.getConfigSnapshot() !== null
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
}

/**
 * Create a ToolExecutionHooks instance.
 */
export function createToolExecutionHooks(
	hookManager: IHookManager | null,
	statusCallback?: HookStatusCallback,
): ToolExecutionHooks {
	return new ToolExecutionHooks(hookManager, statusCallback)
}
