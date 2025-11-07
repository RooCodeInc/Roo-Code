// npx vitest run __tests__/attempt-completion-todos-gate.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { TodoItem } from "@roo-code/types"
import { EXPERIMENT_IDS } from "../shared/experiments"

// Mock formatResponse
vi.mock("../core/prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg: string) => `Error: ${msg}`),
	},
}))

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
		})),
	},
}))

// Mock Package
vi.mock("../shared/package", () => ({
	Package: {
		name: "roo-cline",
	},
}))

import { attemptCompletionTool } from "../core/tools/attemptCompletionTool"
import type { Task } from "../core/task/Task"
import * as vscode from "vscode"

describe("attempt_completion with preventCompletionWithOpenTodos - delegation flow integration", () => {
	let mockGetConfiguration: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		mockGetConfiguration = vi.fn(() => ({
			get: vi.fn((key: string, defaultValue: any) => defaultValue),
		}))
		vi.mocked(vscode.workspace.getConfiguration).mockImplementation(mockGetConfiguration)
	})

	it("Flag ON + Setting ON: blocks completion when child has incomplete todos", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				experiments: { [EXPERIMENT_IDS.METADATA_DRIVEN_SUBTASKS]: true },
			}),
			reopenParentFromDelegation: vi.fn(),
		} as any

		const parentTask = { taskId: "p1", emit: vi.fn() }
		const cline = {
			taskId: "c1",
			parentTask,
			providerRef: { deref: () => provider },
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			todoList: [
				{ id: "1", content: "Task 1", status: "completed" },
				{ id: "2", content: "Task 2", status: "pending" },
			] as TodoItem[],
			say: vi.fn().mockResolvedValue(undefined),
			emit: vi.fn(),
			getTokenUsage: vi.fn(() => ({})),
			toolUsage: {},
			clineMessages: [],
			userMessageContent: [],
		} as unknown as Task

		// Enable setting
		mockGetConfiguration.mockReturnValue({
			get: vi.fn((key: string, defaultValue: any) => {
				if (key === "preventCompletionWithOpenTodos") return true
				return defaultValue
			}),
		})

		const pushToolResult = vi.fn()
		const block = {
			type: "tool_use",
			name: "attempt_completion",
			params: { result: "Child done" },
			partial: false,
		} as any

		await attemptCompletionTool(
			cline,
			block,
			vi.fn(),
			vi.fn(),
			pushToolResult,
			vi.fn((_, v?: string) => v ?? ""),
			() => "desc",
			vi.fn(async () => true),
		)

		// CRITICAL: Must block completion due to incomplete todos
		expect(cline.consecutiveMistakeCount).toBe(1)
		expect(cline.recordToolError).toHaveBeenCalledWith("attempt_completion")
		expect(pushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("Cannot complete task while there are incomplete todos"),
		)

		// Provider reopen should NOT be called (blocked before delegation logic)
		expect(provider.reopenParentFromDelegation).not.toHaveBeenCalled()
	})

	it("Flag ON + Setting OFF: allows completion even with incomplete todos (legacy behavior in new flow)", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				experiments: { [EXPERIMENT_IDS.METADATA_DRIVEN_SUBTASKS]: true },
			}),
			reopenParentFromDelegation: vi.fn().mockResolvedValue(undefined),
		} as any

		const parentTask = { taskId: "p2", emit: vi.fn() }
		const cline = {
			taskId: "c2",
			parentTask,
			providerRef: { deref: () => provider },
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			todoList: [{ id: "1", content: "Task 1", status: "pending" }] as TodoItem[],
			say: vi.fn().mockResolvedValue(undefined),
			emit: vi.fn(),
			getTokenUsage: vi.fn(() => ({})),
			toolUsage: {},
			clineMessages: [],
			userMessageContent: [],
		} as unknown as Task

		// Setting OFF
		mockGetConfiguration.mockReturnValue({
			get: vi.fn((key: string, defaultValue: any) => {
				if (key === "preventCompletionWithOpenTodos") return false
				return defaultValue
			}),
		})

		const pushToolResult = vi.fn()
		const block = {
			type: "tool_use",
			name: "attempt_completion",
			params: { result: "Done" },
			partial: false,
		} as any

		await attemptCompletionTool(
			cline,
			block,
			vi.fn(),
			vi.fn(),
			pushToolResult,
			vi.fn((_, v?: string) => v ?? ""),
			() => "desc",
			vi.fn(async () => true),
		)

		// Should NOT block (setting OFF)
		expect(cline.consecutiveMistakeCount).toBe(0)
		expect(cline.recordToolError).not.toHaveBeenCalled()
		expect(pushToolResult).not.toHaveBeenCalledWith(
			expect.stringContaining("Cannot complete task while there are incomplete todos"),
		)

		// Provider reopen should be called (delegation proceeds)
		expect(provider.reopenParentFromDelegation).toHaveBeenCalledWith({
			parentTaskId: "p2",
			childTaskId: "c2",
			completionResultSummary: "Done",
		})
	})

	it("Flag OFF + Setting ON: blocks completion in legacy flow when todos incomplete", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				experiments: { [EXPERIMENT_IDS.METADATA_DRIVEN_SUBTASKS]: false },
			}),
			finishSubTask: vi.fn().mockResolvedValue(undefined),
		} as any

		const parentTask = { taskId: "p3", emit: vi.fn() }
		const cline = {
			taskId: "c3",
			parentTask,
			providerRef: { deref: () => provider },
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			todoList: [{ id: "1", content: "Task", status: "in_progress" }] as TodoItem[],
			say: vi.fn().mockResolvedValue(undefined),
			emit: vi.fn(),
			gettokenUsage: vi.fn(() => ({})),
			toolUsage: {},
			clineMessages: [],
			userMessageContent: [],
		} as unknown as Task

		// Setting ON
		mockGetConfiguration.mockReturnValue({
			get: vi.fn((key: string, defaultValue: any) => {
				if (key === "preventCompletionWithOpenTodos") return true
				return defaultValue
			}),
		})

		const pushToolResult = vi.fn()
		const block = {
			type: "tool_use",
			name: "attempt_completion",
			params: { result: "Legacy done" },
			partial: false,
		} as any

		await attemptCompletionTool(
			cline,
			block,
			vi.fn(),
			vi.fn(),
			pushToolResult,
			vi.fn((_, v?: string) => v ?? ""),
			() => "desc",
			vi.fn(async () => true),
		)

		// Must block (setting ON + incomplete todos)
		expect(cline.consecutiveMistakeCount).toBe(1)
		expect(cline.recordToolError).toHaveBeenCalledWith("attempt_completion")
		expect(pushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("Cannot complete task while there are incomplete todos"),
		)

		// Legacy finishSubTask should NOT be called (blocked before)
		expect(provider.finishSubTask).not.toHaveBeenCalled()
	})

	it("Flag OFF + Setting OFF: allows completion in legacy flow with incomplete todos", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				experiments: { [EXPERIMENT_IDS.METADATA_DRIVEN_SUBTASKS]: false },
			}),
			finishSubTask: vi.fn().mockResolvedValue(undefined),
		} as any

		const parentTask = { taskId: "p4", emit: vi.fn() }
		const cline = {
			taskId: "c4",
			parentTask,
			providerRef: { deref: () => provider },
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			todoList: [{ id: "1", content: "Task", status: "pending" }] as TodoItem[],
			say: vi.fn().mockResolvedValue(undefined),
			emit: vi.fn(),
			getTokenUsage: vi.fn(() => ({})),
			toolUsage: {},
			clineMessages: [],
			userMessageContent: [],
		} as unknown as Task

		// Setting OFF
		mockGetConfiguration.mockReturnValue({
			get: vi.fn((key: string, defaultValue: any) => {
				if (key === "preventCompletionWithOpenTodos") return false
				return defaultValue
			}),
		})

		const pushToolResult = vi.fn()
		const block = {
			type: "tool_use",
			name: "attempt_completion",
			params: { result: "Legacy result" },
			partial: false,
		} as any

		await attemptCompletionTool(
			cline,
			block,
			vi.fn(),
			vi.fn(),
			pushToolResult,
			vi.fn((_, v?: string) => v ?? ""),
			() => "desc",
			vi.fn(async () => true),
		)

		// Should NOT block
		expect(cline.consecutiveMistakeCount).toBe(0)
		expect(cline.recordToolError).not.toHaveBeenCalled()

		// Legacy finishSubTask should be called
		expect(provider.finishSubTask).toHaveBeenCalledWith("Legacy result")
	})

	it("Setting ON: allows completion when all todos completed (both flows)", async () => {
		const providerNew = {
			getState: vi.fn().mockResolvedValue({
				experiments: { [EXPERIMENT_IDS.METADATA_DRIVEN_SUBTASKS]: true },
			}),
			reopenParentFromDelegation: vi.fn().mockResolvedValue(undefined),
		} as any

		const parentTask = { taskId: "p5", emit: vi.fn() }
		const cline = {
			taskId: "c5",
			parentTask,
			providerRef: { deref: () => providerNew },
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			todoList: [
				{ id: "1", content: "T1", status: "completed" },
				{ id: "2", content: "T2", status: "completed" },
			] as TodoItem[],
			say: vi.fn().mockResolvedValue(undefined),
			emit: vi.fn(),
			getTokenUsage: vi.fn(() => ({})),
			toolUsage: {},
			clineMessages: [],
			userMessageContent: [],
		} as unknown as Task

		// Setting ON
		mockGetConfiguration.mockReturnValue({
			get: vi.fn((key: string, defaultValue: any) => {
				if (key === "preventCompletionWithOpenTodos") return true
				return defaultValue
			}),
		})

		const block = {
			type: "tool_use",
			name: "attempt_completion",
			params: { result: "All done" },
			partial: false,
		} as any

		await attemptCompletionTool(
			cline,
			block,
			vi.fn(),
			vi.fn(),
			vi.fn(),
			vi.fn((_, v?: string) => v ?? ""),
			() => "desc",
			vi.fn(async () => true),
		)

		// Should NOT block (all todos completed)
		expect(cline.consecutiveMistakeCount).toBe(0)
		expect(cline.recordToolError).not.toHaveBeenCalled()

		// Delegation should proceed
		expect(providerNew.reopenParentFromDelegation).toHaveBeenCalled()
	})

	it("Setting ON: allows completion when todo list is empty or undefined", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				experiments: { [EXPERIMENT_IDS.METADATA_DRIVEN_SUBTASKS]: true },
			}),
			reopenParentFromDelegation: vi.fn().mockResolvedValue(undefined),
		} as any

		const parentTask = { taskId: "p6", emit: vi.fn() }

		// Test with undefined todoList
		const clineUndefined = {
			taskId: "c6a",
			parentTask,
			providerRef: { deref: () => provider },
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			todoList: undefined,
			say: vi.fn().mockResolvedValue(undefined),
			emit: vi.fn(),
			getTokenUsage: vi.fn(() => ({})),
			toolUsage: {},
			clineMessages: [],
			userMessageContent: [],
		} as unknown as Task

		mockGetConfiguration.mockReturnValue({
			get: vi.fn((key: string, defaultValue: any) => {
				if (key === "preventCompletionWithOpenTodos") return true
				return defaultValue
			}),
		})

		const block = {
			type: "tool_use",
			name: "attempt_completion",
			params: { result: "Done" },
			partial: false,
		} as any

		await attemptCompletionTool(
			clineUndefined,
			block,
			vi.fn(),
			vi.fn(),
			vi.fn(),
			vi.fn((_, v?: string) => v ?? ""),
			() => "desc",
			vi.fn(async () => true),
		)

		expect(clineUndefined.consecutiveMistakeCount).toBe(0)
		expect(clineUndefined.recordToolError).not.toHaveBeenCalled()

		// Test with empty todoList
		const clineEmpty = {
			taskId: "c6b",
			parentTask,
			providerRef: { deref: () => provider },
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			todoList: [] as TodoItem[],
			say: vi.fn().mockResolvedValue(undefined),
			emit: vi.fn(),
			getTokenUsage: vi.fn(() => ({})),
			toolUsage: {},
			clineMessages: [],
			userMessageContent: [],
		} as unknown as Task

		await attemptCompletionTool(
			clineEmpty,
			block,
			vi.fn(),
			vi.fn(),
			vi.fn(),
			vi.fn((_, v?: string) => v ?? ""),
			() => "desc",
			vi.fn(async () => true),
		)

		expect(clineEmpty.consecutiveMistakeCount).toBe(0)
		expect(clineEmpty.recordToolError).not.toHaveBeenCalled()
	})

	it("Setting ON: blocks execution order is before delegation/legacy logic", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				experiments: { [EXPERIMENT_IDS.METADATA_DRIVEN_SUBTASKS]: true },
			}),
			reopenParentFromDelegation: vi.fn(),
		} as any

		const parentTask = { taskId: "p7", emit: vi.fn() }
		const cline = {
			taskId: "c7",
			parentTask,
			providerRef: { deref: () => provider },
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			todoList: [{ id: "1", content: "T", status: "pending" }] as TodoItem[],
			say: vi.fn().mockResolvedValue(undefined),
			emit: vi.fn(),
			getTokenUsage: vi.fn(() => ({})),
			toolUsage: {},
			clineMessages: [],
			userMessageContent: [],
		} as unknown as Task

		mockGetConfiguration.mockReturnValue({
			get: vi.fn((key: string, defaultValue: any) => {
				if (key === "preventCompletionWithOpenTodos") return true
				return defaultValue
			}),
		})

		const pushToolResult = vi.fn()
		const block = {
			type: "tool_use",
			name: "attempt_completion",
			params: { result: "R" },
			partial: false,
		} as any

		await attemptCompletionTool(
			cline,
			block,
			vi.fn(),
			vi.fn(),
			pushToolResult,
			vi.fn((_, v?: string) => v ?? ""),
			() => "desc",
			vi.fn(async () => true),
		)

		// Verify error pushed BEFORE any provider methods called
		expect(pushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("Cannot complete task while there are incomplete todos"),
		)
		expect(provider.getState).not.toHaveBeenCalled()
		expect(provider.reopenParentFromDelegation).not.toHaveBeenCalled()

		// Verify say NOT called (blocked early)
		expect(cline.say).not.toHaveBeenCalled()
	})
})
