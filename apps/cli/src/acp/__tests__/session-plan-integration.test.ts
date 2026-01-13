/**
 * Integration tests for ACP Plan updates via session-event-handler.
 *
 * Tests the end-to-end flow of:
 * 1. Extension sending todo list update messages
 * 2. Session-event-handler detecting and translating them
 * 3. ACP plan updates being sent to the connection
 */

import type { ClineMessage } from "@roo-code/types"

import {
	SessionEventHandler,
	createSessionEventHandler,
	type SessionEventHandlerDeps,
} from "../session-event-handler.js"
import type { IAcpLogger, IDeltaTracker, IPromptStateMachine } from "../interfaces.js"
import { ToolHandlerRegistry } from "../tool-handler.js"

// =============================================================================
// Mock Setup
// =============================================================================

const createMockLogger = (): IAcpLogger => ({
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	request: vi.fn(),
	response: vi.fn(),
	notification: vi.fn(),
})

const createMockDeltaTracker = (): IDeltaTracker => ({
	getDelta: vi.fn().mockReturnValue(null),
	peekDelta: vi.fn().mockReturnValue(null),
	reset: vi.fn(),
	resetId: vi.fn(),
})

const createMockPromptState = (): IPromptStateMachine => ({
	getState: vi.fn().mockReturnValue("processing"),
	getAbortSignal: vi.fn().mockReturnValue(null),
	getPromptText: vi.fn().mockReturnValue(""),
	canStartPrompt: vi.fn().mockReturnValue(false),
	isProcessing: vi.fn().mockReturnValue(true), // Return true so messages are processed
	startPrompt: vi.fn().mockReturnValue(Promise.resolve({ stopReason: "end_turn" })),
	complete: vi.fn().mockReturnValue("end_turn"),
	transitionToComplete: vi.fn(),
	cancel: vi.fn(),
	reset: vi.fn(),
})

const createMockCommandStreamManager = () => ({
	handleExecutionOutput: vi.fn(),
	handleCommandOutput: vi.fn(),
	isCommandOutputMessage: vi.fn().mockReturnValue(false),
	trackCommand: vi.fn(),
	reset: vi.fn(),
})

const createMockToolContentStreamManager = () => ({
	handleToolContentStreaming: vi.fn(),
	isToolAskMessage: vi.fn().mockReturnValue(false),
	reset: vi.fn(),
})

const createMockExtensionClient = () => {
	const handlers: Record<string, ((data: unknown) => void)[]> = {}
	return {
		on: vi.fn((event: string, handler: (data: unknown) => void) => {
			handlers[event] = handlers[event] || []
			handlers[event]!.push(handler)
			return { on: vi.fn(), off: vi.fn() }
		}),
		off: vi.fn(),
		emit: (event: string, data: unknown) => {
			handlers[event]?.forEach((h) => h(data))
		},
		respond: vi.fn(),
		approve: vi.fn(),
		reject: vi.fn(),
	}
}

const createMockExtensionHost = () => ({
	on: vi.fn(),
	off: vi.fn(),
	client: createMockExtensionClient(),
	activate: vi.fn().mockResolvedValue(undefined),
	dispose: vi.fn().mockResolvedValue(undefined),
	sendToExtension: vi.fn(),
})

// =============================================================================
// Tests
// =============================================================================

describe("Session Plan Integration", () => {
	let eventHandler: SessionEventHandler
	let mockSendUpdate: ReturnType<typeof vi.fn>
	let mockClient: ReturnType<typeof createMockExtensionClient>
	let deps: SessionEventHandlerDeps

	beforeEach(() => {
		mockSendUpdate = vi.fn()
		mockClient = createMockExtensionClient()

		deps = {
			logger: createMockLogger(),
			client: mockClient,
			extensionHost: createMockExtensionHost(),
			promptState: createMockPromptState(),
			deltaTracker: createMockDeltaTracker(),
			commandStreamManager: createMockCommandStreamManager(),
			toolContentStreamManager: createMockToolContentStreamManager(),
			toolHandlerRegistry: new ToolHandlerRegistry(),
			sendUpdate: mockSendUpdate,
			approveAction: vi.fn(),
			respondWithText: vi.fn(),
			sendToExtension: vi.fn(),
			workspacePath: "/test/workspace",
			initialModeId: "code",
			isCancelling: vi.fn().mockReturnValue(false),
		}

		eventHandler = createSessionEventHandler(deps)
		eventHandler.setupEventHandlers()
	})

	describe("todo list message detection", () => {
		it("detects and sends plan update for updateTodoList tool ask message", () => {
			const todoMessage: ClineMessage = {
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [
						{ id: "1", content: "First task", status: "completed" },
						{ id: "2", content: "Second task", status: "in_progress" },
						{ id: "3", content: "Third task", status: "pending" },
					],
				}),
			}

			// Emit the message through the mock client
			mockClient.emit("message", todoMessage)

			// Verify plan update was sent
			expect(mockSendUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionUpdate: "plan",
					entries: expect.arrayContaining([
						expect.objectContaining({
							content: "First task",
							status: "completed",
							priority: expect.any(String),
						}),
						expect.objectContaining({
							content: "Second task",
							status: "in_progress",
							priority: "high", // in_progress gets high priority
						}),
						expect.objectContaining({
							content: "Third task",
							status: "pending",
							priority: expect.any(String),
						}),
					]),
				}),
			)
		})

		it("detects and sends plan update for user_edit_todos say message", () => {
			const editMessage: ClineMessage = {
				type: "say",
				say: "user_edit_todos",
				ts: Date.now(),
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [{ id: "1", content: "Edited task", status: "completed" }],
				}),
			}

			mockClient.emit("message", editMessage)

			expect(mockSendUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionUpdate: "plan",
					entries: [
						expect.objectContaining({
							content: "Edited task",
							status: "completed",
						}),
					],
				}),
			)
		})

		it("does not send plan update for other tool ask messages", () => {
			const otherToolMessage: ClineMessage = {
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				text: JSON.stringify({
					tool: "read_file",
					path: "/some/file.txt",
				}),
			}

			mockClient.emit("message", otherToolMessage)

			// Should not have sent a plan update (but may send other updates)
			const planUpdateCalls = mockSendUpdate.mock.calls.filter(
				(call) => (call[0] as { sessionUpdate?: string })?.sessionUpdate === "plan",
			)
			expect(planUpdateCalls).toHaveLength(0)
		})

		it("does not send plan update for empty todo list", () => {
			const emptyTodoMessage: ClineMessage = {
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [],
				}),
			}

			mockClient.emit("message", emptyTodoMessage)

			// Should not have sent a plan update for empty list
			const planUpdateCalls = mockSendUpdate.mock.calls.filter(
				(call) => (call[0] as { sessionUpdate?: string })?.sessionUpdate === "plan",
			)
			expect(planUpdateCalls).toHaveLength(0)
		})
	})

	describe("priority assignment", () => {
		it("assigns high priority to in_progress items", () => {
			const todoMessage: ClineMessage = {
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [
						{ id: "1", content: "Pending task", status: "pending" },
						{ id: "2", content: "In progress task", status: "in_progress" },
						{ id: "3", content: "Completed task", status: "completed" },
					],
				}),
			}

			mockClient.emit("message", todoMessage)

			const planUpdateCall = mockSendUpdate.mock.calls.find(
				(call) => (call[0] as { sessionUpdate?: string })?.sessionUpdate === "plan",
			)
			expect(planUpdateCall).toBeDefined()

			const entries = (planUpdateCall![0] as { entries: Array<{ content: string; priority: string }> }).entries
			const inProgressEntry = entries.find((e) => e.content === "In progress task")

			expect(inProgressEntry?.priority).toBe("high")
		})

		it("assigns medium priority to pending and completed items by default", () => {
			const todoMessage: ClineMessage = {
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [
						{ id: "1", content: "Pending task", status: "pending" },
						{ id: "2", content: "Completed task", status: "completed" },
					],
				}),
			}

			mockClient.emit("message", todoMessage)

			const planUpdateCall = mockSendUpdate.mock.calls.find(
				(call) => (call[0] as { sessionUpdate?: string })?.sessionUpdate === "plan",
			)
			expect(planUpdateCall).toBeDefined()

			const entries = (planUpdateCall![0] as { entries: Array<{ content: string; priority: string }> }).entries
			const pendingEntry = entries.find((e) => e.content === "Pending task")
			const completedEntry = entries.find((e) => e.content === "Completed task")

			expect(pendingEntry?.priority).toBe("medium")
			expect(completedEntry?.priority).toBe("medium")
		})
	})

	describe("message updates (streaming)", () => {
		it("sends plan update when message is updated", () => {
			const todoMessage: ClineMessage = {
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [{ id: "1", content: "Initial task", status: "pending" }],
				}),
			}

			// First message
			mockClient.emit("message", todoMessage)

			// Updated message with more todos
			const updatedMessage: ClineMessage = {
				...todoMessage,
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [
						{ id: "1", content: "Initial task", status: "completed" },
						{ id: "2", content: "New task", status: "pending" },
					],
				}),
			}

			mockClient.emit("messageUpdated", updatedMessage)

			// Should have sent 2 plan updates (one for each message)
			const planUpdateCalls = mockSendUpdate.mock.calls.filter(
				(call) => (call[0] as { sessionUpdate?: string })?.sessionUpdate === "plan",
			)
			expect(planUpdateCalls.length).toBeGreaterThanOrEqual(2)
		})
	})

	describe("logging", () => {
		it("sends plan updates without verbose logging", () => {
			const todoMessage: ClineMessage = {
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [{ id: "1", content: "Test task", status: "pending" }],
				}),
			}

			mockClient.emit("message", todoMessage)

			// Plan update should be sent without verbose logging
			const planUpdateCalls = mockSendUpdate.mock.calls.filter(
				(call) => (call[0] as { sessionUpdate?: string })?.sessionUpdate === "plan",
			)
			expect(planUpdateCalls).toHaveLength(1)
		})
	})

	describe("reset behavior", () => {
		it("continues to detect plan updates after reset", () => {
			const todoMessage: ClineMessage = {
				type: "ask",
				ask: "tool",
				ts: Date.now(),
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [{ id: "1", content: "Task 1", status: "pending" }],
				}),
			}

			mockClient.emit("message", todoMessage)
			mockSendUpdate.mockClear()

			// Reset the event handler
			eventHandler.reset()

			// Send another todo message
			const anotherMessage: ClineMessage = {
				...todoMessage,
				ts: Date.now() + 1,
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: [{ id: "2", content: "Task 2", status: "pending" }],
				}),
			}

			mockClient.emit("message", anotherMessage)

			// Should still detect and send plan update
			const planUpdateCalls = mockSendUpdate.mock.calls.filter(
				(call) => (call[0] as { sessionUpdate?: string })?.sessionUpdate === "plan",
			)
			expect(planUpdateCalls).toHaveLength(1)
		})
	})
})
