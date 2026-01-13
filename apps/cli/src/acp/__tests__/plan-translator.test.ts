import type { TodoItem } from "@roo-code/types"

import {
	todoItemToPlanEntry,
	todoListToPlanUpdate,
	parseTodoListFromMessage,
	isTodoListMessage,
	extractTodoListFromMessage,
	createPlanUpdateFromMessage,
	type PriorityConfig,
} from "../translator/plan-translator.js"

describe("Plan Translator", () => {
	// ===========================================================================
	// Test Data
	// ===========================================================================

	const createTodoItem = (
		content: string,
		status: "pending" | "in_progress" | "completed",
		id?: string,
	): TodoItem => ({
		id: id ?? `todo-${Date.now()}`,
		content,
		status,
	})

	// ===========================================================================
	// todoItemToPlanEntry
	// ===========================================================================

	describe("todoItemToPlanEntry", () => {
		it("converts a todo item to a plan entry with default config", () => {
			const todo = createTodoItem("Implement feature X", "pending")
			const entry = todoItemToPlanEntry(todo)

			expect(entry).toEqual({
				content: "Implement feature X",
				priority: "medium",
				status: "pending",
			})
		})

		it("assigns high priority to in_progress items by default", () => {
			const todo = createTodoItem("Working on feature", "in_progress")
			const entry = todoItemToPlanEntry(todo)

			expect(entry.priority).toBe("high")
			expect(entry.status).toBe("in_progress")
		})

		it("preserves completed status", () => {
			const todo = createTodoItem("Done task", "completed")
			const entry = todoItemToPlanEntry(todo)

			expect(entry.status).toBe("completed")
		})

		it("respects custom priority config", () => {
			const todo = createTodoItem("Low priority task", "pending")
			const config: PriorityConfig = {
				defaultPriority: "low",
				prioritizeInProgress: false,
				prioritizeByOrder: false,
				highPriorityCount: 3,
			}
			const entry = todoItemToPlanEntry(todo, 0, 1, config)

			expect(entry.priority).toBe("low")
		})

		it("uses order-based priority when enabled", () => {
			const config: PriorityConfig = {
				defaultPriority: "medium",
				prioritizeInProgress: false,
				prioritizeByOrder: true,
				highPriorityCount: 2,
			}

			// First 2 items should be high priority
			const first = todoItemToPlanEntry(createTodoItem("First", "pending"), 0, 6, config)
			const second = todoItemToPlanEntry(createTodoItem("Second", "pending"), 1, 6, config)
			expect(first.priority).toBe("high")
			expect(second.priority).toBe("high")

			// Items 3-4 (first half) should be medium
			const third = todoItemToPlanEntry(createTodoItem("Third", "pending"), 2, 6, config)
			expect(third.priority).toBe("medium")

			// Items past the halfway point should be low
			const fifth = todoItemToPlanEntry(createTodoItem("Fifth", "pending"), 4, 6, config)
			expect(fifth.priority).toBe("low")
		})

		it("prioritizes in_progress over order when both enabled", () => {
			const config: PriorityConfig = {
				defaultPriority: "low",
				prioritizeInProgress: true,
				prioritizeByOrder: true,
				highPriorityCount: 1,
			}

			// Even at the end of the list, in_progress should be high
			const inProgress = todoItemToPlanEntry(createTodoItem("In progress", "in_progress"), 5, 6, config)
			expect(inProgress.priority).toBe("high")
		})
	})

	// ===========================================================================
	// todoListToPlanUpdate
	// ===========================================================================

	describe("todoListToPlanUpdate", () => {
		it("converts an empty array to a plan with no entries", () => {
			const update = todoListToPlanUpdate([])

			expect(update).toEqual({
				sessionUpdate: "plan",
				entries: [],
			})
		})

		it("converts a list of todos to a plan update", () => {
			const todos: TodoItem[] = [
				createTodoItem("Task 1", "completed"),
				createTodoItem("Task 2", "in_progress"),
				createTodoItem("Task 3", "pending"),
			]
			const update = todoListToPlanUpdate(todos)

			expect(update.sessionUpdate).toBe("plan")
			expect(update.entries).toHaveLength(3)
			expect(update.entries[0]).toEqual({
				content: "Task 1",
				priority: "medium",
				status: "completed",
			})
			expect(update.entries[1]).toEqual({
				content: "Task 2",
				priority: "high", // in_progress gets high priority
				status: "in_progress",
			})
			expect(update.entries[2]).toEqual({
				content: "Task 3",
				priority: "medium",
				status: "pending",
			})
		})

		it("accepts partial config overrides", () => {
			const todos = [createTodoItem("Task", "pending")]
			const update = todoListToPlanUpdate(todos, { defaultPriority: "high" })

			expect(update.entries[0]?.priority).toBe("high")
		})
	})

	// ===========================================================================
	// parseTodoListFromMessage
	// ===========================================================================

	describe("parseTodoListFromMessage", () => {
		it("parses valid todo list JSON", () => {
			const text = JSON.stringify({
				tool: "updateTodoList",
				todos: [
					{ id: "1", content: "Task 1", status: "pending" },
					{ id: "2", content: "Task 2", status: "completed" },
				],
			})

			const result = parseTodoListFromMessage(text)

			expect(result).toEqual([
				{ id: "1", content: "Task 1", status: "pending" },
				{ id: "2", content: "Task 2", status: "completed" },
			])
		})

		it("returns null for invalid JSON", () => {
			expect(parseTodoListFromMessage("not json")).toBeNull()
			expect(parseTodoListFromMessage("{invalid}")).toBeNull()
		})

		it("returns null for JSON without updateTodoList tool", () => {
			expect(parseTodoListFromMessage(JSON.stringify({ tool: "other" }))).toBeNull()
			expect(parseTodoListFromMessage(JSON.stringify({ todos: [] }))).toBeNull()
		})

		it("returns null for JSON with non-array todos", () => {
			expect(parseTodoListFromMessage(JSON.stringify({ tool: "updateTodoList", todos: "not array" }))).toBeNull()
		})
	})

	// ===========================================================================
	// isTodoListMessage
	// ===========================================================================

	describe("isTodoListMessage", () => {
		it("detects tool ask messages with updateTodoList", () => {
			const message = {
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "updateTodoList", todos: [] }),
			}

			expect(isTodoListMessage(message)).toBe(true)
		})

		it("detects user_edit_todos say messages", () => {
			const message = {
				type: "say",
				say: "user_edit_todos",
				text: JSON.stringify({ tool: "updateTodoList", todos: [] }),
			}

			expect(isTodoListMessage(message)).toBe(true)
		})

		it("returns false for other ask types", () => {
			const message = {
				type: "ask",
				ask: "command",
				text: JSON.stringify({ tool: "updateTodoList", todos: [] }),
			}

			expect(isTodoListMessage(message)).toBe(false)
		})

		it("returns false for other say types", () => {
			const message = {
				type: "say",
				say: "text",
				text: JSON.stringify({ tool: "updateTodoList", todos: [] }),
			}

			expect(isTodoListMessage(message)).toBe(false)
		})

		it("returns false for messages without text", () => {
			const message = {
				type: "ask",
				ask: "tool",
			}

			expect(isTodoListMessage(message)).toBe(false)
		})

		it("returns false for tool messages with other tools", () => {
			const message = {
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "read_file", path: "/some/path" }),
			}

			expect(isTodoListMessage(message)).toBe(false)
		})
	})

	// ===========================================================================
	// extractTodoListFromMessage
	// ===========================================================================

	describe("extractTodoListFromMessage", () => {
		it("extracts todos from tool ask message", () => {
			const todos = [{ id: "1", content: "Task", status: "pending" }]
			const message = {
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "updateTodoList", todos }),
			}

			expect(extractTodoListFromMessage(message)).toEqual(todos)
		})

		it("extracts todos from user_edit_todos say message", () => {
			const todos = [{ id: "1", content: "Task", status: "completed" }]
			const message = {
				type: "say",
				say: "user_edit_todos",
				text: JSON.stringify({ tool: "updateTodoList", todos }),
			}

			expect(extractTodoListFromMessage(message)).toEqual(todos)
		})

		it("returns null for non-todo messages", () => {
			expect(extractTodoListFromMessage({ type: "say", say: "text", text: "Hello" })).toBeNull()
		})

		it("returns null for messages without text", () => {
			expect(extractTodoListFromMessage({ type: "ask", ask: "tool" })).toBeNull()
		})
	})

	// ===========================================================================
	// createPlanUpdateFromMessage
	// ===========================================================================

	describe("createPlanUpdateFromMessage", () => {
		it("creates plan update from valid todo message", () => {
			const todos = [
				{ id: "1", content: "First task", status: "in_progress" as const },
				{ id: "2", content: "Second task", status: "pending" as const },
			]
			const message = {
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "updateTodoList", todos }),
			}

			const update = createPlanUpdateFromMessage(message)

			expect(update).not.toBeNull()
			expect(update?.sessionUpdate).toBe("plan")
			expect(update?.entries).toHaveLength(2)
			expect(update?.entries[0]).toEqual({
				content: "First task",
				priority: "high", // in_progress
				status: "in_progress",
			})
		})

		it("returns null for non-todo messages", () => {
			const message = {
				type: "say",
				say: "text",
				text: "Just some text",
			}

			expect(createPlanUpdateFromMessage(message)).toBeNull()
		})

		it("returns null for empty todo list", () => {
			const message = {
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "updateTodoList", todos: [] }),
			}

			expect(createPlanUpdateFromMessage(message)).toBeNull()
		})

		it("accepts custom priority config", () => {
			const todos = [{ id: "1", content: "Task", status: "pending" as const }]
			const message = {
				type: "ask",
				ask: "tool",
				text: JSON.stringify({ tool: "updateTodoList", todos }),
			}

			const update = createPlanUpdateFromMessage(message, { defaultPriority: "low" })

			expect(update?.entries[0]?.priority).toBe("low")
		})
	})

	// ===========================================================================
	// Edge Cases
	// ===========================================================================

	describe("edge cases", () => {
		it("handles todos with special characters in content", () => {
			const todo = createTodoItem('Task with "quotes" and <html>', "pending")
			const entry = todoItemToPlanEntry(todo)

			expect(entry.content).toBe('Task with "quotes" and <html>')
		})

		it("handles todos with unicode content", () => {
			const todo = createTodoItem("Task with emoji 🚀 and unicode ñ", "pending")
			const entry = todoItemToPlanEntry(todo)

			expect(entry.content).toBe("Task with emoji 🚀 and unicode ñ")
		})

		it("handles very long content", () => {
			const longContent = "A".repeat(10000)
			const todo = createTodoItem(longContent, "pending")
			const entry = todoItemToPlanEntry(todo)

			expect(entry.content).toBe(longContent)
		})

		it("handles malformed JSON gracefully", () => {
			const message = {
				type: "ask",
				ask: "tool",
				text: '{"tool": "updateTodoList", "todos": [{"broken',
			}

			expect(isTodoListMessage(message)).toBe(false)
			expect(extractTodoListFromMessage(message)).toBeNull()
			expect(createPlanUpdateFromMessage(message)).toBeNull()
		})
	})
})
