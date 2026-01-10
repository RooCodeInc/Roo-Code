import { Anthropic } from "@anthropic-ai/sdk"
import { TodoItem } from "@roo-code/types"
import { parseMarkdownChecklist } from "../tools/UpdateTodoListTool"

import { type ApiMessage } from "./apiMessages"

/**
 * Represents a pending subtask derived from the API conversation history.
 */
export interface PendingSubtask {
	toolCallId: string
	message: string
	mode: string
	todoItems: TodoItem[]
}

/**
 * Helper to extract pending subtasks from assistant content and existing tool results.
 * Used internally by both getPendingSubtasks and getPendingSubtasksFromContent.
 */
function extractPendingSubtasks(
	assistantContent: Array<Anthropic.Messages.ContentBlockParam | Anthropic.ToolResultBlockParam>,
	completedToolIds: Set<string>,
): PendingSubtask[] {
	const newTaskToolUses = assistantContent.filter(
		(block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use" && block.name === "new_task",
	)

	return newTaskToolUses
		.filter((toolUse) => !completedToolIds.has(toolUse.id))
		.map((toolUse) => {
			const input = toolUse.input as Record<string, unknown>
			let todoItems: TodoItem[] = []

			if (input.todos && typeof input.todos === "string") {
				try {
					todoItems = parseMarkdownChecklist(input.todos)
				} catch {
					todoItems = []
				}
			}

			return {
				toolCallId: toolUse.id,
				message: (input.message as string) || "",
				mode: (input.mode as string) || "",
				todoItems,
			}
		})
}

/**
 * Gets pending new_task tool calls that don't have tool_results yet.
 * This derives the pending subtasks by comparing tool_use blocks (with name: "new_task")
 * in the last assistant message against tool_result blocks in the last user message.
 *
 * @param apiMessages - The API conversation history
 * @returns Array of pending subtasks with their parameters
 */
export function getPendingSubtasks(apiMessages: ApiMessage[]): PendingSubtask[] {
	if (apiMessages.length < 2) return []

	const lastAssistant = apiMessages[apiMessages.length - 2]
	const lastUser = apiMessages[apiMessages.length - 1]

	if (lastAssistant?.role !== "assistant" || lastUser?.role !== "user") return []

	const assistantContent = Array.isArray(lastAssistant.content) ? lastAssistant.content : []
	const userContent = Array.isArray(lastUser.content) ? lastUser.content : []
	const completedIds = new Set(
		userContent
			.filter((block): block is Anthropic.ToolResultBlockParam => block.type === "tool_result")
			.map((block) => block.tool_use_id),
	)

	return extractPendingSubtasks(assistantContent, completedIds)
}

/**
 * Gets pending new_task tool calls by examining both API history and in-memory state.
 * This handles two scenarios:
 *
 * 1. DURING streaming: user message not in history yet, tool_results in pendingToolResults
 *    - apiMessages ends with assistant message
 *    - pendingToolResults has executed tool results
 *
 * 2. AFTER delegation resume: user message already in history with tool_results
 *    - apiMessages ends with user message (containing tool_result)
 *    - pendingToolResults is empty
 *
 * @param apiMessages - The API conversation history
 * @param pendingToolResults - In-memory tool_result blocks not yet saved to history
 * @returns Array of pending subtasks with their parameters
 */
export function getPendingSubtasksFromContent(
	apiMessages: ApiMessage[],
	pendingToolResults: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolResultBlockParam>,
): PendingSubtask[] {
	if (apiMessages.length < 1) return []

	// Find the last assistant message
	let lastAssistant: ApiMessage | undefined
	let lastAssistantIndex = -1
	for (let i = apiMessages.length - 1; i >= 0; i--) {
		if (apiMessages[i].role === "assistant") {
			lastAssistant = apiMessages[i]
			lastAssistantIndex = i
			break
		}
	}

	if (!lastAssistant) return []

	const assistantContent = Array.isArray(lastAssistant.content) ? lastAssistant.content : []

	// Collect completed IDs from multiple sources:
	// 1. In-memory pendingToolResults (during streaming)
	// 2. Any user message that comes AFTER the last assistant message (after delegation resume)
	const completedIds = new Set<string>()

	// Source 1: In-memory tool results
	for (const block of pendingToolResults) {
		if (block.type === "tool_result") {
			completedIds.add(block.tool_use_id)
		}
	}

	// Source 2: User messages after the last assistant message
	for (let i = lastAssistantIndex + 1; i < apiMessages.length; i++) {
		const msg = apiMessages[i]
		if (msg.role === "user" && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "tool_result") {
					completedIds.add((block as Anthropic.ToolResultBlockParam).tool_use_id)
				}
			}
		}
	}

	return extractPendingSubtasks(assistantContent, completedIds)
}

/**
 * Gets the tool_use ID of the first pending new_task subtask.
 * Used to determine which subtask is currently executing.
 *
 * @param apiMessages - The API conversation history
 * @returns The tool_use ID of the first pending subtask, or undefined if none
 */
export function getFirstPendingSubtaskId(apiMessages: ApiMessage[]): string | undefined {
	const pending = getPendingSubtasks(apiMessages)
	return pending.length > 0 ? pending[0].toolCallId : undefined
}

/**
 * Checks if there are any pending new_task subtasks.
 *
 * @param apiMessages - The API conversation history
 * @returns True if there are pending subtasks
 */
export function hasPendingSubtasksInHistory(apiMessages: ApiMessage[]): boolean {
	return getPendingSubtasks(apiMessages).length > 0
}

/**
 * Appends a tool_result to the last user message in the API conversation history.
 * If the last message is not a user message, creates a new user message.
 *
 * This function modifies the input array in place and returns it.
 *
 * @param apiMessages - The API conversation history (modified in place)
 * @param toolUseId - The tool_use_id to reference in the tool_result
 * @param result - The result content for the tool_result
 * @returns The modified apiMessages array
 */
export function appendToolResult(apiMessages: ApiMessage[], toolUseId: string, result: string): ApiMessage[] {
	if (apiMessages.length === 0) {
		apiMessages.push({
			role: "user",
			content: [{ type: "tool_result", tool_use_id: toolUseId, content: result }],
			ts: Date.now(),
		})
		return apiMessages
	}

	const lastMsg = apiMessages[apiMessages.length - 1]

	if (lastMsg?.role !== "user") {
		apiMessages.push({
			role: "user",
			content: [{ type: "tool_result", tool_use_id: toolUseId, content: result }],
			ts: Date.now(),
		})
	} else {
		if (!Array.isArray(lastMsg.content)) {
			lastMsg.content = lastMsg.content ? [{ type: "text", text: lastMsg.content }] : []
		}
		;(lastMsg.content as Anthropic.ToolResultBlockParam[]).push({
			type: "tool_result",
			tool_use_id: toolUseId,
			content: result,
		})
	}

	return apiMessages
}

/**
 * Gets tool_result blocks from the last user message that are NOT for new_task tool calls.
 * These are "other" tool results (like update_todo_list) that were called in the same turn.
 *
 * @param apiMessages - The API conversation history
 * @returns Array of tool_result blocks for non-new_task tools
 */
export function getOtherToolResults(apiMessages: ApiMessage[]): Anthropic.ToolResultBlockParam[] {
	if (apiMessages.length < 2) return []

	const lastAssistant = apiMessages[apiMessages.length - 2]
	const lastUser = apiMessages[apiMessages.length - 1]

	if (lastAssistant?.role !== "assistant" || lastUser?.role !== "user") return []

	const assistantContent = Array.isArray(lastAssistant.content) ? lastAssistant.content : []
	const newTaskToolIds = new Set(
		assistantContent
			.filter(
				(block): block is Anthropic.Messages.ToolUseBlock =>
					block.type === "tool_use" && block.name === "new_task",
			)
			.map((block) => block.id),
	)

	const userContent = Array.isArray(lastUser.content) ? lastUser.content : []
	return userContent.filter(
		(block): block is Anthropic.ToolResultBlockParam =>
			block.type === "tool_result" && !newTaskToolIds.has(block.tool_use_id),
	)
}

/**
 * Checks if all new_task tool calls have corresponding tool_results.
 * This indicates all subtasks have completed.
 *
 * @param apiMessages - The API conversation history
 * @returns True if all new_task tool calls have tool_results
 */
export function areAllSubtasksComplete(apiMessages: ApiMessage[]): boolean {
	return getPendingSubtasks(apiMessages).length === 0
}

/**
 * Gets the count of completed new_task subtasks (those with tool_results).
 *
 * @param apiMessages - The API conversation history
 * @returns Number of completed subtasks
 */
export function getCompletedSubtaskCount(apiMessages: ApiMessage[]): number {
	if (apiMessages.length < 2) return 0

	const lastAssistant = apiMessages[apiMessages.length - 2]
	const lastUser = apiMessages[apiMessages.length - 1]

	if (lastAssistant?.role !== "assistant" || lastUser?.role !== "user") return 0

	const assistantContent = Array.isArray(lastAssistant.content) ? lastAssistant.content : []
	const newTaskToolIds = new Set(
		assistantContent
			.filter(
				(block): block is Anthropic.Messages.ToolUseBlock =>
					block.type === "tool_use" && block.name === "new_task",
			)
			.map((block) => block.id),
	)

	const userContent = Array.isArray(lastUser.content) ? lastUser.content : []
	return userContent.filter(
		(block): block is Anthropic.ToolResultBlockParam =>
			block.type === "tool_result" && newTaskToolIds.has(block.tool_use_id),
	).length
}

/**
 * Gets the total count of new_task tool calls in the last assistant message.
 *
 * @param apiMessages - The API conversation history
 * @returns Total number of new_task tool calls
 */
export function getTotalSubtaskCount(apiMessages: ApiMessage[]): number {
	if (apiMessages.length < 1) return 0

	let lastAssistant: ApiMessage | undefined
	for (let i = apiMessages.length - 1; i >= 0; i--) {
		if (apiMessages[i].role === "assistant") {
			lastAssistant = apiMessages[i]
			break
		}
	}

	if (!lastAssistant) return 0

	const assistantContent = Array.isArray(lastAssistant.content) ? lastAssistant.content : []
	return assistantContent.filter(
		(block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use" && block.name === "new_task",
	).length
}
