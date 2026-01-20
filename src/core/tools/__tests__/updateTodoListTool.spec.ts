import { describe, it, expect, beforeEach, vi } from "vitest"
import { parseMarkdownChecklist, UpdateTodoListTool, setPendingTodoList } from "../UpdateTodoListTool"
import { TodoItem } from "@roo-code/types"

describe("parseMarkdownChecklist", () => {
	describe("standard checkbox format (without dash prefix)", () => {
		it("should parse pending tasks", () => {
			const md = `[ ] Task 1
[ ] Task 2`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("Task 1")
			expect(result[0].status).toBe("pending")
			expect(result[1].content).toBe("Task 2")
			expect(result[1].status).toBe("pending")
		})

		it("should parse completed tasks with lowercase x", () => {
			const md = `[x] Completed task 1
[x] Completed task 2`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("Completed task 1")
			expect(result[0].status).toBe("completed")
			expect(result[1].content).toBe("Completed task 2")
			expect(result[1].status).toBe("completed")
		})

		it("should parse completed tasks with uppercase X", () => {
			const md = `[X] Completed task 1
[X] Completed task 2`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("Completed task 1")
			expect(result[0].status).toBe("completed")
			expect(result[1].content).toBe("Completed task 2")
			expect(result[1].status).toBe("completed")
		})

		it("should parse in-progress tasks with dash", () => {
			const md = `[-] In progress task 1
[-] In progress task 2`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("In progress task 1")
			expect(result[0].status).toBe("in_progress")
			expect(result[1].content).toBe("In progress task 2")
			expect(result[1].status).toBe("in_progress")
		})

		it("should parse in-progress tasks with tilde", () => {
			const md = `[~] In progress task 1
[~] In progress task 2`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("In progress task 1")
			expect(result[0].status).toBe("in_progress")
			expect(result[1].content).toBe("In progress task 2")
			expect(result[1].status).toBe("in_progress")
		})
	})

	describe("dash-prefixed checkbox format", () => {
		it("should parse pending tasks with dash prefix", () => {
			const md = `- [ ] Task 1
- [ ] Task 2`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("Task 1")
			expect(result[0].status).toBe("pending")
			expect(result[1].content).toBe("Task 2")
			expect(result[1].status).toBe("pending")
		})

		it("should parse completed tasks with dash prefix and lowercase x", () => {
			const md = `- [x] Completed task 1
- [x] Completed task 2`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("Completed task 1")
			expect(result[0].status).toBe("completed")
			expect(result[1].content).toBe("Completed task 2")
			expect(result[1].status).toBe("completed")
		})

		it("should parse completed tasks with dash prefix and uppercase X", () => {
			const md = `- [X] Completed task 1
- [X] Completed task 2`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("Completed task 1")
			expect(result[0].status).toBe("completed")
			expect(result[1].content).toBe("Completed task 2")
			expect(result[1].status).toBe("completed")
		})

		it("should parse in-progress tasks with dash prefix and dash marker", () => {
			const md = `- [-] In progress task 1
- [-] In progress task 2`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("In progress task 1")
			expect(result[0].status).toBe("in_progress")
			expect(result[1].content).toBe("In progress task 2")
			expect(result[1].status).toBe("in_progress")
		})

		it("should parse in-progress tasks with dash prefix and tilde marker", () => {
			const md = `- [~] In progress task 1
- [~] In progress task 2`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("In progress task 1")
			expect(result[0].status).toBe("in_progress")
			expect(result[1].content).toBe("In progress task 2")
			expect(result[1].status).toBe("in_progress")
		})
	})

	describe("mixed formats", () => {
		it("should parse mixed formats correctly", () => {
			const md = `[ ] Task without dash
- [ ] Task with dash
[x] Completed without dash
- [X] Completed with dash
[-] In progress without dash
- [~] In progress with dash`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(6)

			expect(result[0].content).toBe("Task without dash")
			expect(result[0].status).toBe("pending")

			expect(result[1].content).toBe("Task with dash")
			expect(result[1].status).toBe("pending")

			expect(result[2].content).toBe("Completed without dash")
			expect(result[2].status).toBe("completed")

			expect(result[3].content).toBe("Completed with dash")
			expect(result[3].status).toBe("completed")

			expect(result[4].content).toBe("In progress without dash")
			expect(result[4].status).toBe("in_progress")

			expect(result[5].content).toBe("In progress with dash")
			expect(result[5].status).toBe("in_progress")
		})
	})

	describe("edge cases", () => {
		it("should handle empty strings", () => {
			const result = parseMarkdownChecklist("")
			expect(result).toEqual([])
		})

		it("should handle non-string input", () => {
			const result = parseMarkdownChecklist(null as any)
			expect(result).toEqual([])
		})

		it("should handle undefined input", () => {
			const result = parseMarkdownChecklist(undefined as any)
			expect(result).toEqual([])
		})

		it("should ignore non-checklist lines", () => {
			const md = `This is not a checklist
[ ] Valid task
Just some text
- Not a checklist item
- [x] Valid completed task
[not valid] Invalid format`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("Valid task")
			expect(result[0].status).toBe("pending")
			expect(result[1].content).toBe("Valid completed task")
			expect(result[1].status).toBe("completed")
		})

		it("should handle extra spaces", () => {
			const md = `  [ ]   Task with spaces  
-  [ ]  Task with dash and spaces
  [x]  Completed with spaces
-   [X]   Completed with dash and spaces`
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(4)
			expect(result[0].content).toBe("Task with spaces")
			expect(result[1].content).toBe("Task with dash and spaces")
			expect(result[2].content).toBe("Completed with spaces")
			expect(result[3].content).toBe("Completed with dash and spaces")
		})

		it("should handle Windows line endings", () => {
			const md = "[ ] Task 1\r\n- [x] Task 2\r\n[-] Task 3"
			const result = parseMarkdownChecklist(md)
			expect(result).toHaveLength(3)
			expect(result[0].content).toBe("Task 1")
			expect(result[0].status).toBe("pending")
			expect(result[1].content).toBe("Task 2")
			expect(result[1].status).toBe("completed")
			expect(result[2].content).toBe("Task 3")
			expect(result[2].status).toBe("in_progress")
		})
	})

	describe("ID generation", () => {
		it("should generate consistent IDs for the same content and status", () => {
			const md1 = `[ ] Task 1
[x] Task 2`
			const md2 = `[ ] Task 1
[x] Task 2`
			const result1 = parseMarkdownChecklist(md1)
			const result2 = parseMarkdownChecklist(md2)

			expect(result1[0].id).toBe(result2[0].id)
			expect(result1[1].id).toBe(result2[1].id)
		})

		it("should generate different IDs for different content", () => {
			const md = `[ ] Task 1
[ ] Task 2`
			const result = parseMarkdownChecklist(md)
			expect(result[0].id).not.toBe(result[1].id)
		})

		it("should generate different IDs for same content but different status", () => {
			const md = `[ ] Task 1
[x] Task 1`
			const result = parseMarkdownChecklist(md)
			expect(result[0].id).not.toBe(result[1].id)
		})

		it("should generate same IDs regardless of dash prefix", () => {
			const md1 = `[ ] Task 1`
			const md2 = `- [ ] Task 1`
			const result1 = parseMarkdownChecklist(md1)
			const result2 = parseMarkdownChecklist(md2)
			expect(result1[0].id).toBe(result2[0].id)
		})
	})
})

describe("UpdateTodoListTool.execute", () => {
	beforeEach(() => {
		setPendingTodoList([])
	})

	it("should prefer history todos when they contain metadata (subtaskId/tokens/cost)", async () => {
		const md = "[ ] Task 1"

		const previousFromMemory = parseMarkdownChecklist(md)
		const previousFromHistory: TodoItem[] = previousFromMemory.map((t) => ({
			...t,
			subtaskId: "subtask-1",
			tokens: 123,
			cost: 0.01,
		}))

		const task = {
			todoList: previousFromMemory,
			clineMessages: [
				{
					type: "ask",
					ask: "tool",
					text: JSON.stringify({ tool: "updateTodoList", todos: previousFromHistory }),
				},
			],
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			didToolFailInCurrentTurn: false,
			say: vi.fn(),
		} as any

		const tool = new UpdateTodoListTool()
		await tool.execute({ todos: md }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(1)
		expect(task.todoList[0]).toEqual(
			expect.objectContaining({
				content: "Task 1",
				subtaskId: "subtask-1",
				tokens: 123,
				cost: 0.01,
			}),
		)
	})

	it("should treat added/removed as metadata and prefer history todos when present", async () => {
		const md = "[ ] Task 1"

		const previousFromMemory = parseMarkdownChecklist(md)
		const previousFromHistory: TodoItem[] = previousFromMemory.map((t) => ({
			...t,
			added: 10,
			removed: 3,
		}))

		const task = {
			todoList: previousFromMemory,
			clineMessages: [
				{
					type: "ask",
					ask: "tool",
					text: JSON.stringify({ tool: "updateTodoList", todos: previousFromHistory }),
				},
			],
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			didToolFailInCurrentTurn: false,
			say: vi.fn(),
		} as any

		const tool = new UpdateTodoListTool()
		await tool.execute({ todos: md }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(1)
		expect(task.todoList[0]).toEqual(
			expect.objectContaining({
				content: "Task 1",
				added: 10,
				removed: 3,
			}),
		)
	})

	it("should preserve metadata by subtaskId even when content (and derived id) changes", async () => {
		// This test simulates the "user edited todo list" flow. The tool re-applies metadata
		// after approval; subtaskId should be used as the primary match when content/id changes.
		const md = "[ ] Old text"

		const previousFromMemory: TodoItem[] = parseMarkdownChecklist(md).map((t) => ({
			...t,
			subtaskId: "subtask-1",
			tokens: 123,
			cost: 0.01,
			added: 10,
			removed: 3,
		}))

		const task = {
			todoList: previousFromMemory,
			clineMessages: [],
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			didToolFailInCurrentTurn: false,
			say: vi.fn(),
		} as any

		// Simulate user-edited todo list with updated content and a different id, but the same subtaskId.
		const userEditedTodos: TodoItem[] = [
			{
				id: "new-id",
				content: "New text",
				status: "completed",
				subtaskId: "subtask-1",
				// tokens/cost/added/removed intentionally omitted to verify preservation
			},
		]

		const tool = new UpdateTodoListTool()
		await tool.execute({ todos: md }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockImplementation(async () => {
				setPendingTodoList(userEditedTodos)
				return true
			}),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(1)
		expect(task.todoList[0]).toEqual(
			expect.objectContaining({
				id: "new-id",
				content: "New text",
				status: "completed",
				subtaskId: "subtask-1",
				tokens: 123,
				cost: 0.01,
				added: 10,
				removed: 3,
			}),
		)
	})

	it("should preserve added/removed through normalization", async () => {
		const md = "[x] Task 1"

		const previousFromMemory: TodoItem[] = parseMarkdownChecklist("[ ] Task 1").map((t) => ({
			...t,
			added: 10,
			removed: 3,
		}))

		const task = {
			todoList: previousFromMemory,
			clineMessages: [],
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			didToolFailInCurrentTurn: false,
			say: vi.fn(),
		} as any

		const tool = new UpdateTodoListTool()
		await tool.execute({ todos: md }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(1)
		expect(task.todoList[0]).toEqual(
			expect.objectContaining({
				content: "Task 1",
				status: "completed",
				added: 10,
				removed: 3,
			}),
		)
	})

	it("should not cross-contaminate metadata when no subtaskId is present", async () => {
		const initialMd = "[ ] Task 1\n[ ] Task 2"
		const md = "[x] Task 1\n[ ] Task 2" // status changes for Task 1 -> derived id changes

		const previousFromMemory: TodoItem[] = parseMarkdownChecklist(initialMd).map((t) =>
			t.content === "Task 1"
				? { ...t, tokens: 111, cost: 0.11, added: 11, removed: 1 }
				: { ...t, tokens: 222, cost: 0.22, added: 22, removed: 2 },
		)

		const task = {
			todoList: previousFromMemory,
			clineMessages: [],
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			didToolFailInCurrentTurn: false,
			say: vi.fn(),
		} as any

		const tool = new UpdateTodoListTool()
		await tool.execute({ todos: md }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(2)

		const task1 = task.todoList.find((t: TodoItem) => t.content === "Task 1")
		const task2 = task.todoList.find((t: TodoItem) => t.content === "Task 2")

		expect(task1).toEqual(
			expect.objectContaining({
				content: "Task 1",
				status: "completed",
				tokens: 111,
				cost: 0.11,
				added: 11,
				removed: 1,
			}),
		)

		expect(task2).toEqual(
			expect.objectContaining({
				content: "Task 2",
				status: "pending",
				tokens: 222,
				cost: 0.22,
				added: 22,
				removed: 2,
			}),
		)
	})

	it("should not preserve metadata when content changes and there is no subtaskId", async () => {
		const initialMd = "[ ] Task 1\n[ ] Task 2"
		const md = "[x] Task 1 (updated)\n[ ] Task 2"

		const previousFromMemory: TodoItem[] = parseMarkdownChecklist(initialMd).map((t) =>
			t.content === "Task 1"
				? { ...t, tokens: 111, cost: 0.11, added: 11, removed: 1 }
				: { ...t, tokens: 222, cost: 0.22, added: 22, removed: 2 },
		)

		const task = {
			todoList: previousFromMemory,
			clineMessages: [],
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			didToolFailInCurrentTurn: false,
			say: vi.fn(),
		} as any

		const tool = new UpdateTodoListTool()
		await tool.execute({ todos: md }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(2)

		const updated = task.todoList.find((t: TodoItem) => t.content === "Task 1 (updated)")
		const task2 = task.todoList.find((t: TodoItem) => t.content === "Task 2")

		expect(updated).toEqual(
			expect.objectContaining({
				content: "Task 1 (updated)",
				status: "completed",
			}),
		)
		expect(updated?.tokens).toBeUndefined()
		expect(updated?.cost).toBeUndefined()
		expect(updated?.added).toBeUndefined()
		expect(updated?.removed).toBeUndefined()

		expect(task2).toEqual(
			expect.objectContaining({
				content: "Task 2",
				status: "pending",
				tokens: 222,
				cost: 0.22,
				added: 22,
				removed: 2,
			}),
		)
	})
})
