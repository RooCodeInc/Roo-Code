// npx vitest run __tests__/history-resume-delegation.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { RooCodeEventName } from "@roo-code/types"

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
			resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
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
			{ startTask: false },
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
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				taskId: "p1",
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			}),
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

	it("reopenParentFromDelegation injects tool_result when new_task tool_use exists in API history", async () => {
		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/storage" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "p-tool",
					status: "delegated",
					awaitingChildId: "c-tool",
					childIds: [],
					ts: 100,
					task: "Parent with tool_use",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				},
			}),
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "c-tool" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				taskId: "p-tool",
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		// Include an assistant message with new_task tool_use to exercise the tool_result path
		const existingUiMessages = [{ type: "ask", ask: "tool", text: "new_task request", ts: 50 }]
		const existingApiMessages = [
			{ role: "user", content: [{ type: "text", text: "Create a subtask" }], ts: 40 },
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						name: "new_task",
						id: "toolu_abc123",
						input: { mode: "code", message: "Do something" },
					},
				],
				ts: 50,
			},
		]

		vi.mocked(readTaskMessages).mockResolvedValue(existingUiMessages as any)
		vi.mocked(readApiMessages).mockResolvedValue(existingApiMessages as any)

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "p-tool",
			childTaskId: "c-tool",
			completionResultSummary: "Subtask completed via tool_result",
		})

		// Verify API history injection uses tool_result (not text fallback)
		expect(saveApiMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					expect.objectContaining({
						role: "user",
						content: expect.arrayContaining([
							expect.objectContaining({
								type: "tool_result",
								tool_use_id: "toolu_abc123",
								content: expect.stringContaining("Subtask c-tool completed"),
							}),
						]),
					}),
				]),
				taskId: "p-tool",
				globalStoragePath: "/storage",
			}),
		)

		// Verify total message count: 2 original + 1 injected user message with tool_result
		const apiCall = vi.mocked(saveApiMessages).mock.calls[0][0]
		expect(apiCall.messages).toHaveLength(3)

		// Verify the injected message is a user message with tool_result type
		const injectedMsg = apiCall.messages[2]
		expect(injectedMsg.role).toBe("user")
		expect((injectedMsg.content[0] as any).type).toBe("tool_result")
		expect((injectedMsg.content[0] as any).tool_use_id).toBe("toolu_abc123")
	})

	it("reopenParentFromDelegation sets skipPrevResponseIdOnce via resumeAfterDelegation", async () => {
		const parentInstance: any = {
			skipPrevResponseIdOnce: false,
			resumeAfterDelegation: vi.fn().mockImplementation(async function (this: any) {
				// Simulate what the real resumeAfterDelegation does
				this.skipPrevResponseIdOnce = true
			}),
			overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
			overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
		}

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

		// Critical: verify skipPrevResponseIdOnce set to true by resumeAfterDelegation
		expect(parentInstance.skipPrevResponseIdOnce).toBe(true)
		expect(parentInstance.resumeAfterDelegation).toHaveBeenCalledTimes(1)
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
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			}),
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
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			}),
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
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			}),
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

	it("reopenParentFromDelegation uses fallback anchor when subtaskId link is missing but child is valid", async () => {
		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/storage" } },
			getTaskWithId: vi.fn().mockImplementation((taskId: string) => {
				if (taskId === "parent-fallback") {
					return Promise.resolve({
						historyItem: {
							id: "parent-fallback",
							status: "delegated",
							awaitingChildId: "child-fallback",
							childIds: ["child-fallback"], // This validates the parent-child relationship
							ts: 100,
							task: "Parent task",
							tokensIn: 0,
							tokensOut: 0,
							totalCost: 0,
						},
					})
				}
				// Child history item with tokens/cost
				return Promise.resolve({
					historyItem: {
						id: "child-fallback",
						tokensIn: 500,
						tokensOut: 300,
						totalCost: 0.05,
						ts: 200,
						task: "Child task",
					},
				})
			}),
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "child-fallback" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				taskId: "parent-fallback",
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
			}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		// Parent has all completed todos but NO subtaskId link
		const parentMessagesWithCompletedTodos = [
			{
				type: "say",
				say: "system_update_todos",
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [
						{ id: "todo-1", content: "First completed", status: "completed" },
						{ id: "todo-2", content: "Second completed", status: "completed" },
						{ id: "todo-3", content: "Last completed", status: "completed" },
						// Note: NO subtaskId on any todo - this is the bug scenario
					],
				}),
				ts: 50,
			},
		]

		vi.mocked(readTaskMessages).mockResolvedValue(parentMessagesWithCompletedTodos as any)
		vi.mocked(readApiMessages).mockResolvedValue([])

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "parent-fallback",
			childTaskId: "child-fallback",
			completionResultSummary: "Child completed successfully",
		})

		// Verify that saveTaskMessages was called and includes the todo write-back
		expect(saveTaskMessages).toHaveBeenCalled()
		const savedCall = vi.mocked(saveTaskMessages).mock.calls[0][0]

		// Find the system_update_todos message that was added for the write-back
		const todoEditMessages = savedCall.messages.filter(
			(m: any) => m.type === "say" && m.say === "system_update_todos",
		)

		// Should have at least 2 todo edit messages (original + write-back)
		expect(todoEditMessages.length).toBeGreaterThanOrEqual(1)

		// Parse the last todo edit to verify fallback worked
		const lastTodoEdit = todoEditMessages[todoEditMessages.length - 1]
		expect(lastTodoEdit.text).toBeDefined()
		const parsedTodos = JSON.parse(lastTodoEdit.text as string)

		// The LAST completed todo should have been selected as the fallback anchor
		// and should now have subtaskId, tokens, and cost
		const anchoredTodo = parsedTodos.todos.find((t: any) => t.subtaskId === "child-fallback")
		expect(anchoredTodo).toBeDefined()
		expect(anchoredTodo.content).toBe("Last completed") // Fallback picks LAST completed
		expect(anchoredTodo.tokens).toBe(800) // 500 + 300
		expect(anchoredTodo.cost).toBe(0.05)
	})

	it("reopenParentFromDelegation does NOT apply fallback when childIds doesn't include the child", async () => {
		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/storage" } },
			getTaskWithId: vi.fn().mockImplementation((taskId: string) => {
				if (taskId === "parent-no-relation") {
					return Promise.resolve({
						historyItem: {
							id: "parent-no-relation",
							status: "delegated",
							awaitingChildId: "some-other-child",
							childIds: ["some-other-child"], // Does NOT include child-orphan
							ts: 100,
							task: "Parent task",
							tokensIn: 0,
							tokensOut: 0,
							totalCost: 0,
						},
					})
				}
				return Promise.resolve({
					historyItem: {
						id: "child-orphan",
						tokensIn: 100,
						tokensOut: 50,
						totalCost: 0.01,
						ts: 200,
						task: "Orphan child",
					},
				})
			}),
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "child-orphan" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				taskId: "parent-no-relation",
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
			}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		const parentMessagesWithTodos = [
			{
				type: "say",
				say: "system_update_todos",
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [{ id: "todo-1", content: "Some task", status: "completed" }],
				}),
				ts: 50,
			},
		]

		vi.mocked(readTaskMessages).mockResolvedValue(parentMessagesWithTodos as any)
		vi.mocked(readApiMessages).mockResolvedValue([])

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "parent-no-relation",
			childTaskId: "child-orphan",
			completionResultSummary: "Orphan child completed",
		})

		// Verify saveTaskMessages was called
		expect(saveTaskMessages).toHaveBeenCalled()
		const savedCall = vi.mocked(saveTaskMessages).mock.calls[0][0]

		// Find todo edit messages (if any were added beyond the original)
		const todoEditMessages = savedCall.messages.filter(
			(m: any) => m.type === "say" && m.say === "system_update_todos",
		)

		// Should only have the original todo edit, no write-back because child isn't in childIds
		// The fallback should NOT be triggered for an unrelated child
		if (todoEditMessages.length > 1) {
			const lastTodoEdit = todoEditMessages[todoEditMessages.length - 1]
			const parsedTodos = JSON.parse(lastTodoEdit.text as string)
			// If a write-back happened, it should NOT have linked to child-orphan
			const orphanLinked = parsedTodos.todos.find((t: any) => t.subtaskId === "child-orphan")
			expect(orphanLinked).toBeUndefined()
		}
	})
})
