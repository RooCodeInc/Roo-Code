import { describe, it, expect, vi, beforeEach } from "vitest"
import { updateTodoListTool } from "../updateTodoListTool"
import { Task } from "../../task/Task"
import { formatResponse } from "../../prompts/responses"

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg) => `Error: ${msg}`),
		toolResult: vi.fn((msg) => msg),
	},
}))

describe("updateTodoListTool - Diff Generation", () => {
	let mockTask: Task
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockRemoveClosingTag: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockTask = {
			taskId: "test-task",
			todoList: [
				{ id: "1", content: "Existing task 1", status: "pending" },
				{ id: "2", content: "Existing task 2", status: "completed" },
				{ id: "3", content: "Existing task 3", status: "in_progress" },
			],
			say: vi.fn(),
			ask: vi.fn(),
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
		} as any

		mockAskApproval = vi.fn(() => Promise.resolve(true))
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag, text) => text)
	})

	it("should generate diff for added todos", async () => {
		const block = {
			name: "update_todo_list",
			params: {
				todos: `[x] Existing task 2
[-] Existing task 3
[ ] Existing task 1
[ ] New task 4`,
			},
			partial: false,
		} as any

		await updateTodoListTool(
			mockTask,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Check that the diff was generated and included in the result
		expect(mockPushToolResult).toHaveBeenCalled()
		const result = mockPushToolResult.mock.calls[0][0]
		expect(result).toContain("Added:")
		expect(result).toContain("+ [ ] New task 4")
	})

	it("should generate diff for removed todos", async () => {
		const block = {
			name: "update_todo_list",
			params: {
				todos: `[x] Existing task 2
[-] Existing task 3`,
			},
			partial: false,
		} as any

		await updateTodoListTool(
			mockTask,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Check that the diff was generated and included in the result
		expect(mockPushToolResult).toHaveBeenCalled()
		const result = mockPushToolResult.mock.calls[0][0]
		expect(result).toContain("Removed:")
		expect(result).toContain("- [ ] Existing task 1")
	})

	it("should generate diff for modified todos", async () => {
		const block = {
			name: "update_todo_list",
			params: {
				todos: `[ ] Modified task 1
[x] Existing task 2
[ ] Existing task 3`,
			},
			partial: false,
		} as any

		await updateTodoListTool(
			mockTask,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Check that the diff was generated and included in the result
		expect(mockPushToolResult).toHaveBeenCalled()
		const result = mockPushToolResult.mock.calls[0][0]
		expect(result).toContain("Modified:")
		// Should show content change
		expect(result).toMatch(/"Existing task 1".*→.*"Modified task 1"/)
		// Should show status change
		expect(result).toMatch(/Status:.*in_progress.*→.*pending/)
	})

	it("should handle no changes", async () => {
		const block = {
			name: "update_todo_list",
			params: {
				todos: `[ ] Existing task 1
[x] Existing task 2
[-] Existing task 3`,
			},
			partial: false,
		} as any

		await updateTodoListTool(
			mockTask,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Check that the result indicates no changes
		expect(mockPushToolResult).toHaveBeenCalled()
		const result = mockPushToolResult.mock.calls[0][0]
		expect(result).toContain("no changes")
	})

	it("should include diff text in approval message", async () => {
		const block = {
			name: "update_todo_list",
			params: {
				todos: `[ ] Existing task 1
[x] Existing task 2
[-] Existing task 3
[ ] New task 4`,
			},
			partial: false,
		} as any

		await updateTodoListTool(
			mockTask,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Check that askApproval was called with diff text
		expect(mockAskApproval).toHaveBeenCalled()
		const approvalMsg = mockAskApproval.mock.calls[0][1]
		const parsed = JSON.parse(approvalMsg)
		expect(parsed.diffText).toBeDefined()
		expect(parsed.diffText).toContain("Added:")
		expect(parsed.diffText).toContain("+ [ ] New task 4")
	})

	it("should handle empty initial todo list", async () => {
		mockTask.todoList = []

		const block = {
			name: "update_todo_list",
			params: {
				todos: `[ ] First task
[ ] Second task`,
			},
			partial: false,
		} as any

		await updateTodoListTool(
			mockTask,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Check that the diff shows all items as added
		expect(mockPushToolResult).toHaveBeenCalled()
		const result = mockPushToolResult.mock.calls[0][0]
		expect(result).toContain("Added:")
		expect(result).toContain("+ [ ] First task")
		expect(result).toContain("+ [ ] Second task")
	})

	it("should handle clearing all todos", async () => {
		const block = {
			name: "update_todo_list",
			params: {
				todos: "",
			},
			partial: false,
		} as any

		await updateTodoListTool(
			mockTask,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Check that the diff shows all items as removed
		expect(mockPushToolResult).toHaveBeenCalled()
		const result = mockPushToolResult.mock.calls[0][0]
		expect(result).toContain("Removed:")
		expect(result).toContain("- [ ] Existing task 1")
		expect(result).toContain("- [x] Existing task 2")
		expect(result).toContain("- [-] Existing task 3")
	})
})
