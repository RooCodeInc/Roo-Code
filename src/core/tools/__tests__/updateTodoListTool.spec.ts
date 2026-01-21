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
		it("should generate consistent IDs for the same content", () => {
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

		it("should generate the same ID for the same content even when status changes", () => {
			const pending = parseMarkdownChecklist(`[ ] Task 1`)
			const completed = parseMarkdownChecklist(`[x] Task 1`)
			expect(pending[0].id).toBe(completed[0].id)
		})

		it("should keep duplicate IDs stable by occurrence even when status changes", () => {
			const pending = parseMarkdownChecklist(`[ ] Task 1\n[ ] Task 1`)
			const completed = parseMarkdownChecklist(`[x] Task 1\n[x] Task 1`)
			expect(pending[0].id).toBe(completed[0].id)
			expect(pending[1].id).toBe(completed[1].id)
			// Within a single parse, duplicates must not share IDs.
			expect(pending[0].id).not.toBe(pending[1].id)
		})

		it("should generate same IDs regardless of dash prefix", () => {
			const md1 = `[ ] Task 1`
			const md2 = `- [ ] Task 1`
			const result1 = parseMarkdownChecklist(md1)
			const result2 = parseMarkdownChecklist(md2)
			expect(result1[0].id).toBe(result2[0].id)
		})

		it("should generate the same IDs for the same content even when whitespace differs", () => {
			const md1 = `[ ] Task 1`
			const md2 = `[ ] Task   1`
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

	it("should preserve per-row metadata (subtaskId/tokens/cost) when only statuses change (bulk markdown rewrite)", async () => {
		/**
		 * Regression test: a bulk markdown rewrite often changes the derived todo `id`
		 * (since [`parseMarkdownChecklist()`](../UpdateTodoListTool.ts:337) hashes
		 * `content + status`). When only statuses change, we must still preserve the
		 * existing per-row metadata. This is especially important for duplicates,
		 * where unstable IDs and/or duplicate IDs can cause metadata to be dropped
		 * or misapplied.
		 */
		const initialMd = "[ ] Task A\n[ ] Task B\n[ ] Task A\n[ ] Task C"
		const updatedMd = "[x] Task A\n[x] Task B\n[x] Task A\n[ ] Task C" // content identical, only statuses change

		const previousFromMemory: TodoItem[] = parseMarkdownChecklist(initialMd).map((t, idx) => ({
			...t,
			subtaskId: `subtask-${idx + 1}`,
			tokens: 1000 + idx,
			cost: 0.01 * (idx + 1),
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
		await tool.execute({ todos: updatedMd }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(4)

		// Preserve per-row metadata (including duplicates) by order.
		expect(task.todoList[0]).toEqual(
			expect.objectContaining({
				content: "Task A",
				status: "completed",
				subtaskId: "subtask-1",
				tokens: 1000,
				cost: 0.01,
			}),
		)

		expect(task.todoList[1]).toEqual(
			expect.objectContaining({
				content: "Task B",
				status: "completed",
				subtaskId: "subtask-2",
				tokens: 1001,
				cost: 0.02,
			}),
		)

		expect(task.todoList[2]).toEqual(
			expect.objectContaining({
				content: "Task A",
				status: "completed",
				subtaskId: "subtask-3",
				tokens: 1002,
				cost: 0.03,
			}),
		)

		expect(task.todoList[3]).toEqual(
			expect.objectContaining({
				content: "Task C",
				status: "pending",
				subtaskId: "subtask-4",
				tokens: 1003,
				cost: 0.04,
			}),
		)
	})

	it("should preserve subtaskId/metrics when items are renamed but status sequence and length are unchanged (markdown)", async () => {
		const initialMd = "[ ] Old A\n[x] Old B\n[-] Old C"
		const updatedMd = "[ ] New A\n[x] New B\n[-] New C" // same length + same status sequence, only content changed

		const previousFromMemory: TodoItem[] = parseMarkdownChecklist(initialMd).map((t, idx) => ({
			...t,
			subtaskId: `subtask-${idx + 1}`,
			tokens: 100 + idx,
			cost: 0.01 * (idx + 1),
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
		await tool.execute({ todos: updatedMd }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(3)

		expect(task.todoList[0]).toEqual(
			expect.objectContaining({
				content: "New A",
				status: "pending",
				subtaskId: "subtask-1",
				tokens: 100,
				cost: 0.01,
			}),
		)
		expect(task.todoList[1]).toEqual(
			expect.objectContaining({
				content: "New B",
				status: "completed",
				subtaskId: "subtask-2",
				tokens: 101,
				cost: 0.02,
			}),
		)
		expect(task.todoList[2]).toEqual(
			expect.objectContaining({
				content: "New C",
				status: "in_progress",
				subtaskId: "subtask-3",
				tokens: 102,
				cost: 0.03,
			}),
		)
	})

	it("should accept JSON TodoItem[] payload and preserve ids/subtask links across renames", async () => {
		const previousFromMemory: TodoItem[] = [
			{
				id: "id-1",
				content: "Alpha",
				status: "pending",
				subtaskId: "subtask-1",
				tokens: 111,
				cost: 0.11,
			},
			{
				id: "id-2",
				content: "Beta",
				status: "completed",
				subtaskId: "subtask-2",
				tokens: 222,
				cost: 0.22,
			},
		]

		// Reorder + rename while keeping id/subtaskId stable; omit metrics to verify preservation.
		const jsonPayload: TodoItem[] = [
			{ id: "id-2", content: "Beta renamed", status: "completed", subtaskId: "subtask-2" },
			{ id: "id-1", content: "Alpha renamed", status: "pending", subtaskId: "subtask-1" },
		]

		const task = {
			todoList: previousFromMemory,
			clineMessages: [],
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			didToolFailInCurrentTurn: false,
			say: vi.fn(),
		} as any

		const tool = new UpdateTodoListTool()
		await tool.execute({ todos: JSON.stringify(jsonPayload) }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(2)
		// Order should match the JSON payload.
		expect(task.todoList.map((t: TodoItem) => t.id)).toEqual(["id-2", "id-1"])

		expect(task.todoList[0]).toEqual(
			expect.objectContaining({
				id: "id-2",
				content: "Beta renamed",
				status: "completed",
				subtaskId: "subtask-2",
				tokens: 222,
				cost: 0.22,
			}),
		)

		expect(task.todoList[1]).toEqual(
			expect.objectContaining({
				id: "id-1",
				content: "Alpha renamed",
				status: "pending",
				subtaskId: "subtask-1",
				tokens: 111,
				cost: 0.11,
			}),
		)
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

	it("should preserve metadata by subtaskId even when content (and derived id) changes", async () => {
		// This test simulates the "user edited todo list" flow. The tool re-applies metadata
		// after approval; subtaskId should be used as the primary match when content/id changes.
		const md = "[ ] Old text"

		const previousFromMemory: TodoItem[] = parseMarkdownChecklist(md).map((t) => ({
			...t,
			subtaskId: "subtask-1",
			tokens: 123,
			cost: 0.01,
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
				// tokens/cost intentionally omitted to verify preservation
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
			}),
		)
	})

	it("should preserve metadata when content changes only by whitespace/formatting (legacy ids)", async () => {
		const md = "[x] Task 1\n[ ] Task 2"

		const previousFromMemory: TodoItem[] = [
			{
				id: "legacy-1",
				content: "Task   1",
				status: "pending",
				tokens: 111,
				cost: 0.11,
			},
			{
				id: "legacy-2",
				content: "Task 2",
				status: "pending",
				tokens: 222,
				cost: 0.22,
			},
		]

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
		} as any)

		expect(task.todoList).toHaveLength(2)

		const task1 = task.todoList.find((t: TodoItem) => t.content === "Task 1")
		const task2 = task.todoList.find((t: TodoItem) => t.content === "Task 2")

		expect(task1).toEqual(
			expect.objectContaining({
				content: "Task 1",
				status: "completed",
				tokens: 111,
				cost: 0.11,
			}),
		)
		expect(task2).toEqual(
			expect.objectContaining({
				content: "Task 2",
				status: "pending",
				tokens: 222,
				cost: 0.22,
			}),
		)
	})

	it("should carry forward metadata from unmatched delegated todos when the LLM rewrites content", async () => {
		const delegatedSubtaskId = "019bdcf3-b738-7779-ba86-a4838b490b40"
		const previousFromMemory: TodoItem[] = [
			{
				id: `synthetic-${delegatedSubtaskId}`,
				content: "Delegated to subtask",
				status: "pending",
				subtaskId: delegatedSubtaskId,
				tokens: 1234,
				cost: 0.12,
			},
		]

		// Simulate the LLM rewriting the todo content entirely (no content/id/subtaskId match).
		// Use a different-length list so the rename-by-index fallback does NOT apply.
		const updatedMd = "[ ] Delegate joke-telling to Ask mode\n[ ] Another unrelated task"

		const task = {
			todoList: previousFromMemory,
			clineMessages: [],
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			didToolFailInCurrentTurn: false,
			say: vi.fn(),
		} as any

		const tool = new UpdateTodoListTool()
		await tool.execute({ todos: updatedMd }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(2)
		expect(task.todoList[0]).toEqual(
			expect.objectContaining({
				content: "Delegate joke-telling to Ask mode",
				status: "pending",
				subtaskId: delegatedSubtaskId,
				tokens: 1234,
				cost: 0.12,
			}),
		)

		// Ensure the second new todo doesn't incorrectly inherit delegated metadata.
		expect(task.todoList[1]).toEqual(
			expect.objectContaining({
				content: "Another unrelated task",
				status: "pending",
			}),
		)
		expect(task.todoList[1].subtaskId).toBeUndefined()
		expect(task.todoList[1].tokens).toBeUndefined()
		expect(task.todoList[1].cost).toBeUndefined()
	})

	it("should carry forward metadata from unmatched delegated todos even when the previous id is non-synthetic (sequential updates)", async () => {
		const delegatedSubtaskId = "019bdcf3-b738-7779-ba86-a4838b490b41"
		const previousFromMemory: TodoItem[] = [
			{
				id: `synthetic-${delegatedSubtaskId}`,
				content: "Delegated to subtask",
				status: "pending",
				subtaskId: delegatedSubtaskId,
				tokens: 1234,
				cost: 0.12,
			},
			{
				id: "other-1",
				content: "Another unrelated task",
				status: "pending",
			},
		]

		const task = {
			todoList: previousFromMemory,
			clineMessages: [],
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			didToolFailInCurrentTurn: false,
			say: vi.fn(),
		} as any

		const tool = new UpdateTodoListTool()

		// Update 1: delegated todo gets rewritten into a new markdown todo (ID becomes derived md5, i.e. non-synthetic)
		const updatedMd1 = "[ ] Delegate joke-telling to Ask mode\n[ ] Another unrelated task"
		await tool.execute({ todos: updatedMd1 }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(2)
		expect(task.todoList[0]).toEqual(
			expect.objectContaining({
				content: "Delegate joke-telling to Ask mode",
				subtaskId: delegatedSubtaskId,
				tokens: 1234,
				cost: 0.12,
			}),
		)
		// Ensure the carried-over todo now has a non-synthetic ID (this is the regression scenario).
		expect(task.todoList[0].id).not.toMatch(/^synthetic-/)

		// Update 2: LLM rewrites the delegated todo content again, and list length changes so index-carryover won't apply.
		// No subtaskId is provided in the markdown.
		const updatedMd2 =
			"[ ] Delegate joke-telling to Ask mode (updated)\n[ ] Another unrelated task\n[ ] Third task added"
		await tool.execute({ todos: updatedMd2 }, task, {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
			askApproval: vi.fn().mockResolvedValue(true),
			removeClosingTag: vi.fn(),
			toolProtocol: "xml",
		})

		expect(task.todoList).toHaveLength(3)
		expect(task.todoList[0]).toEqual(
			expect.objectContaining({
				content: "Delegate joke-telling to Ask mode (updated)",
				subtaskId: delegatedSubtaskId,
				tokens: 1234,
				cost: 0.12,
			}),
		)

		// Ensure non-delegated todos do not accidentally inherit delegated metadata.
		expect(task.todoList[1].subtaskId).toBeUndefined()
		expect(task.todoList[2].subtaskId).toBeUndefined()
	})

	it("should not cross-contaminate metadata when no subtaskId is present", async () => {
		const initialMd = "[ ] Task 1\n[ ] Task 2"
		const md = "[x] Task 1\n[ ] Task 2" // status changes for Task 1 -> derived id changes

		const previousFromMemory: TodoItem[] = parseMarkdownChecklist(initialMd).map((t) =>
			t.content === "Task 1" ? { ...t, tokens: 111, cost: 0.11 } : { ...t, tokens: 222, cost: 0.22 },
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
			}),
		)

		expect(task2).toEqual(
			expect.objectContaining({
				content: "Task 2",
				status: "pending",
				tokens: 222,
				cost: 0.22,
			}),
		)
	})

	it("should not preserve metadata when content changes and there is no subtaskId", async () => {
		const initialMd = "[ ] Task 1\n[ ] Task 2"
		const md = "[x] Task 1 (updated)\n[ ] Task 2"

		const previousFromMemory: TodoItem[] = parseMarkdownChecklist(initialMd).map((t) =>
			t.content === "Task 1" ? { ...t, tokens: 111, cost: 0.11 } : { ...t, tokens: 222, cost: 0.22 },
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

		expect(task2).toEqual(
			expect.objectContaining({
				content: "Task 2",
				status: "pending",
				tokens: 222,
				cost: 0.22,
			}),
		)
	})
})
