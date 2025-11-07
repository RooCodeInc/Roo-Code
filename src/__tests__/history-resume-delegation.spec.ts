// npx vitest run __tests__/history-resume-delegation.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { RooCodeEventName } from "@roo-code/types"
import { EXPERIMENT_IDS } from "../shared/experiments"

/* vscode mock for Task/Provider imports */
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
	const env = { machineId: "test-machine", uriScheme: "vscode", appName: "VSCode", language: "en", sessionId: "sess" }
	const Uri = { file: (p: string) => ({ fsPath: p, toString: () => p }) }
	const commands = { executeCommand: vi.fn() }
	const ExtensionMode = { Development: 2 }
	const version = "1.0.0-test"
	return { window, workspace, env, Uri, commands, ExtensionMode, version }
})

// Mock persistence BEFORE importing provider
vi.mock("../core/task-persistence/taskMessages", () => ({
	readTaskMessages: vi.fn().mockResolvedValue([]),
}))
vi.mock("../core/task-persistence", () => ({
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
}))

import { ClineProvider } from "../core/webview/ClineProvider"
import { readTaskMessages } from "../core/task-persistence/taskMessages"
import { readApiMessages, saveApiMessages, saveTaskMessages } from "../core/task-persistence"

describe("History resume delegation - parent metadata transitions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("reopenParentFromDelegation persists parent metadata (delegated → active) before reopen", async () => {
		const providerEmit = vi.fn()
		const getTaskWithId = vi.fn().mockResolvedValue({
			historyItem: {
				id: "parent-1",
				status: "delegated",
				delegatedToId: "child-1",
				awaitingChildId: "child-1",
				childIds: ["child-1"],
				ts: Date.now(),
				task: "Parent task",
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
				mode: "code",
				workspace: "/tmp",
			},
		})

		const updateTaskHistory = vi.fn().mockResolvedValue([])
		const removeClineFromStack = vi.fn().mockResolvedValue(undefined)
		const createTaskWithHistoryItem = vi.fn().mockResolvedValue({
			taskId: "parent-1",
			skipPrevResponseIdOnce: false,
		})

		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			getTaskWithId,
			emit: providerEmit,
			getCurrentTask: vi.fn(() => ({ taskId: "child-1" })),
			removeClineFromStack,
			createTaskWithHistoryItem,
			updateTaskHistory,
		} as unknown as ClineProvider

		// Mock persistence reads to return empty arrays
		vi.mocked(readTaskMessages).mockResolvedValue([])
		vi.mocked(readApiMessages).mockResolvedValue([])

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "parent-1",
			childTaskId: "child-1",
			completionResultSummary: "Child done",
		})

		// Assert: metadata updated BEFORE createTaskWithHistoryItem
		expect(updateTaskHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "parent-1",
				status: "active",
				completedByChildId: "child-1",
				completionResultSummary: "Child done",
				awaitingChildId: undefined,
				childIds: ["child-1"],
			}),
		)

		// Verify call ordering: updateTaskHistory before createTaskWithHistoryItem
		const updateCall = updateTaskHistory.mock.invocationCallOrder[0]
		const createCall = createTaskWithHistoryItem.mock.invocationCallOrder[0]
		expect(updateCall).toBeLessThan(createCall)

		// Verify child closed and parent reopened with updated metadata
		expect(removeClineFromStack).toHaveBeenCalledTimes(1)
		expect(createTaskWithHistoryItem).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "active",
				completedByChildId: "child-1",
			}),
		)
	})

	it("reopenParentFromDelegation injects subtask_result into both UI and API histories", async () => {
		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/storage" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "p1",
					status: "delegated",
					awaitingChildId: "c1",
					childIds: [],
					ts: 100,
					task: "Parent",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				},
			}),
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "c1" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({ taskId: "p1" }),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		// Start with existing messages in history
		const existingUiMessages = [{ type: "ask", ask: "tool", text: "Old tool", ts: 50 }]
		const existingApiMessages = [{ role: "user", content: [{ type: "text", text: "Old request" }], ts: 50 }]

		vi.mocked(readTaskMessages).mockResolvedValue(existingUiMessages as any)
		vi.mocked(readApiMessages).mockResolvedValue(existingApiMessages as any)

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "p1",
			childTaskId: "c1",
			completionResultSummary: "Subtask completed successfully",
		})

		// Verify UI history injection (say: subtask_result)
		expect(saveTaskMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					expect.objectContaining({
						type: "say",
						say: "subtask_result",
						text: "Subtask completed successfully",
					}),
				]),
				taskId: "p1",
				globalStoragePath: "/storage",
			}),
		)

		// Verify API history injection (user role message)
		expect(saveApiMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					expect.objectContaining({
						role: "user",
						content: expect.arrayContaining([
							expect.objectContaining({
								type: "text",
								text: expect.stringContaining("Subtask c1 completed"),
							}),
						]),
					}),
				]),
				taskId: "p1",
				globalStoragePath: "/storage",
			}),
		)

		// Verify both include original messages
		const uiCall = vi.mocked(saveTaskMessages).mock.calls[0][0]
		expect(uiCall.messages).toHaveLength(2) // 1 original + 1 injected

		const apiCall = vi.mocked(saveApiMessages).mock.calls[0][0]
		expect(apiCall.messages).toHaveLength(2) // 1 original + 1 injected
	})

	it("reopenParentFromDelegation sets skipPrevResponseIdOnce on reopened parent", async () => {
		const parentInstance: any = { skipPrevResponseIdOnce: false }

		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "parent-2",
					status: "delegated",
					awaitingChildId: "child-2",
					childIds: [],
					ts: 200,
					task: "P",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				},
			}),
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "child-2" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue(parentInstance),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		vi.mocked(readTaskMessages).mockResolvedValue([])
		vi.mocked(readApiMessages).mockResolvedValue([])

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "parent-2",
			childTaskId: "child-2",
			completionResultSummary: "Done",
		})

		// Critical: verify skipPrevResponseIdOnce set to true on parent instance
		expect(parentInstance.skipPrevResponseIdOnce).toBe(true)
	})

	it("reopenParentFromDelegation emits events in correct order: TaskDelegationCompleted → TaskDelegationResumed", async () => {
		const emitSpy = vi.fn()

		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "p3",
					status: "delegated",
					awaitingChildId: "c3",
					childIds: [],
					ts: 300,
					task: "P3",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				},
			}),
			emit: emitSpy,
			getCurrentTask: vi.fn(() => ({ taskId: "c3" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		vi.mocked(readTaskMessages).mockResolvedValue([])
		vi.mocked(readApiMessages).mockResolvedValue([])

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "p3",
			childTaskId: "c3",
			completionResultSummary: "Summary",
		})

		// Verify both events emitted
		const eventNames = emitSpy.mock.calls.map((c) => c[0])
		expect(eventNames).toContain(RooCodeEventName.TaskDelegationCompleted)
		expect(eventNames).toContain(RooCodeEventName.TaskDelegationResumed)

		// CRITICAL: verify ordering (TaskDelegationCompleted before TaskDelegationResumed)
		const completedIdx = emitSpy.mock.calls.findIndex((c) => c[0] === RooCodeEventName.TaskDelegationCompleted)
		const resumedIdx = emitSpy.mock.calls.findIndex((c) => c[0] === RooCodeEventName.TaskDelegationResumed)
		expect(completedIdx).toBeGreaterThanOrEqual(0)
		expect(resumedIdx).toBeGreaterThan(completedIdx)
	})

	it("reopenParentFromDelegation does NOT emit TaskPaused or TaskUnpaused (new flow only)", async () => {
		const emitSpy = vi.fn()

		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "p4",
					status: "delegated",
					awaitingChildId: "c4",
					childIds: [],
					ts: 400,
					task: "P4",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				},
			}),
			emit: emitSpy,
			getCurrentTask: vi.fn(() => ({ taskId: "c4" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		vi.mocked(readTaskMessages).mockResolvedValue([])
		vi.mocked(readApiMessages).mockResolvedValue([])

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "p4",
			childTaskId: "c4",
			completionResultSummary: "S",
		})

		// CRITICAL: verify legacy pause/unpause events NOT emitted
		const eventNames = emitSpy.mock.calls.map((c) => c[0])
		expect(eventNames).not.toContain(RooCodeEventName.TaskPaused)
		expect(eventNames).not.toContain(RooCodeEventName.TaskUnpaused)
		expect(eventNames).not.toContain(RooCodeEventName.TaskSpawned)
	})

	it("handles empty history gracefully when injecting synthetic messages", async () => {
		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "p5",
					status: "delegated",
					awaitingChildId: "c5",
					childIds: [],
					ts: 500,
					task: "P5",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				},
			}),
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "c5" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		// Mock read failures or empty returns
		vi.mocked(readTaskMessages).mockResolvedValue([])
		vi.mocked(readApiMessages).mockResolvedValue([])

		await expect(
			(ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
				parentTaskId: "p5",
				childTaskId: "c5",
				completionResultSummary: "Result",
			}),
		).resolves.toBeUndefined()

		// Verify saves still occurred with just the injected message
		expect(saveTaskMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					expect.objectContaining({
						type: "say",
						say: "subtask_result",
					}),
				],
			}),
		)

		expect(saveApiMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					expect.objectContaining({
						role: "user",
					}),
				],
			}),
		)
	})
})
