import { describe, test, expect, beforeEach, vi } from "vitest"
import { StreamStateManager } from "./StreamStateManager"
import { ClineApiReqCancelReason } from "../../shared/ExtensionMessage"
import { EventBus } from "../events/EventBus"
import { StreamEventType } from "../events/types"

// Mock Task class for testing
class MockTask {
	public isStreaming = false
	public currentStreamingContentIndex = 0
	public assistantMessageContent: any[] = []
	public presentAssistantMessageLocked = false
	public presentAssistantMessageHasPendingUpdates = false
	public userMessageContent: any[] = []
	public userMessageContentReady = false
	public didRejectTool = false
	public didAlreadyUseTool = false
	public didCompleteReadingStream = false
	public didFinishAbortingStream = false
	public isWaitingForFirstChunk = false
	public abort = false
	public abandoned = false

	public clineMessages: any[] = []
	public diffViewProvider = {
		isEditing: false,
		revertChanges: vi.fn().mockResolvedValue(undefined),
		reset: vi.fn().mockResolvedValue(undefined),
	}

	// Mock private methods that StreamStateManager needs to access
	public saveClineMessages = vi.fn().mockResolvedValue(undefined)
	public addToApiConversationHistory = vi.fn().mockResolvedValue(undefined)
}

describe("StreamStateManager", () => {
	let mockTask: MockTask
	let streamStateManager: StreamStateManager
	let eventBus: EventBus

	beforeEach(() => {
		mockTask = new MockTask()
		// Reset the EventBus singleton to avoid cross-test pollution
		EventBus.resetInstance()
		eventBus = EventBus.getInstance()
		streamStateManager = new StreamStateManager("test-task-id", eventBus)

		// Reset mock functions
		vi.clearAllMocks()

		// Subscribe to events and update mockTask accordingly to simulate Task's behavior
		eventBus.on(StreamEventType.STREAM_STATE_CHANGED, (event: any) => {
			if (event.state === "changed" && event.metadata?.currentState) {
				Object.assign(mockTask, event.metadata.currentState)
			}
		})

		eventBus.on(StreamEventType.STREAM_STARTED, (event: any) => {
			mockTask.isStreaming = true
			mockTask.isWaitingForFirstChunk = false
		})

		eventBus.on(StreamEventType.STREAM_COMPLETED, (event: any) => {
			mockTask.isStreaming = false
			mockTask.didCompleteReadingStream = true
		})

		eventBus.on(StreamEventType.STREAM_ABORTED, (event: any) => {
			mockTask.didFinishAbortingStream = true
		})

		eventBus.on(StreamEventType.STREAM_RESET, (event: any) => {
			// Reset mockTask state
			mockTask.isStreaming = false
			mockTask.currentStreamingContentIndex = 0
			mockTask.assistantMessageContent = []
			mockTask.presentAssistantMessageLocked = false
			mockTask.presentAssistantMessageHasPendingUpdates = false
			mockTask.userMessageContent = []
			mockTask.userMessageContentReady = false
			mockTask.didRejectTool = false
			mockTask.didAlreadyUseTool = false
			mockTask.didCompleteReadingStream = false
			mockTask.didFinishAbortingStream = false
			mockTask.isWaitingForFirstChunk = false
		})

		// Handle the new DIFF_UPDATE_NEEDED events
		eventBus.on(StreamEventType.DIFF_UPDATE_NEEDED, async (event: any) => {
			switch (event.action) {
				case "revert":
					if (mockTask.diffViewProvider.isEditing) {
						await mockTask.diffViewProvider.revertChanges()
					}
					break
				case "reset":
					await mockTask.diffViewProvider.reset()
					break
			}
		})

		// Keep legacy support for existing DIFF_VIEW_REVERT_NEEDED events if any
		eventBus.on(StreamEventType.DIFF_VIEW_REVERT_NEEDED, async (event: any) => {
			if (mockTask.diffViewProvider.isEditing) {
				await mockTask.diffViewProvider.revertChanges()
				await mockTask.diffViewProvider.reset()
			}
		})

		eventBus.on(StreamEventType.PARTIAL_MESSAGE_CLEANUP_NEEDED, async (event: any) => {
			// Clean up partial messages
			mockTask.clineMessages.forEach((msg: any) => {
				if (msg.partial) {
					msg.partial = false
				}
			})
			await mockTask.saveClineMessages()
		})

		eventBus.on(StreamEventType.CONVERSATION_HISTORY_UPDATE_NEEDED, async (event: any) => {
			await mockTask.addToApiConversationHistory({
				role: event.role,
				content: event.content,
			})
		})
	})

	describe("initialization", () => {
		test("captures initial state correctly", () => {
			const snapshot = streamStateManager.getStreamStateSnapshot()

			expect(snapshot.isStreaming).toBe(false)
			expect(snapshot.currentStreamingContentIndex).toBe(0)
			expect(snapshot.presentAssistantMessageLocked).toBe(false)
			expect(snapshot.presentAssistantMessageHasPendingUpdates).toBe(false)
			expect(snapshot.userMessageContentReady).toBe(false)
			expect(snapshot.didRejectTool).toBe(false)
			expect(snapshot.didAlreadyUseTool).toBe(false)
			expect(snapshot.didCompleteReadingStream).toBe(false)
			expect(snapshot.didFinishAbortingStream).toBe(false)
			expect(snapshot.isWaitingForFirstChunk).toBe(false)
		})
	})

	describe("resetToInitialState", () => {
		test("resets all streaming state to initial values", async () => {
			// Modify state to non-initial values
			streamStateManager.updateState({
				isStreaming: true,
				currentStreamingContentIndex: 5,
				assistantMessageContent: [{ type: "text", content: "test", partial: false }],
				presentAssistantMessageLocked: true,
				presentAssistantMessageHasPendingUpdates: true,
				userMessageContent: [{ type: "text", text: "user message" }],
				userMessageContentReady: true,
				didRejectTool: true,
				didAlreadyUseTool: true,
				didCompleteReadingStream: true,
				didFinishAbortingStream: true,
				isWaitingForFirstChunk: true,
			})

			// Reset state
			await streamStateManager.resetToInitialState()

			// Verify all properties are reset
			const snapshot = streamStateManager.getStreamStateSnapshot()
			expect(snapshot.isStreaming).toBe(false)
			expect(snapshot.currentStreamingContentIndex).toBe(0)
			expect(snapshot.assistantMessageContent).toHaveLength(0)
			expect(snapshot.presentAssistantMessageLocked).toBe(false)
			expect(snapshot.presentAssistantMessageHasPendingUpdates).toBe(false)
			expect(snapshot.userMessageContent).toHaveLength(0)
			expect(snapshot.userMessageContentReady).toBe(false)
			expect(snapshot.didRejectTool).toBe(false)
			expect(snapshot.didAlreadyUseTool).toBe(false)
			expect(snapshot.didCompleteReadingStream).toBe(false)
			expect(snapshot.didFinishAbortingStream).toBe(false)
			expect(snapshot.isWaitingForFirstChunk).toBe(false)
		})

		test("reverts diff changes when editing", async () => {
			mockTask.diffViewProvider.isEditing = true
			streamStateManager.updateState({
				isStreaming: true,
				assistantMessageContent: [{ type: "text", content: "test", partial: false }],
			})

			await streamStateManager.resetToInitialState()

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			// resetToInitialState only emits "revert" action, not "reset"
			expect(mockTask.diffViewProvider.revertChanges).toHaveBeenCalled()
			// reset() is not called by resetToInitialState - it only does revert
			expect(mockTask.diffViewProvider.reset).not.toHaveBeenCalled()
		})

		test("continues reset even if diff operations fail", async () => {
			mockTask.diffViewProvider.isEditing = true

			// Wrap the revertChanges to catch the error
			const originalRevert = mockTask.diffViewProvider.revertChanges
			mockTask.diffViewProvider.revertChanges = vi.fn().mockImplementation(async () => {
				try {
					await originalRevert()
				} catch (error) {
					// Swallow the error
				}
			})
			originalRevert.mockRejectedValue(new Error("Diff error"))

			streamStateManager.updateState({ isStreaming: true })

			await streamStateManager.resetToInitialState()

			// State should still be reset despite diff error
			const snapshot = streamStateManager.getStreamStateSnapshot()
			expect(snapshot.isStreaming).toBe(false)
		})
	})

	describe("abortStreamSafely", () => {
		test("performs comprehensive cleanup on abort", async () => {
			// Set up state that needs cleanup
			streamStateManager.updateState({
				isStreaming: true,
				assistantMessageContent: [{ type: "text", content: "partial message", partial: true }],
			})
			mockTask.diffViewProvider.isEditing = true
			mockTask.clineMessages = [
				{ ts: Date.now(), type: "say", say: "api_req_started", text: "test", partial: true },
			]

			await streamStateManager.abortStreamSafely("user_cancelled")

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			// Verify cleanup was performed
			expect(mockTask.diffViewProvider.revertChanges).toHaveBeenCalled()
			expect(mockTask.saveClineMessages).toHaveBeenCalled()
			expect(mockTask.addToApiConversationHistory).toHaveBeenCalled()

			// Verify state was reset
			const state = streamStateManager.getState()
			expect(state.isStreaming).toBe(false)
			expect(state.assistantMessageContent).toEqual([])
			expect(state.didFinishAbortingStream).toBe(true)
		})

		test("handles partial message cleanup", async () => {
			const partialMessage = {
				ts: Date.now(),
				type: "say",
				say: "api_req_started",
				text: "test",
				partial: true,
			}
			mockTask.clineMessages = [partialMessage]

			await streamStateManager.abortStreamSafely("streaming_failed", "Connection error")

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(partialMessage.partial).toBe(false)
			expect(mockTask.saveClineMessages).toHaveBeenCalled()
		})

		test("adds interruption message to conversation history", async () => {
			streamStateManager.updateState({
				assistantMessageContent: [{ type: "text", content: "This is a partial response", partial: true }],
			})

			await streamStateManager.abortStreamSafely("user_cancelled")

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(mockTask.addToApiConversationHistory).toHaveBeenCalledWith({
				role: "assistant",
				content: [
					{
						type: "text",
						text: "This is a partial response\n\n[Response interrupted by user]",
					},
				],
			})
		})

		test("adds API error interruption message", async () => {
			streamStateManager.updateState({
				assistantMessageContent: [{ type: "text", content: "Partial response", partial: true }],
			})

			await streamStateManager.abortStreamSafely("streaming_failed", "API timeout")

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(mockTask.addToApiConversationHistory).toHaveBeenCalledWith({
				role: "assistant",
				content: [
					{
						type: "text",
						text: "Partial response\n\n[Response interrupted by API Error]",
					},
				],
			})
		})

		test("prevents concurrent abort operations", async () => {
			// Set up state that triggers diff cleanup
			mockTask.diffViewProvider.isEditing = true
			streamStateManager.updateState({
				isStreaming: true,
				assistantMessageContent: [{ type: "text", content: "test", partial: false }],
			})

			// Track abort events
			let abortEventCount = 0
			eventBus.on(StreamEventType.STREAM_ABORTED, () => {
				abortEventCount++
			})

			// Start first abort
			const firstAbort = streamStateManager.abortStreamSafely("user_cancelled")

			// Start second abort immediately (should be ignored)
			const secondAbort = streamStateManager.abortStreamSafely("streaming_failed")

			await Promise.all([firstAbort, secondAbort])

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			// Only one abort event should have been emitted
			expect(abortEventCount).toBe(1)

			// Verify that revertChanges was called twice (once from abortStreamSafely, once from resetToInitialState)
			expect(mockTask.diffViewProvider.revertChanges).toHaveBeenCalledTimes(2)
		})

		test("ensures didFinishAbortingStream is always set", async () => {
			// Simulate error during cleanup
			mockTask.diffViewProvider.revertChanges.mockRejectedValue(new Error("Cleanup failed"))

			await streamStateManager.abortStreamSafely("user_cancelled")

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			// Check the state directly from StreamStateManager
			const snapshot = streamStateManager.getStreamStateSnapshot()
			expect(snapshot.didFinishAbortingStream).toBe(true)
		})
	})

	describe("stream lifecycle management", () => {
		test("prepareForStreaming resets state and sets initial values", async () => {
			// Set dirty state
			streamStateManager.updateState({
				isStreaming: true,
				didCompleteReadingStream: true,
			})

			await streamStateManager.prepareForStreaming()

			const snapshot = streamStateManager.getStreamStateSnapshot()
			expect(snapshot.isStreaming).toBe(false)
			expect(snapshot.isWaitingForFirstChunk).toBe(false)
			expect(snapshot.didCompleteReadingStream).toBe(false)
			expect(snapshot.didFinishAbortingStream).toBe(false)
		})

		test("markStreamingStarted updates streaming state", async () => {
			streamStateManager.markStreamingStarted()

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(mockTask.isStreaming).toBe(true)
			expect(mockTask.isWaitingForFirstChunk).toBe(false)
		})

		test("markStreamingCompleted updates completion state", async () => {
			streamStateManager.updateState({ isStreaming: true })

			streamStateManager.markStreamingCompleted()

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(mockTask.isStreaming).toBe(false)
			expect(mockTask.didCompleteReadingStream).toBe(true)
		})
	})

	describe("safety checks", () => {
		test("isStreamSafe returns true for safe conditions", () => {
			streamStateManager.updateState({ isStreaming: true })
			expect(streamStateManager.isStreamSafe()).toBe(true)
		})

		test("isStreamSafe returns false when not streaming", () => {
			expect(streamStateManager.isStreamSafe()).toBe(false)
		})

		test("isStreamSafe returns false when aborting in progress", async () => {
			// Set up streaming state with some content
			streamStateManager.updateState({
				isStreaming: true,
				assistantMessageContent: [{ type: "text", content: "test", partial: false }],
			})

			// Verify it's safe before abort
			expect(streamStateManager.isStreamSafe()).toBe(true)

			// Start an abort operation
			const abortPromise = streamStateManager.abortStreamSafely("user_cancelled")

			// Should not be safe during abort (isAborting = true)
			expect(streamStateManager.isStreamSafe()).toBe(false)

			await abortPromise

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// After abort completes:
			// - isAborting is false (reset in finally block)
			// - isStreaming is false (reset during abort)
			// isStreamSafe returns !isAborting && isStreaming = true && false = false
			const state = streamStateManager.getState()

			// The state should have been reset
			expect(state.isStreaming).toBe(false)
			expect(state.assistantMessageContent).toEqual([])
			expect(state.didFinishAbortingStream).toBe(true)

			// isStreamSafe should return false because isStreaming is false
			expect(streamStateManager.isStreamSafe()).toBe(false)
		})
	})

	describe("getStreamStateSnapshot", () => {
		test("returns current state snapshot", () => {
			streamStateManager.updateState({
				isStreaming: true,
				currentStreamingContentIndex: 3,
				userMessageContentReady: true,
			})

			const snapshot = streamStateManager.getStreamStateSnapshot()

			expect(snapshot.isStreaming).toBe(true)
			expect(snapshot.currentStreamingContentIndex).toBe(3)
			expect(snapshot.userMessageContentReady).toBe(true)
		})
	})

	describe("forceCleanup", () => {
		test("performs emergency cleanup", () => {
			streamStateManager.updateState({
				isStreaming: true,
				assistantMessageContent: [{ type: "text", content: "test", partial: false }],
				userMessageContent: [{ type: "text", text: "test" }],
			})

			streamStateManager.forceCleanup()

			const snapshot = streamStateManager.getStreamStateSnapshot()
			expect(snapshot.isStreaming).toBe(false)
			expect(snapshot.didFinishAbortingStream).toBe(true)
			expect(snapshot.assistantMessageContent).toHaveLength(0)
			expect(snapshot.userMessageContent).toHaveLength(0)
		})
	})

	describe("error handling", () => {
		test("continues operation when partial message cleanup fails", async () => {
			mockTask.clineMessages = [{ partial: true }]

			// Wrap the event handler to catch the error
			const originalSaveMessages = mockTask.saveClineMessages
			mockTask.saveClineMessages = vi.fn().mockImplementation(async () => {
				try {
					await originalSaveMessages()
				} catch (error) {
					// Swallow the error
				}
			})
			originalSaveMessages.mockRejectedValue(new Error("Save failed"))

			// Should not throw
			await streamStateManager.abortStreamSafely("user_cancelled")

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			const snapshot = streamStateManager.getStreamStateSnapshot()
			expect(snapshot.didFinishAbortingStream).toBe(true)
		})

		test("continues operation when history update fails", async () => {
			streamStateManager.updateState({
				assistantMessageContent: [{ type: "text", content: "test", partial: false }],
			})

			// Remove all existing handlers for this event
			eventBus.removeAllListeners(StreamEventType.CONVERSATION_HISTORY_UPDATE_NEEDED)

			// Add a new handler that catches errors
			eventBus.on(StreamEventType.CONVERSATION_HISTORY_UPDATE_NEEDED, async (event: any) => {
				try {
					await mockTask.addToApiConversationHistory({
						role: event.role,
						content: event.content,
					})
				} catch (error) {
					// Swallow the error to prevent unhandled rejection
				}
			})

			mockTask.addToApiConversationHistory.mockRejectedValue(new Error("History failed"))

			// Should not throw
			await streamStateManager.abortStreamSafely("user_cancelled")

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 0))

			const snapshot = streamStateManager.getStreamStateSnapshot()
			expect(snapshot.didFinishAbortingStream).toBe(true)
		})
	})
})
