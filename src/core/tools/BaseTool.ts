import type { ToolName } from "@roo-code/types"

import { Task } from "../task/Task"
import type { ToolUse, HandleError, PushToolResult, AskApproval, NativeToolArgs } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { isGovernedWorkspace, loadActiveIntents, findIntentById, type IntentTraceEvent } from "../context/activeIntents"
import { hookEngine, buildHookContext } from "../../hooks"

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
 * Tools that are safe (read-only / non-destructive) and bypass intent enforcement.
 * These tools can be used even without an active intent in governed mode.
 */
export const SAFE_TOOLS: ReadonlySet<string> = new Set([
	// Read-only tools
	"read_file",
	"search_files",
	"list_files",
	"codebase_search",
	"read_command_output",
	// Non-destructive / meta tools
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"update_todo_list",
	"run_slash_command",
	"skill",
	// Intent tool itself
	"select_active_intent",
])

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
	 * Track the last seen path during streaming to detect when the path has stabilized.
	 * Used by hasPathStabilized() to prevent displaying truncated paths from partial-json parsing.
	 */
	protected lastSeenPartialPath: string | undefined = undefined

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
	 * if (!this.hasPathStabilized(block.params.path)) {
	 *     return // Path still changing, wait for it to stabilize
	 * }
	 * // Path is stable, proceed with UI updates
	 * ```
	 *
	 * @param path - The current path value from the partial block
	 * @returns true if path has stabilized (same value seen twice) and is non-empty, false otherwise
	 */
	protected hasPathStabilized(path: string | undefined): boolean {
		const pathHasStabilized = this.lastSeenPartialPath !== undefined && this.lastSeenPartialPath === path
		this.lastSeenPartialPath = path
		return pathHasStabilized && !!path
	}

	/**
	 * Reset the partial state tracking.
	 *
	 * Should be called at the end of execute() (both success and error paths)
	 * to ensure clean state for the next tool invocation.
	 */
	resetPartialState(): void {
		this.lastSeenPartialPath = undefined
	}

	/**
	 * Main entry point for tool execution.
	 *
	 * Handles the complete flow:
	 * 1. Partial message handling (if partial)
	 * 2. Parameter parsing (nativeArgs only)
	 * 3. Intent Handshake enforcement (governed mode only)
	 * 4. Core execution (execute)
	 *
	 * @param task - Task instance
	 * @param block - ToolUse block from assistant message
	 * @param callbacks - Tool execution callbacks
	 */
	async handle(task: Task, block: ToolUse<TName>, callbacks: ToolCallbacks): Promise<void> {
		// Handle partial messages
		if (block.partial) {
			try {
				await this.handlePartial(task, block)
			} catch (error) {
				console.error(`Error in handlePartial:`, error)
				await callbacks.handleError(
					`handling partial ${this.name}`,
					error instanceof Error ? error : new Error(String(error)),
				)
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

		/**
		 * Intent Handshake Enforcement
		 *
		 * When .orchestration/active_intents.yaml exists, the workspace is in "governed mode".
		 * In governed mode, ALL destructive tools must have a valid, IN_PROGRESS intent selected.
		 *
		 * Rules:
		 * 1. select_active_intent is always allowed (it sets the intent)
		 * 2. Read-only tools (SAFE_TOOLS) are always allowed
		 * 3. If no intent is selected → block with error
		 * 4. If intent exists but is not found in YAML or not IN_PROGRESS → clear it and block
		 * 5. If no .orchestration/active_intents.yaml exists → skip enforcement (ungoverned mode)
		 *
		 * This ensures the LLM cannot make changes without first loading intent context,
		 * and stale/completed intents are automatically rejected.
		 */
		if (!SAFE_TOOLS.has(this.name) && isGovernedWorkspace(task.cwd)) {
			// Rule 3: No intent selected at all
			if (!task.activeIntentId) {
				const errorMsg =
					"ERROR: No active Intent selected. You must call select_active_intent(intent_id) " +
					"before using destructive tools. This workspace requires intent governance."
				task.consecutiveMistakeCount++
				task.recordToolError(this.name, errorMsg)
				callbacks.pushToolResult(formatResponse.toolError(errorMsg))
				return
			}

			// Rule 4: Validate that the selected intent is still valid and IN_PROGRESS
			try {
				const intents = await loadActiveIntents(task.cwd)
				const intent = findIntentById(intents, task.activeIntentId)

				if (!intent || intent.status !== "IN_PROGRESS") {
					// Stale or completed intent — clear it and block
					const reason = !intent
						? `Intent "${task.activeIntentId}" no longer exists in active_intents.yaml.`
						: `Intent "${task.activeIntentId}" has status "${intent.status}" (must be IN_PROGRESS).`

					task.activeIntentId = undefined
					task.activeIntentContext = undefined

					const inProgressIds = intents.filter((i) => i.status === "IN_PROGRESS").map((i) => i.id)
					const suggestion =
						inProgressIds.length > 0
							? ` Available IN_PROGRESS intents: [${inProgressIds.join(", ")}]`
							: " No IN_PROGRESS intents available."

					const errorMsg =
						`ERROR: ${reason} Intent cleared.` +
						` Call select_active_intent(intent_id) with a valid IN_PROGRESS intent.` +
						suggestion
					task.consecutiveMistakeCount++
					task.recordToolError(this.name, errorMsg)
					callbacks.pushToolResult(formatResponse.toolError(errorMsg))
					return
				}
			} catch (error) {
				// If we can't read the YAML, log but allow execution to continue
				// (the file existed at the isGovernedWorkspace check above)
				console.warn(`[BaseTool] Failed to re-validate intent: ${error}`)
			}
		}

		// ──────────────────────────────────────────────────────────────────────
		// Phase 2: Hook Engine — UI-Blocking Authorization & Scope Enforcement
		// Runs AFTER the Phase 1 gatekeeper (intent handshake) and BEFORE
		// tool execution. Fires only for destructive tools in governed mode.
		// ──────────────────────────────────────────────────────────────────────
		if (!SAFE_TOOLS.has(this.name) && isGovernedWorkspace(task.cwd)) {
			const hookCtx = buildHookContext(this.name, (params ?? {}) as Record<string, unknown>, task)
			const hookResult = await hookEngine.runPre(hookCtx)
			if (!hookResult.proceed) {
				callbacks.pushToolResult(formatResponse.toolError(hookResult.error ?? "Blocked by Hook Engine."))
				return
			}
		}

		// Execute with typed parameters and record trace events for governed mode
		let executeError: Error | undefined
		try {
			await this.execute(params, task, callbacks)
		} catch (error) {
			executeError = error instanceof Error ? error : new Error(String(error))
			throw executeError
		} finally {
			// Reset partial state after execution to avoid leakage between tool runs.
			this.resetPartialState()

			// Record trace event for non-SAFE tools in governed mode.
			// SAFE_TOOLS are excluded from trace to keep it focused on destructive actions.
			if (!SAFE_TOOLS.has(this.name) && task.activeIntentId && isGovernedWorkspace(task.cwd)) {
				const traceEvent: IntentTraceEvent = {
					toolName: this.name,
					summary: executeError
						? `${this.name} failed: ${executeError.message.slice(0, 80)}`
						: `${this.name} executed successfully`,
					outcome: executeError ? "error" : "success",
					timestamp: new Date().toISOString(),
					intentId: task.activeIntentId,
				}
				task.intentTraceLog.push(traceEvent)
			}
		}
	}
}
