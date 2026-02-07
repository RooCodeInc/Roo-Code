/**
 * Pure business logic for extension message processing.
 *
 * These functions have NO SolidJS dependencies and NO side effects.
 * They compute state transitions and return result objects that callers apply
 * via their own state management (SolidJS `setStore()` in production,
 * direct assignment in tests).
 *
 * @module extension-logic
 */

import type { ClineAsk, ClineSay, TodoItem } from "@roo-code/types"

import type { TUIMessage, PendingAsk, ToolData } from "../types.js"
import {
	extractToolData,
	formatToolOutput,
	formatToolAskMessage,
	parseTodosFromToolInfo,
} from "../../lib/utils/tools.js"
import { getGlobalCommand } from "../../lib/utils/commands.js"

// ================================================================
// Context types (read-only snapshots passed into pure functions)
// ================================================================

/** Read-only snapshot of tracking state needed by message processors. */
export interface MessageContext {
	seenMessageIds: ReadonlySet<string>
	firstTextMessageSkipped: boolean
	isResumingTask: boolean
	pendingCommandRef: string | null
	nonInteractive: boolean
	currentTodos: readonly TodoItem[]
}

/** Minimal store state needed by computeSubmitAction. */
export interface SubmitContext {
	pendingAsk: PendingAsk | null
	hasStartedTask: boolean
	isComplete: boolean
}

// ================================================================
// Result types (returned by pure functions)
// ================================================================

/** Result from {@link processSayMessage}. */
export interface SayMessageResult {
	/** Message to add to the store, or null if the message should be skipped. */
	message: TUIMessage | null
	/** If non-null, add this ID to seenMessageIds. */
	trackId: string | null
	/** If true, caller should set firstTextMessageSkipped = true. */
	setFirstTextSkipped?: boolean
	/** If true, caller should set pendingCommandRef = null. */
	clearPendingCommand?: boolean
}

/** Result from {@link processAskMessage}. */
export interface AskMessageResult {
	/** Message to add to the store, or null if no message should be added. */
	message: TUIMessage | null
	/** If non-null, set pendingAsk to this value. Null means no change. */
	pendingAsk: PendingAsk | null
	/** If non-null, add this ID to seenMessageIds. */
	trackId: string | null
	/** Partial store field updates to apply. Only defined keys should be set. */
	storeUpdates: {
		isLoading?: boolean
		hasStartedTask?: boolean
		isResumingTask?: boolean
		isComplete?: boolean
	}
	/** If defined, set pendingCommandRef to this value. Undefined means no change. */
	pendingCommand?: string
	/** If defined, apply these todo updates to the store. */
	todoUpdate?: { currentTodos: TodoItem[]; previousTodos: TodoItem[] }
}

/** Discriminated union describing what handleSubmit should do. */
export type SubmitAction =
	| { kind: "none" }
	| { kind: "clearTask" }
	| { kind: "respondToAsk"; userMessage: TUIMessage; text: string }
	| { kind: "startNewTask"; userMessage: TUIMessage; text: string }
	| { kind: "continueTask"; userMessage: TUIMessage; text: string }

// ================================================================
// Pure functions
// ================================================================

/** Build a user message with the given ID and content. */
export function buildUserMessage(id: string, content: string): TUIMessage {
	return { id, role: "user", content }
}

/**
 * Process a "say" type ClineMessage and compute the resulting state change.
 *
 * The caller is responsible for:
 * 1. Adding `result.trackId` to seenMessageIds (if non-null)
 * 2. Setting firstTextMessageSkipped if `result.setFirstTextSkipped` is true
 * 3. Clearing pendingCommandRef if `result.clearPendingCommand` is true
 * 4. Calling addMessage with `result.message` (if non-null)
 */
export function processSayMessage(
	ctx: MessageContext,
	ts: number,
	say: ClineSay,
	text: string,
	partial: boolean,
): SayMessageResult {
	const messageId = ts.toString()
	const result: SayMessageResult = {
		message: null,
		trackId: null,
	}

	// Skip filtered message types
	if (say === "checkpoint_saved" || say === "api_req_started" || say === "user_feedback") {
		if (say === "user_feedback") {
			result.trackId = messageId
		}
		return result
	}

	// Skip first text message (unless resuming a task)
	if (say === "text" && !ctx.firstTextMessageSkipped && !ctx.isResumingTask) {
		result.trackId = messageId
		result.setFirstTextSkipped = true
		return result
	}

	// Dedup: skip already-seen non-partial messages
	if (ctx.seenMessageIds.has(messageId) && !partial) {
		return result
	}

	// Build the message
	let role: TUIMessage["role"] = "assistant"
	let toolName: string | undefined
	let toolDisplayName: string | undefined
	let toolDisplayOutput: string | undefined
	let toolData: ToolData | undefined

	if (say === "command_output") {
		role = "tool"
		toolName = "execute_command"
		toolDisplayName = "bash"
		toolDisplayOutput = text
		const trackedCommand = ctx.pendingCommandRef
		toolData = { tool: "execute_command", command: trackedCommand || undefined, output: text }
		result.clearPendingCommand = true
	} else if (say === "reasoning") {
		role = "thinking"
	}

	result.trackId = messageId
	result.message = {
		id: messageId,
		role,
		content: text || "",
		toolName,
		toolDisplayName,
		toolDisplayOutput,
		partial,
		originalType: say,
		toolData,
	}

	return result
}

/**
 * Process an "ask" type ClineMessage and compute the resulting state change.
 *
 * The caller is responsible for:
 * 1. Adding `result.trackId` to seenMessageIds (if non-null)
 * 2. Setting pendingCommandRef if `result.pendingCommand` is defined
 * 3. Applying `result.storeUpdates` to the store
 * 4. Applying `result.todoUpdate` to the store (if defined)
 * 5. Setting pendingAsk if `result.pendingAsk` is non-null
 * 6. Calling addMessage with `result.message` (if non-null)
 */
export function processAskMessage(
	ctx: MessageContext,
	ts: number,
	ask: ClineAsk,
	text: string,
	partial: boolean,
): AskMessageResult {
	const messageId = ts.toString()
	const result: AskMessageResult = {
		message: null,
		pendingAsk: null,
		trackId: null,
		storeUpdates: {},
	}

	if (partial) return result
	if (ctx.seenMessageIds.has(messageId)) return result

	if (ask === "command_output") {
		result.trackId = messageId
		return result
	}

	if (ask === "resume_task" || ask === "resume_completed_task") {
		result.trackId = messageId
		result.storeUpdates = {
			isLoading: false,
			hasStartedTask: true,
			isResumingTask: false,
		}
		return result
	}

	if (ask === "completion_result") {
		result.trackId = messageId
		result.storeUpdates = { isComplete: true, isLoading: false }

		try {
			const completionInfo = JSON.parse(text) as Record<string, unknown>
			const toolDataVal: ToolData = {
				tool: "attempt_completion",
				result: completionInfo.result as string | undefined,
				content: completionInfo.result as string | undefined,
			}

			result.message = {
				id: messageId,
				role: "tool",
				content: text,
				toolName: "attempt_completion",
				toolDisplayName: "Task Complete",
				toolDisplayOutput: formatToolOutput({ tool: "attempt_completion", ...completionInfo }),
				originalType: ask,
				toolData: toolDataVal,
			}
		} catch {
			result.message = {
				id: messageId,
				role: "tool",
				content: text || "Task completed",
				toolName: "attempt_completion",
				toolDisplayName: "Task Complete",
				toolDisplayOutput: "✅ Task completed",
				originalType: ask,
				toolData: { tool: "attempt_completion", content: text },
			}
		}
		return result
	}

	if (ask === "command") {
		result.pendingCommand = text
	}

	// Non-interactive mode: auto-process asks (except followup)
	if (ctx.nonInteractive && ask !== "followup") {
		result.trackId = messageId

		if (ask === "tool") {
			let localToolName: string | undefined
			let localToolDisplayName: string | undefined
			let localToolDisplayOutput: string | undefined
			let formattedContent = text || ""
			let localToolData: ToolData | undefined
			let todos: TodoItem[] | undefined
			let previousTodos: TodoItem[] | undefined

			try {
				const toolInfo = JSON.parse(text) as Record<string, unknown>
				localToolName = toolInfo.tool as string
				localToolDisplayName = toolInfo.tool as string
				localToolDisplayOutput = formatToolOutput(toolInfo)
				formattedContent = formatToolAskMessage(toolInfo)
				localToolData = extractToolData(toolInfo)

				// Handle todo updates (fixes missing todo handling bug)
				if (localToolName === "update_todo_list" || localToolName === "updateTodoList") {
					const parsedTodos = parseTodosFromToolInfo(toolInfo)
					if (parsedTodos && parsedTodos.length > 0) {
						todos = parsedTodos
						previousTodos = [...ctx.currentTodos]
						result.todoUpdate = {
							currentTodos: parsedTodos,
							previousTodos: [...ctx.currentTodos],
						}
					}
				}
			} catch {
				// Use raw text
			}

			result.message = {
				id: messageId,
				role: "tool",
				content: formattedContent,
				toolName: localToolName,
				toolDisplayName: localToolDisplayName,
				toolDisplayOutput: localToolDisplayOutput,
				originalType: ask,
				toolData: localToolData,
				todos,
				previousTodos,
			}
		} else {
			result.message = {
				id: messageId,
				role: "assistant",
				content: text || "",
				originalType: ask,
			}
		}
		return result
	}

	// Interactive mode: set up pendingAsk
	let suggestions: Array<{ answer: string; mode?: string | null }> | undefined
	let questionText = text

	if (ask === "followup") {
		try {
			const data = JSON.parse(text)
			questionText = data.question || text
			suggestions = Array.isArray(data.suggest) ? data.suggest : undefined
		} catch {
			// Use raw text
		}
	} else if (ask === "tool") {
		try {
			const toolInfo = JSON.parse(text) as Record<string, unknown>
			questionText = formatToolAskMessage(toolInfo)
		} catch {
			// Use raw text
		}
	}

	result.trackId = messageId
	result.pendingAsk = {
		id: messageId,
		type: ask,
		content: questionText,
		suggestions,
	}

	return result
}

/**
 * Compute what action a submit should take based on current state.
 *
 * The caller is responsible for:
 * - "none": do nothing
 * - "clearTask": reset all store state, clear seenMessageIds, send clearTask/requestCommands/requestModes
 * - "respondToAsk": add userMessage, send askResponse, clear pendingAsk, set isLoading
 * - "startNewTask": set hasStartedTask/isLoading, add userMessage, call runTask
 * - "continueTask": clear isComplete if needed, set isLoading, add userMessage, send askResponse
 */
export function computeSubmitAction(ctx: SubmitContext, text: string, generateId: () => string): SubmitAction {
	if (!text.trim()) return { kind: "none" }

	const trimmedText = text.trim()
	if (trimmedText === "__CUSTOM__") return { kind: "none" }

	// Check for CLI global action commands
	if (trimmedText.startsWith("/")) {
		const commandMatch = trimmedText.match(/^\/(\w+)(?:\s|$)/)
		if (commandMatch && commandMatch[1]) {
			const globalCommand = getGlobalCommand(commandMatch[1])
			if (globalCommand?.action === "clearTask") {
				return { kind: "clearTask" }
			}
		}
	}

	const userMessage = buildUserMessage(generateId(), trimmedText)

	if (ctx.pendingAsk) {
		return { kind: "respondToAsk", userMessage, text: trimmedText }
	}

	if (!ctx.hasStartedTask) {
		return { kind: "startNewTask", userMessage, text: trimmedText }
	}

	return { kind: "continueTask", userMessage, text: trimmedText }
}
