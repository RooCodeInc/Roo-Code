import type { ToolName } from "@roo-code/types"

import { Task } from "../task/Task"
import type { ToolUse, HandleError, PushToolResult, AskApproval, NativeToolArgs } from "../../shared/tools"

/**
 * State tracking for partial (streaming) tool execution.
 *
 * Uses a discriminated union to prevent impossible states:
 * - Can't have errorCount without firstErrorTime
 * - Can't be in "erroring" state without error metadata
 * - Reset is trivial: `{ status: "idle" }`
 */
type PartialExecutionState =
	| { status: "idle" }
	| {
			status: "streaming"
			lastSeenPath?: string
	  }
	| {
			status: "erroring"
			errorCount: number
			lastErrorMessage: string
			firstErrorTime: number
			lastSeenPath?: string
			isPathValidationError?: boolean
	  }

/**
 * Callbacks passed to tool execution
 */
export interface ToolCallbacks {
	askApproval: AskApproval
	handleError: HandleError
	pushToolResult: PushToolResult
	toolCallId?: string
}

/**
 * Helper type to extract the parameter type for a tool based on its name.
 * If the tool has native args defined in NativeToolArgs, use those; otherwise fall back to any.
 */
type ToolParams<TName extends ToolName> = TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : any

/**
 * Abstract base class for all tools.
 *
 * Tools receive typed arguments from native tool calling via `ToolUse.nativeArgs`.
 *
 * @template TName - The specific tool name, which determines native arg types
 */
export abstract class BaseTool<TName extends ToolName> {
	/**
	 * The tool's name (must match ToolName type)
	 */
	abstract readonly name: TName

	/**
	 * Per-task partial execution state.
	 * WeakMap ensures no memory leak - state is GC'd when Task is GC'd.
	 * Static so state is shared across tool instances but isolated per task.
	 */
	private static partialStateByTask = new WeakMap<Task, PartialExecutionState>()

	/**
	 * Get partial state for a task, initializing if needed.
	 */
	protected getPartialState(task: Task): PartialExecutionState {
		let state = BaseTool.partialStateByTask.get(task)
		if (!state) {
			state = { status: "idle" }
			BaseTool.partialStateByTask.set(task, state)
		}
		return state
	}

	/**
	 * Set partial state for a task.
	 */
	protected setPartialState(task: Task, state: PartialExecutionState): void {
		BaseTool.partialStateByTask.set(task, state)
	}

	/**
	 * Execute the tool with typed parameters.
	 *
	 * Receives typed parameters from native tool calling via `ToolUse.nativeArgs`.
	 *
	 * @param params - Typed parameters
	 * @param task - Task instance with state and API access
	 * @param callbacks - Tool execution callbacks (approval, error handling, results)
	 */
	abstract execute(params: ToolParams<TName>, task: Task, callbacks: ToolCallbacks): Promise<void>

	/**
	 * Handle partial (streaming) tool messages.
	 *
	 * Default implementation does nothing. Tools that support streaming
	 * partial messages should override this.
	 *
	 * @param task - Task instance
	 * @param block - Partial ToolUse block
	 */
	async handlePartial(task: Task, block: ToolUse<TName>): Promise<void> {
		// Default: no-op for partial messages
		// Tools can override to show streaming UI updates
	}

	/**
	 * Check if a path parameter has stabilized during streaming.
	 *
	 * During native tool call streaming, the partial-json library may return truncated
	 * string values when chunk boundaries fall mid-value. This method tracks the path
	 * value between consecutive handlePartial() calls and returns true only when the
	 * path has stopped changing (stabilized).
	 *
	 * Usage in handlePartial():
	 * ```typescript
	 * if (!this.hasPathStabilized(task, block.params.path)) {
	 *     return // Path still changing, wait for it to stabilize
	 * }
	 * // Path is stable, proceed with UI updates
	 * ```
	 *
	 * @param task - Task instance for per-task state isolation
	 * @param path - The current path value from the partial block
	 * @returns true if path has stabilized (same value seen twice) and is non-empty, false otherwise
	 */
	protected hasPathStabilized(task: Task, path: string | undefined): boolean {
		const state = this.getPartialState(task)
		const lastSeenPath = state.status !== "idle" ? state.lastSeenPath : undefined
		const pathHasStabilized = lastSeenPath !== undefined && lastSeenPath === path

		// Update state with new path, preserving other state fields
		if (state.status === "idle") {
			this.setPartialState(task, { status: "streaming", lastSeenPath: path })
		} else if (state.status === "streaming") {
			this.setPartialState(task, { ...state, lastSeenPath: path })
		} else {
			// erroring state - preserve error info
			this.setPartialState(task, { ...state, lastSeenPath: path })
		}

		return pathHasStabilized && !!path
	}

	/**
	 * Reset the partial state tracking for a task.
	 *
	 * Should be called at the end of execute() (both success and error paths)
	 * to ensure clean state for the next tool invocation.
	 *
	 * @param task - Task instance to reset state for
	 */
	resetPartialState(task: Task): void {
		this.setPartialState(task, { status: "idle" })
	}

	/**
	 * Notify about a partial execution error with suppression for repeated errors.
	 *
	 * This method implements error suppression to prevent log spam during streaming
	 * when the same error (e.g., invalid path) repeats on every chunk.
	 *
	 * Behavior:
	 * - First error: logs and returns true (caller should handle)
	 * - Subsequent identical errors: suppressed, returns false
	 * - Different error message: logs and returns true
	 *
	 * @param task - Task instance for per-task state isolation
	 * @param errorMessage - The error message to report
	 * @param isPathValidationError - Whether this is a path validation error (enables fast-path guard)
	 * @returns true if the error should be handled (first occurrence), false if suppressed
	 */
	protected notifyPartialError(task: Task, errorMessage: string, isPathValidationError = false): boolean {
		const state = this.getPartialState(task)

		if (state.status === "erroring" && state.lastErrorMessage === errorMessage) {
			// Suppress repeated identical error
			this.setPartialState(task, {
				...state,
				errorCount: state.errorCount + 1,
			})
			return false
		}

		// First error or different error message - log and track
		const now = Date.now()
		this.setPartialState(task, {
			status: "erroring",
			errorCount: 1,
			lastErrorMessage: errorMessage,
			firstErrorTime: now,
			lastSeenPath: state.status !== "idle" ? state.lastSeenPath : undefined,
			isPathValidationError,
		})

		console.error(`[${this.name}] Partial error: ${errorMessage}`)
		return true
	}

	/**
	 * Check if we should skip expensive work due to a known path validation error.
	 *
	 * This is a fast-path optimization: once we know the path is invalid, skip
	 * filesystem operations and other expensive work on subsequent streaming chunks.
	 *
	 * @param task - Task instance for per-task state isolation
	 * @returns true if we should skip (path validation error is active), false otherwise
	 */
	protected shouldSkipDueToPathError(task: Task): boolean {
		const state = this.getPartialState(task)
		return state.status === "erroring" && state.isPathValidationError === true
	}

	/**
	 * Main entry point for tool execution.
	 *
	 * Handles the complete flow:
	 * 1. Fast-path guard for known path validation errors (skip expensive work)
	 * 2. Partial message handling with error suppression (if partial)
	 * 3. Parameter parsing (nativeArgs only)
	 * 4. Core execution (execute)
	 *
	 * @param task - Task instance
	 * @param block - ToolUse block from assistant message
	 * @param callbacks - Tool execution callbacks
	 */
	async handle(task: Task, block: ToolUse<TName>, callbacks: ToolCallbacks): Promise<void> {
		// Handle partial messages
		if (block.partial) {
			// Fast-path guard: skip expensive work if we already know the path is invalid.
			// This prevents repeated filesystem operations on every streaming chunk.
			if (this.shouldSkipDueToPathError(task)) {
				return
			}

			try {
				await this.handlePartial(task, block)
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				const isPathError = errorMessage.includes("Invalid path:")

				// Use error suppression: only handle first occurrence of each error
				if (this.notifyPartialError(task, errorMessage, isPathError)) {
					// First error - let the caller know (but don't spam handleError)
					// Note: We log in notifyPartialError, so just return silently here
					// The error will be properly reported when execute() runs
				}
				// Suppressed errors: silently skip
			}
			return
		}

		// Native-only: obtain typed parameters from `nativeArgs`.
		let params: ToolParams<TName>
		try {
			if (block.nativeArgs !== undefined) {
				// Native: typed args provided by NativeToolCallParser.
				params = block.nativeArgs as ToolParams<TName>
			} else {
				// If legacy/XML markup was provided via params, surface a clear error.
				const paramsText = (() => {
					try {
						return JSON.stringify(block.params ?? {})
					} catch {
						return ""
					}
				})()
				if (paramsText.includes("<") && paramsText.includes(">")) {
					throw new Error(
						"XML tool calls are no longer supported. Use native tool calling (nativeArgs) instead.",
					)
				}
				throw new Error("Tool call is missing native arguments (nativeArgs).")
			}
		} catch (error) {
			console.error(`Error parsing parameters:`, error)
			const errorMessage = `Failed to parse ${this.name} parameters: ${error instanceof Error ? error.message : String(error)}`
			await callbacks.handleError(`parsing ${this.name} args`, new Error(errorMessage))
			// Note: handleError already emits a tool_result via formatResponse.toolError in the caller.
			// Do NOT call pushToolResult here to avoid duplicate tool_result payloads.
			return
		}

		// Execute with typed parameters
		await this.execute(params, task, callbacks)
	}
}
