import { checkAutoApproval } from "../index"
import type { TodoItem } from "@roo-code/types"

describe("checkAutoApproval", () => {
	describe("alwaysAllowDuringTodoExecution", () => {
		const baseState = {
			autoApprovalEnabled: true,
			alwaysAllowDuringTodoExecution: true,
			alwaysAllowWrite: false, // Intentionally false to test that todo execution takes precedence
		}

		// Tool names used in auto-approval are: editedExistingFile, appliedDiff, newFileCreated
		const writeToolText = JSON.stringify({
			tool: "editedExistingFile",
			path: "test.ts",
			content: "test content",
		})

		it("should auto-approve write operations when todos are in progress", async () => {
			const todoList: TodoItem[] = [
				{ id: "1", content: "Task 1", status: "completed" },
				{ id: "2", content: "Task 2", status: "in_progress" },
				{ id: "3", content: "Task 3", status: "pending" },
			]

			const result = await checkAutoApproval({
				state: baseState,
				ask: "tool",
				text: writeToolText,
				todoList,
			})

			expect(result.decision).toBe("approve")
		})

		it("should auto-approve when todos are pending", async () => {
			const todoList: TodoItem[] = [{ id: "1", content: "Task 1", status: "pending" }]

			const result = await checkAutoApproval({
				state: baseState,
				ask: "tool",
				text: writeToolText,
				todoList,
			})

			expect(result.decision).toBe("approve")
		})

		it("should not auto-approve when all todos are completed", async () => {
			const todoList: TodoItem[] = [
				{ id: "1", content: "Task 1", status: "completed" },
				{ id: "2", content: "Task 2", status: "completed" },
			]

			const result = await checkAutoApproval({
				state: baseState,
				ask: "tool",
				text: writeToolText,
				todoList,
			})

			// Should fall back to normal behavior - since alwaysAllowWrite is false, should ask
			expect(result.decision).toBe("ask")
		})

		it("should not auto-approve when todo list is empty", async () => {
			const result = await checkAutoApproval({
				state: baseState,
				ask: "tool",
				text: writeToolText,
				todoList: [],
			})

			expect(result.decision).toBe("ask")
		})

		it("should not auto-approve when todo list is undefined", async () => {
			const result = await checkAutoApproval({
				state: baseState,
				ask: "tool",
				text: writeToolText,
				todoList: undefined,
			})

			expect(result.decision).toBe("ask")
		})

		it("should not auto-approve when alwaysAllowDuringTodoExecution is false", async () => {
			const state = {
				...baseState,
				alwaysAllowDuringTodoExecution: false,
			}

			const todoList: TodoItem[] = [{ id: "1", content: "Task 1", status: "in_progress" }]

			const result = await checkAutoApproval({
				state,
				ask: "tool",
				text: writeToolText,
				todoList,
			})

			expect(result.decision).toBe("ask")
		})

		it("should not auto-approve protected files during todo execution", async () => {
			const todoList: TodoItem[] = [{ id: "1", content: "Task 1", status: "in_progress" }]

			const result = await checkAutoApproval({
				state: baseState,
				ask: "tool",
				text: writeToolText,
				isProtected: true,
				todoList,
			})

			expect(result.decision).toBe("ask")
		})

		it("should not auto-approve files outside workspace during todo execution", async () => {
			const todoList: TodoItem[] = [{ id: "1", content: "Task 1", status: "in_progress" }]

			const outsideWorkspaceWriteToolText = JSON.stringify({
				tool: "editedExistingFile",
				path: "/outside/workspace/test.ts",
				content: "test content",
				isOutsideWorkspace: true,
			})

			const result = await checkAutoApproval({
				state: baseState,
				ask: "tool",
				text: outsideWorkspaceWriteToolText,
				todoList,
			})

			expect(result.decision).toBe("ask")
		})

		it("should fall back to regular alwaysAllowWrite when todos are complete", async () => {
			const state = {
				...baseState,
				alwaysAllowWrite: true, // Enable regular write auto-approval
			}

			const todoList: TodoItem[] = [{ id: "1", content: "Task 1", status: "completed" }]

			const result = await checkAutoApproval({
				state,
				ask: "tool",
				text: writeToolText,
				todoList,
			})

			// Should fall back to alwaysAllowWrite behavior
			expect(result.decision).toBe("approve")
		})

		it("should auto-approve appliedDiff tool during todo execution", async () => {
			const todoList: TodoItem[] = [{ id: "1", content: "Task 1", status: "in_progress" }]

			const applyDiffToolText = JSON.stringify({
				tool: "appliedDiff",
				path: "test.ts",
				diff: "some diff content",
			})

			const result = await checkAutoApproval({
				state: baseState,
				ask: "tool",
				text: applyDiffToolText,
				todoList,
			})

			expect(result.decision).toBe("approve")
		})
	})
})
