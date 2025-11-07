// npx vitest run __tests__/attempt-completion-delegation.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { RooCodeEventName } from "@roo-code/types"

/* vscode mock sufficient for importing Task and ClineProvider in unit tests */
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

// Mock persistence helpers used by provider reopen flow BEFORE importing provider
vi.mock("../core/task-persistence/taskMessages", () => ({
	readTaskMessages: vi.fn().mockResolvedValue([]),
}))
vi.mock("../core/task-persistence", () => ({
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
}))

import { attemptCompletionTool } from "../core/tools/attemptCompletionTool"
import { ClineProvider } from "../core/webview/ClineProvider"
import type { Task } from "../core/task/Task"
import { readTaskMessages } from "../core/task-persistence/taskMessages"
import { readApiMessages, saveApiMessages, saveTaskMessages } from "../core/task-persistence"

describe("attemptCompletionTool - metadata-driven completion", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it("Calls provider.reopenParentFromDelegation and does NOT call finishSubTask or emit legacy events", async () => {
		const provider = {
			reopenParentFromDelegation: vi.fn().mockResolvedValue(undefined),
			finishSubTask: vi.fn(),
		} as any

		const cline = {
			taskId: "child-1",
			parentTask: { taskId: "parent-1", emit: vi.fn() },
			providerRef: { deref: () => provider },
			say: vi.fn().mockResolvedValue(undefined),
			emit: vi.fn(),
			getTokenUsage: vi.fn(() => ({})),
			toolUsage: {},
			clineMessages: [],
			userMessageContent: [],
			consecutiveMistakeCount: 0,
		} as unknown as Task

		const block = {
			type: "tool_use",
			name: "attempt_completion",
			params: { result: "Child completed successfully" },
			partial: false,
		} as any

		const askApproval = vi.fn(async () => true)
		const handleError = vi.fn()
		const pushToolResult = vi.fn()
		const removeClosingTag = vi.fn((_k: string, v?: string) => v ?? "")
		const toolDescription = () => "desc"
		const askFinishSubTaskApproval = vi.fn(async () => true)

		await attemptCompletionTool(
			cline,
			block,
			askApproval,
			handleError,
			pushToolResult,
			removeClosingTag,
			toolDescription,
			askFinishSubTaskApproval,
		)

		expect(provider.reopenParentFromDelegation).toHaveBeenCalledWith({
			parentTaskId: "parent-1",
			childTaskId: "child-1",
			completionResultSummary: expect.stringContaining("Child completed successfully"),
		})

		// CRITICAL: legacy method NOT called in flag-ON path
		expect(provider.finishSubTask).not.toHaveBeenCalled()

		// CRITICAL: No TaskUnpaused event emitted (would be emitted by completeSubtask in legacy flow)
		const parentEmitted = (cline.parentTask as any).emit.mock.calls.map((c: any[]) => c[0])
		expect(parentEmitted).not.toContain(RooCodeEventName.TaskUnpaused)
	})

	it("Uses parentTaskId from metadata when parent reference is missing", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({ experiments: { metadataDrivenSubtasks: true } }),
			reopenParentFromDelegation: vi.fn().mockResolvedValue(undefined),
			finishSubTask: vi.fn(),
		} as any

		const cline = {
			taskId: "child-meta",
			// No live parent reference
			parentTask: undefined,
			// Persisted relationship
			parentTaskId: "parent-meta",
			historyItem: { parentTaskId: "parent-meta" },
			providerRef: { deref: () => provider },
			say: vi.fn().mockResolvedValue(undefined),
			emit: vi.fn(),
			getTokenUsage: vi.fn(() => ({})),
			toolUsage: {},
			clineMessages: [],
			userMessageContent: [],
			consecutiveMistakeCount: 0,
		} as unknown as Task

		const block = {
			type: "tool_use",
			name: "attempt_completion",
			params: { result: "Meta path summary" },
			partial: false,
		} as any

		const askFinishSubTaskApproval = vi.fn(async () => true)

		await attemptCompletionTool(
			cline,
			block,
			vi.fn(),
			vi.fn(),
			vi.fn(),
			vi.fn((_, v?: string) => v ?? ""),
			() => "desc",
			askFinishSubTaskApproval,
		)

		expect(provider.reopenParentFromDelegation).toHaveBeenCalledWith({
			parentTaskId: "parent-meta",
			childTaskId: "child-meta",
			completionResultSummary: expect.stringContaining("Meta path summary"),
		})
		expect(provider.finishSubTask).not.toHaveBeenCalled()
	})
})

describe("ClineProvider.reopenParentFromDelegation()", () => {
	it("persists metadata, injects histories, emits delegation events (NOT legacy pause events), closes child, reopens parent", async () => {
		const providerEmit = vi.fn()
		const removeClineFromStack = vi.fn().mockResolvedValue(undefined)
		const returnedParentInstance: any = {
			resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
		}
		const createTaskWithHistoryItem = vi.fn().mockResolvedValue({
			...returnedParentInstance,
			overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
			overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
		})
		const updateTaskHistory = vi.fn().mockResolvedValue(undefined)

		const mockHistoryItem = {
			id: "parent-1",
			number: 1,
			ts: Date.now(),
			task: "Parent task",
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
			mode: "code",
			workspace: "/tmp",
			childIds: [],
			awaitingChildId: "child-1",
		}

		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			getTaskWithId: vi.fn().mockResolvedValue({ historyItem: mockHistoryItem }),
			emit: providerEmit,
			getCurrentTask: vi.fn(() => ({ taskId: "child-1" })),
			removeClineFromStack,
			createTaskWithHistoryItem,
			updateTaskHistory,
		} as unknown as ClineProvider

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "parent-1",
			childTaskId: "child-1",
			completionResultSummary: "Child summary",
		})

		// Metadata persisted
		expect(updateTaskHistory).toHaveBeenCalledTimes(1)
		const saved = updateTaskHistory.mock.calls[0][0]
		expect(saved).toEqual(
			expect.objectContaining({
				id: "parent-1",
				status: "active",
				completedByChildId: "child-1",
				completionResultSummary: "Child summary",
				awaitingChildId: undefined,
				childIds: expect.arrayContaining(["child-1"]),
			}),
		)

		// Events emitted (NEW delegation events, NOT legacy pause/unpause)
		const eventNames = providerEmit.mock.calls.map((c: any[]) => c[0])
		expect(eventNames).toContain(RooCodeEventName.TaskDelegationCompleted)
		expect(eventNames).toContain(RooCodeEventName.TaskDelegationResumed)

		// CRITICAL: Legacy pause/unpause events NOT emitted in new flow
		expect(eventNames).not.toContain(RooCodeEventName.TaskPaused)
		expect(eventNames).not.toContain(RooCodeEventName.TaskUnpaused)

		// Child closed, parent reopened
		expect(removeClineFromStack).toHaveBeenCalledTimes(1)
		const firstCreateArgs = createTaskWithHistoryItem.mock.calls[0][0]
		expect(firstCreateArgs).toEqual(saved)

		// Auto-resume should be called
		expect(returnedParentInstance.resumeAfterDelegation).toHaveBeenCalledTimes(1)
	})
})

describe("Event ordering and history injection assertions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("reopenParentFromDelegation emits events in correct order: TaskDelegationCompleted → reopen → TaskDelegationResumed", async () => {
		const emitCalls: Array<{ event: string; order: number }> = []
		let callOrder = 0

		const providerEmit = vi.fn((event: string) => {
			emitCalls.push({ event, order: callOrder++ })
		})

		const createTaskWithHistoryItem = vi.fn(() => {
			emitCalls.push({ event: "createTaskWithHistoryItem", order: callOrder++ })
			return { taskId: "parent-1", resumeAfterDelegation: vi.fn().mockResolvedValue(undefined) }
		})

		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "delegated",
					awaitingChildId: "child-1",
					childIds: [],
					ts: 100,
					task: "Parent",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				},
			}),
			emit: providerEmit,
			getCurrentTask: vi.fn(() => ({ taskId: "child-1" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem,
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		vi.mocked(readTaskMessages).mockResolvedValue([])
		vi.mocked(readApiMessages).mockResolvedValue([])

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "parent-1",
			childTaskId: "child-1",
			completionResultSummary: "Summary",
		})

		// Verify event order
		const completedEvent = emitCalls.find((e) => e.event === RooCodeEventName.TaskDelegationCompleted)
		const reopenEvent = emitCalls.find((e) => e.event === "createTaskWithHistoryItem")
		const resumedEvent = emitCalls.find((e) => e.event === RooCodeEventName.TaskDelegationResumed)

		expect(completedEvent).toBeDefined()
		expect(reopenEvent).toBeDefined()
		expect(resumedEvent).toBeDefined()

		// CRITICAL: verify correct ordering
		expect(completedEvent!.order).toBeLessThan(reopenEvent!.order)
		expect(reopenEvent!.order).toBeLessThan(resumedEvent!.order)
	})

	it("reopenParentFromDelegation does NOT emit TaskPaused or TaskUnpaused", async () => {
		const emitSpy = vi.fn()

		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "p2",
					status: "delegated",
					awaitingChildId: "c2",
					childIds: [],
					ts: 200,
					task: "P",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				},
			}),
			emit: emitSpy,
			getCurrentTask: vi.fn(() => ({ taskId: "c2" })),
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
			parentTaskId: "p2",
			childTaskId: "c2",
			completionResultSummary: "S",
		})

		// CRITICAL: verify legacy pause/unpause events NOT emitted
		const eventNames = emitSpy.mock.calls.map((c) => c[0])
		expect(eventNames).not.toContain("TaskPaused")
		expect(eventNames).not.toContain("TaskUnpaused")
	})

	it("reopenParentFromDelegation injects parent API history with user role message", async () => {
		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/storage" } },
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
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "c3" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		const existingApiMessages = [{ role: "user", content: [{ type: "text", text: "Original" }], ts: 100 }]

		vi.mocked(readTaskMessages).mockResolvedValue([])
		vi.mocked(readApiMessages).mockResolvedValue(existingApiMessages as any)

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "p3",
			childTaskId: "c3",
			completionResultSummary: "Child result summary",
		})

		// Verify API history injection with user role
		expect(saveApiMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					expect.objectContaining({
						role: "user",
						content: expect.arrayContaining([
							expect.objectContaining({
								type: "text",
								text: expect.stringContaining("Subtask c3 completed"),
							}),
						]),
					}),
				]),
				taskId: "p3",
				globalStoragePath: "/storage",
			}),
		)

		// Verify the injected message contains the summary
		const apiCall = vi.mocked(saveApiMessages).mock.calls[0][0]
		const lastMessage = apiCall.messages[apiCall.messages.length - 1]
		const content = Array.isArray(lastMessage.content) ? lastMessage.content[0] : lastMessage.content
		expect(typeof content === "object" && "text" in content ? content.text : content).toContain("Result:")
		expect(typeof content === "object" && "text" in content ? content.text : content).toContain(
			"Child result summary",
		)
	})

	it("reopenParentFromDelegation injects parent UI history with say='subtask_result'", async () => {
		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/storage" } },
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
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "c4" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		const existingUiMessages = [{ type: "ask", ask: "tool", text: "Old", ts: 100 }]

		vi.mocked(readTaskMessages).mockResolvedValue(existingUiMessages as any)
		vi.mocked(readApiMessages).mockResolvedValue([])

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "p4",
			childTaskId: "c4",
			completionResultSummary: "UI summary text",
		})

		// Verify UI history injection with say='subtask_result'
		expect(saveTaskMessages).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					expect.objectContaining({
						type: "say",
						say: "subtask_result",
						text: "UI summary text",
					}),
				]),
				taskId: "p4",
				globalStoragePath: "/storage",
			}),
		)
	})

	it("reopenParentFromDelegation calls resumeAfterDelegation which handles task state", async () => {
		const resumeSpy = vi.fn().mockResolvedValue(undefined)
		const parentInstance: any = {
			taskId: "p5",
			resumeAfterDelegation: resumeSpy,
			overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
			overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
		}

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
			createTaskWithHistoryItem: vi.fn().mockResolvedValue(parentInstance),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		vi.mocked(readTaskMessages).mockResolvedValue([])
		vi.mocked(readApiMessages).mockResolvedValue([])

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "p5",
			childTaskId: "c5",
			completionResultSummary: "Summary",
		})

		// CRITICAL: verify resumeAfterDelegation called
		expect(resumeSpy).toHaveBeenCalledTimes(1)
	})

	it("history injection preserves existing messages and appends new synthetic messages", async () => {
		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/storage" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "p6",
					status: "delegated",
					awaitingChildId: "c6",
					childIds: [],
					ts: 600,
					task: "P6",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				},
			}),
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "c6" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		const existingUiMessages = [
			{ type: "say", say: "text", text: "Message 1", ts: 50 },
			{ type: "say", say: "text", text: "Message 2", ts: 100 },
		]

		const existingApiMessages = [
			{ role: "user", content: [{ type: "text", text: "API 1" }], ts: 50 },
			{ role: "assistant", content: [{ type: "text", text: "API 2" }], ts: 100 },
		]

		vi.mocked(readTaskMessages).mockResolvedValue(existingUiMessages as any)
		vi.mocked(readApiMessages).mockResolvedValue(existingApiMessages as any)

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "p6",
			childTaskId: "c6",
			completionResultSummary: "Result",
		})

		// Verify UI messages: original + 1 new
		const uiCall = vi.mocked(saveTaskMessages).mock.calls[0][0]
		expect(uiCall.messages).toHaveLength(3)
		expect(uiCall.messages[0]).toEqual(existingUiMessages[0])
		expect(uiCall.messages[1]).toEqual(existingUiMessages[1])
		expect(uiCall.messages[2]).toEqual(
			expect.objectContaining({
				type: "say",
				say: "subtask_result",
			}),
		)

		// Verify API messages: original + 1 new
		const apiCall = vi.mocked(saveApiMessages).mock.calls[0][0]
		expect(apiCall.messages).toHaveLength(3)
		expect(apiCall.messages[0]).toEqual(existingApiMessages[0])
		expect(apiCall.messages[1]).toEqual(existingApiMessages[1])
		expect(apiCall.messages[2]).toEqual(
			expect.objectContaining({
				role: "user",
			}),
		)
	})
})

describe("Parent auto-resume after delegation (no resume ask)", () => {
	it("reopenParentFromDelegation calls resumeAfterDelegation() instead of showing resume_task ask", async () => {
		const resumeAfterDelegationSpy = vi.fn().mockResolvedValue(undefined)
		const parentInstance: any = {
			taskId: "parent-7",
			resumeAfterDelegation: resumeAfterDelegationSpy,
			overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
			overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			skipPrevResponseIdOnce: false,
		}

		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "parent-7",
					status: "delegated",
					awaitingChildId: "child-7",
					childIds: [],
					ts: 700,
					task: "P7",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
					mode: "code",
				},
			}),
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "child-7" })),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue(parentInstance),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
		} as unknown as ClineProvider

		vi.mocked(readTaskMessages).mockResolvedValue([])
		vi.mocked(readApiMessages).mockResolvedValue([])

		await (ClineProvider.prototype as any).reopenParentFromDelegation.call(provider, {
			parentTaskId: "parent-7",
			childTaskId: "child-7",
			completionResultSummary: "Auto-resume test",
		})

		// CRITICAL: resumeAfterDelegation must be called (auto-continue)
		expect(resumeAfterDelegationSpy).toHaveBeenCalledTimes(1)

		// Parent should not show resume_task ask - it should auto-continue
		expect(parentInstance.resumeAfterDelegation).toHaveBeenCalled()
	})

	it("resumeAfterDelegation clears ask states and calls initiateTaskLoop", async () => {
		const initiateTaskLoopSpy = vi.fn().mockResolvedValue(undefined)
		const emitSpy = vi.fn()

		const task: any = {
			taskId: "test-task",
			idleAsk: { type: "ask", ask: "some_ask", ts: 100 },
			resumableAsk: { type: "ask", ask: "resume_task", ts: 200 },
			interactiveAsk: undefined,
			abort: false,
			abandoned: false,
			abortReason: undefined,
			didFinishAbortingStream: false,
			isStreaming: false,
			isWaitingForFirstChunk: false,
			skipPrevResponseIdOnce: false,
			isInitialized: false,
			emit: emitSpy,
			initiateTaskLoop: initiateTaskLoopSpy,
			getSavedApiConversationHistory: vi.fn().mockResolvedValue([]),
			apiConversationHistory: [],
		}

		// Import Task class to access the method
		const { Task } = await import("../core/task/Task")
		await Task.prototype.resumeAfterDelegation.call(task)

		// Verify ask states cleared
		expect(task.idleAsk).toBeUndefined()
		expect(task.resumableAsk).toBeUndefined()
		expect(task.interactiveAsk).toBeUndefined()

		// Verify abort state reset
		expect(task.abort).toBe(false)
		expect(task.abandoned).toBe(false)
		expect(task.abortReason).toBeUndefined()
		expect(task.didFinishAbortingStream).toBe(false)
		expect(task.isStreaming).toBe(false)
		expect(task.isWaitingForFirstChunk).toBe(false)

		// Verify skipPrevResponseIdOnce set
		expect(task.skipPrevResponseIdOnce).toBe(true)

		// Verify initialized and active
		expect(task.isInitialized).toBe(true)
		expect(emitSpy).toHaveBeenCalledWith(RooCodeEventName.TaskActive, "test-task")

		// Verify initiateTaskLoop called
		expect(initiateTaskLoopSpy).toHaveBeenCalledWith([
			expect.objectContaining({
				type: "text",
				text: expect.stringContaining("DELEGATION RESUMED"),
			}),
		])
	})
})

describe("Delegation reopen suppresses resume ask scheduling", () => {
	it("createTaskWithHistoryItem called with startTask=false (no resume_task ask scheduled)", async () => {
		const consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		const provider = {
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: {
					id: "parent-8",
					status: "delegated",
					awaitingChildId: "child-8",
					childIds: [],
					ts: Date.now(),
					task: "P8",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
					mode: "code",
					workspace: "/tmp",
				},
			}),
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => ({ taskId: "child-8" })),
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
			parentTaskId: "parent-8",
			childTaskId: "child-8",
			completionResultSummary: "Summary",
		})

		expect((provider as any).createTaskWithHistoryItem).toHaveBeenCalled()
		const call = (provider as any).createTaskWithHistoryItem.mock.calls[0]
		expect(call[1]).toEqual(expect.objectContaining({ startTask: false }))

		// Assert no noisy ignored-ask error was logged
		const hadIgnoredAskError = consoleErrSpy.mock.calls.some((args) =>
			args.some((a) => typeof a === "string" && a.includes("Current ask promise was ignored")),
		)
		expect(hadIgnoredAskError).toBe(false)
		consoleErrSpy.mockRestore()
	})
})
