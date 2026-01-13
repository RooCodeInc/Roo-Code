/**
 * Plan Translator
 *
 * Translates between Roo CLI TodoItem format and ACP PlanEntry format.
 * This enables the agent to communicate execution plans to ACP clients
 * when using the update_todo_list tool.
 *
 * @see https://agentclientprotocol.com/protocol/agent-plan
 */

import type { TodoItem } from "@roo-code/types"

// =============================================================================
// Types
// =============================================================================

/**
 * Priority levels for plan entries.
 * Maps to ACP PlanEntryPriority.
 */
export type PlanEntryPriority = "high" | "medium" | "low"

/**
 * Status levels for plan entries.
 * Maps to ACP PlanEntryStatus (same as TodoStatus).
 */
export type PlanEntryStatus = "pending" | "in_progress" | "completed"

/**
 * A single entry in the execution plan.
 * Represents a task or goal that the agent intends to accomplish.
 */
export interface PlanEntry {
	/** Human-readable description of what this task aims to accomplish */
	content: string
	/** The relative importance of this task */
	priority: PlanEntryPriority
	/** Current execution status of this task */
	status: PlanEntryStatus
}

/**
 * ACP Plan session update payload.
 */
export interface PlanUpdate {
	sessionUpdate: "plan"
	entries: PlanEntry[]
}

/**
 * Configuration for priority assignment when converting todos to plan entries.
 */
export interface PriorityConfig {
	/** Default priority for all items (default: "medium") */
	defaultPriority: PlanEntryPriority
	/** Assign high priority to in_progress items (default: true) */
	prioritizeInProgress: boolean
	/** Assign higher priority to earlier items in the list (default: false) */
	prioritizeByOrder: boolean
	/** Number of top items to mark as high priority when prioritizeByOrder is true */
	highPriorityCount: number
}

/**
 * Default priority configuration.
 */
const DEFAULT_PRIORITY_CONFIG: PriorityConfig = {
	defaultPriority: "medium",
	prioritizeInProgress: true,
	prioritizeByOrder: false,
	highPriorityCount: 3,
}

// =============================================================================
// Priority Determination
// =============================================================================

/**
 * Determine the priority of a todo item based on configuration.
 *
 * @param item - The todo item
 * @param index - Position in the list (0-based)
 * @param total - Total number of items
 * @param config - Priority configuration
 * @returns The determined priority
 */
function determinePriority(item: TodoItem, index: number, total: number, config: PriorityConfig): PlanEntryPriority {
	// In-progress items get high priority
	if (config.prioritizeInProgress && item.status === "in_progress") {
		return "high"
	}

	// Order-based priority
	if (config.prioritizeByOrder && total > 0) {
		if (index < config.highPriorityCount) {
			return "high"
		}
		if (index < Math.floor(total / 2)) {
			return "medium"
		}
		return "low"
	}

	return config.defaultPriority
}

// =============================================================================
// Translation Functions
// =============================================================================

/**
 * Translate a single TodoItem to a PlanEntry.
 *
 * @param item - The todo item to translate
 * @param index - Position in the list (0-based)
 * @param total - Total number of items
 * @param config - Priority configuration
 * @returns The translated plan entry
 */
export function todoItemToPlanEntry(
	item: TodoItem,
	index: number = 0,
	total: number = 1,
	config: PriorityConfig = DEFAULT_PRIORITY_CONFIG,
): PlanEntry {
	return {
		content: item.content,
		priority: determinePriority(item, index, total, config),
		status: item.status,
	}
}

/**
 * Translate an array of TodoItems to a PlanUpdate.
 *
 * @param todos - Array of todo items
 * @param config - Optional partial priority configuration
 * @returns The plan update payload
 */
export function todoListToPlanUpdate(todos: TodoItem[], config?: Partial<PriorityConfig>): PlanUpdate {
	const mergedConfig: PriorityConfig = { ...DEFAULT_PRIORITY_CONFIG, ...config }
	const total = todos.length

	return {
		sessionUpdate: "plan",
		entries: todos.map((item, index) => todoItemToPlanEntry(item, index, total, mergedConfig)),
	}
}

// =============================================================================
// Message Detection and Parsing
// =============================================================================

/**
 * Parsed todo list message structure.
 */
interface ParsedTodoMessage {
	tool: "updateTodoList"
	todos: TodoItem[]
}

/**
 * Type guard to check if parsed JSON is a valid todo list message.
 */
function isParsedTodoMessage(obj: unknown): obj is ParsedTodoMessage {
	if (!obj || typeof obj !== "object") return false
	const record = obj as Record<string, unknown>
	return record.tool === "updateTodoList" && Array.isArray(record.todos)
}

/**
 * Parse todo list from a tool message text.
 *
 * @param text - The message text (JSON string)
 * @returns Array of TodoItems or null if not a valid todo message
 */
export function parseTodoListFromMessage(text: string): TodoItem[] | null {
	try {
		const parsed: unknown = JSON.parse(text)
		if (isParsedTodoMessage(parsed)) {
			return parsed.todos
		}
	} catch {
		// Not valid JSON - ignore
	}
	return null
}

/**
 * Minimal message interface for detection.
 */
interface MessageLike {
	type: string
	ask?: string
	say?: string
	text?: string
}

/**
 * Check if a message contains a todo list update.
 *
 * Detects two types of messages:
 * 1. Tool ask messages with updateTodoList
 * 2. user_edit_todos say messages (when user edits the todo list)
 *
 * @param message - The message to check
 * @returns true if message contains a todo list update
 */
export function isTodoListMessage(message: MessageLike): boolean {
	// Check for tool ask message with updateTodoList
	if (message.type === "ask" && message.ask === "tool" && message.text) {
		const todos = parseTodoListFromMessage(message.text)
		return todos !== null
	}

	// Check for user_edit_todos say message
	if (message.type === "say" && message.say === "user_edit_todos" && message.text) {
		const todos = parseTodoListFromMessage(message.text)
		return todos !== null
	}

	return false
}

/**
 * Extract todo list from a message if present.
 *
 * @param message - The message to extract from
 * @returns Array of TodoItems or null if not a todo message
 */
export function extractTodoListFromMessage(message: MessageLike): TodoItem[] | null {
	if (!message.text) return null

	if (message.type === "ask" && message.ask === "tool") {
		return parseTodoListFromMessage(message.text)
	}

	if (message.type === "say" && message.say === "user_edit_todos") {
		return parseTodoListFromMessage(message.text)
	}

	return null
}

/**
 * Create a plan update from a message if it contains a todo list.
 *
 * Convenience function that combines detection, extraction, and translation.
 *
 * @param message - The message to process
 * @param config - Optional priority configuration
 * @returns PlanUpdate or null if message doesn't contain todos
 */
export function createPlanUpdateFromMessage(message: MessageLike, config?: Partial<PriorityConfig>): PlanUpdate | null {
	const todos = extractTodoListFromMessage(message)
	if (!todos || todos.length === 0) {
		return null
	}
	return todoListToPlanUpdate(todos, config)
}
