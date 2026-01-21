// npx vitest run core/webview/__tests__/ClineProvider.reopenParentFromDelegation.writeback.spec.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClineMessage, HistoryItem, TodoItem } from "@roo-code/types"

// Mock safe-stable-stringify to avoid runtime error
vi.mock("safe-stable-stringify", () => ({
	default: (obj: any) => JSON.stringify(obj),
}))

// Mock TelemetryService (provider imports it)
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			setProvider: vi.fn(),
			captureTaskCreated: vi.fn(),
			captureTaskCompleted: vi.fn(),
		},
	},
}))

// vscode mock for ClineProvider imports
vi.mock("vscode", () => {
	const window = {
		createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
		showErrorMessage: vi.fn(),
		onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
	}
	const workspace = {
		getConfiguration: vi.fn(() => ({
			get: vi.fn((_key: string, defaultValue: any) => defaultValue),
			update: vi.fn(),
		})),
		workspaceFolders: [],
	}
	const env = {
		machineId: "test-machine",
		uriScheme: "vscode",
		appName: "VSCode",
		language: "en",
		sessionId: "sess",
	}
	const Uri = { file: (p: string) => ({ fsPath: p, toString: () => p }) }
	const commands = { executeCommand: vi.fn() }
	const ExtensionMode = { Development: 2 }
	const version = "1.0.0-test"
	return { window, workspace, env, Uri, commands, ExtensionMode, version }
})

// Mock persistence helpers used by provider reopen flow BEFORE importing provider
vi.mock("../../task-persistence/taskMessages", () => ({
	readTaskMessages: vi.fn().mockResolvedValue([]),
}))
vi.mock("../../task-persistence", () => ({
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
}))

import { ClineProvider } from "../ClineProvider"
import { readTaskMessages } from "../../task-persistence/taskMessages"
import { readApiMessages, saveTaskMessages } from "../../task-persistence"

/**
 * Regression: after a bulk todo rewrite (status changes), delegation completion writeback
 * must still update the correct parent todo row by `subtaskId` (not by position/anchor)
 * and must not break subtask linkage for other todo rows.
 */
describe("ClineProvider.reopenParentFromDelegation() writeback", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it("updates the correct linked todo after bulk status rewrite while preserving subtaskId", async () => {
		const parentTaskId = "parent-1"
		const child1TaskId = "child-1"
		const child2TaskId = "child-2"

		const initialTodos: TodoItem[] = [
			{ id: "t1", content: "Prep", status: "pending" },
			{ id: "t2", content: "Subtask 1", status: "pending", subtaskId: child1TaskId },
			{ id: "t3", content: "Subtask 2", status: "pending", subtaskId: child2TaskId },
		]

		// Simulate a bulk rewrite (e.g. update_todo_list) that marks earlier items completed
		// while preserving `subtaskId` links, but with regenerated todo IDs.
		const bulkRewrittenTodos: TodoItem[] = [
			{ id: "t1b", content: "Prep", status: "completed" },
			{ id: "t2b", content: "Subtask 1", status: "completed", subtaskId: child1TaskId },
			{ id: "t3b", content: "Subtask 2", status: "pending", subtaskId: child2TaskId },
		]

		const parentClineMessages: ClineMessage[] = [
			{
				type: "say",
				say: "system_update_todos",
				ts: 1,
				text: JSON.stringify({ tool: "updateTodoList", todos: initialTodos }),
			} as unknown as ClineMessage,
			{
				type: "say",
				say: "system_update_todos",
				ts: 2,
				text: JSON.stringify({ tool: "updateTodoList", todos: bulkRewrittenTodos }),
			} as unknown as ClineMessage,
		]

		vi.mocked(readTaskMessages).mockResolvedValue(parentClineMessages as any)
		vi.mocked(readApiMessages).mockResolvedValue([
			{
				role: "assistant",
				content: [{ type: "tool_use", name: "new_task", id: "tool-use-1" }],
				ts: 0,
			},
		] as any)

		const historyIndex: Record<string, HistoryItem> = {
			[parentTaskId]: {
				id: parentTaskId,
				ts: 1,
				task: "Parent",
				status: "delegated",
				childIds: [child1TaskId, child2TaskId],
				mode: "code",
				workspace: "/tmp",
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			} as unknown as HistoryItem,
			[child1TaskId]: {
				id: child1TaskId,
				ts: 2,
				task: "Child 1",
				status: "active",
				mode: "code",
				workspace: "/tmp",
				tokensIn: 1,
				tokensOut: 1,
				totalCost: 0.01,
			} as unknown as HistoryItem,
			[child2TaskId]: {
				id: child2TaskId,
				ts: 3,
				task: "Child 2",
				status: "active",
				mode: "code",
				workspace: "/tmp",
				tokensIn: 10,
				tokensOut: 5,
				totalCost: 0.123,
			} as unknown as HistoryItem,
		}

		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			log: vi.fn(),
			getTaskWithId: vi.fn(async (id: string) => {
				const historyItem = historyIndex[id]
				if (!historyItem) throw new Error(`Task not found: ${id}`)
				return {
					historyItem,
					apiConversationHistory: [],
					taskDirPath: "/tmp",
					apiConversationHistoryFilePath: "/tmp/api.json",
					uiMessagesFilePath: "/tmp/ui.json",
				}
			}),
			updateTaskHistory: vi.fn(async (updated: any) => {
				historyIndex[updated.id] = updated
				return Object.values(historyIndex)
			}),
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: child2TaskId })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				taskId: parentTaskId,
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
			}),
		} as unknown as ClineProvider

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId,
			childTaskId: child2TaskId,
			completionResultSummary: "Child 2 complete",
		})

		// Capture the saved messages and extract the writeback todo payload.
		expect(saveTaskMessages).toHaveBeenCalledWith(expect.objectContaining({ taskId: parentTaskId }))
		const savedMessages = vi.mocked(saveTaskMessages).mock.calls.at(-1)![0].messages as ClineMessage[]
		const lastTodoUpdate = [...savedMessages]
			.reverse()
			.find((m) => m.type === "say" && (m as any).say === "system_update_todos") as any
		expect(lastTodoUpdate).toBeTruthy()

		const payload = JSON.parse(lastTodoUpdate.text) as { tool: string; todos: TodoItem[] }
		expect(payload.tool).toBe("updateTodoList")
		expect(payload.todos).toHaveLength(3)

		const updatedChild2Row = payload.todos.find((t) => t.subtaskId === child2TaskId)
		const updatedChild1Row = payload.todos.find((t) => t.subtaskId === child1TaskId)
		const updatedPrepRow = payload.todos.find((t) => t.content === "Prep")

		expect(updatedChild2Row).toEqual(
			expect.objectContaining({
				id: "t3b",
				content: "Subtask 2",
				status: "pending",
				subtaskId: child2TaskId,
				tokens: 15,
				cost: 0.123,
			}),
		)

		// Ensure other rows were not mutated by this child completion writeback.
		expect(updatedChild1Row).toEqual(
			expect.objectContaining({
				id: "t2b",
				content: "Subtask 1",
				status: "completed",
				subtaskId: child1TaskId,
			}),
		)
		expect(updatedChild1Row?.tokens).toBeUndefined()
		expect(updatedChild1Row?.cost).toBeUndefined()

		expect(updatedPrepRow).toEqual(expect.objectContaining({ id: "t1b", content: "Prep", status: "completed" }))
		expect((updatedPrepRow as any)?.subtaskId).toBeUndefined()
	})
})
