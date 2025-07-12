import { Anthropic } from "@anthropic-ai/sdk"
import type { AssistantMessageContent } from "../assistant-message"
import { ClineApiReqCancelReason } from "../../shared/ExtensionMessage"
import { EventBus } from "../events/EventBus"
import {
	StreamEventType,
	StreamAbortEvent,
	StreamResetEvent,
	StreamStateChangeEvent,
	UIUpdateEvent,
	PartialMessageCleanupEvent,
	ConversationHistoryUpdateEvent,
	DiffUpdateEvent,
} from "../events/types"

/**
 * StreamState - Interface defining all streaming-related state properties
 */
export interface StreamState {
	isStreaming: boolean
	currentStreamingContentIndex: number
	assistantMessageContent: AssistantMessageContent[]
	presentAssistantMessageLocked: boolean
	presentAssistantMessageHasPendingUpdates: boolean
	userMessageContent: Anthropic.Messages.ContentBlockParam[]
	userMessageContentReady: boolean
	didRejectTool: boolean
	didAlreadyUseTool: boolean
	didCompleteReadingStream: boolean
	didFinishAbortingStream: boolean
	isWaitingForFirstChunk: boolean
}

/**
 * StreamStateManager - Manages comprehensive stream state during API calls
 *
 * This class provides atomic stream state management to prevent corruption during
 * retry cycles, ensuring proper cleanup and coordination between streaming operations.
 *
 * Now uses EventBus for communication to break circular dependencies with Task.
 */
export class StreamStateManager {
	private taskId: string
	private state: StreamState
	private initialState: StreamState
	private isAborting: boolean = false
	private eventBus: EventBus

	constructor(taskId: string, eventBus?: EventBus) {
		this.taskId = taskId
		this.eventBus = eventBus || EventBus.getInstance()

		// Initialize state
		this.initialState = {
			isStreaming: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [],
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			userMessageContent: [],
			userMessageContentReady: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			didCompleteReadingStream: false,
			didFinishAbortingStream: false,
			isWaitingForFirstChunk: false,
		}

		// Create a deep copy for the current state
		this.state = { ...this.initialState }
	}

	/**
	 * Get the event bus for subscribing to events
	 */
	getEventBus(): EventBus {
		return this.eventBus
	}

	/**
	 * Get the current stream state
	 */
	getState(): Readonly<StreamState> {
		return { ...this.state }
	}

	/**
	 * Update specific state properties
	 */
	updateState(updates: Partial<StreamState>): void {
		const previousState = { ...this.state }
		this.state = { ...this.state, ...updates }

		// Emit state change event
		this.emitStateChangeEvent("changed", { previousState, currentState: this.state })
	}

	/**
	 * Atomically reset all streaming state to initial clean state
	 */
	async resetToInitialState(): Promise<void> {
		try {
			// Emit event to request diff view revert if needed
			if (this.state.isStreaming || this.state.assistantMessageContent.length > 0) {
				this.emitDiffUpdateEvent("revert")
			}

			// Reset state to initial values
			this.state = { ...this.initialState }

			// Clear arrays
			this.state.assistantMessageContent = []
			this.state.userMessageContent = []

			// Emit reset event
			this.emitResetEvent("State reset to initial")
		} catch (error) {
			console.error("Error resetting stream state:", error)
			// Continue with state reset even if event emission fails
			this.state = { ...this.initialState }
			this.state.assistantMessageContent = []
			this.state.userMessageContent = []
		}
	}

	/**
	 * Safely abort a stream with comprehensive cleanup
	 */
	async abortStreamSafely(cancelReason: ClineApiReqCancelReason, streamingFailedMessage?: string): Promise<void> {
		// Prevent concurrent abort operations
		if (this.isAborting) {
			return
		}

		this.isAborting = true
		this.state.didFinishAbortingStream = false

		try {
			// Emit event to revert any pending changes
			this.emitDiffUpdateEvent("revert")

			// Handle partial messages
			await this.handlePartialMessageCleanup()

			// Reconstruct assistant message for interruption
			let assistantMessage = ""
			for (const content of this.state.assistantMessageContent) {
				if (content.type === "text") {
					assistantMessage += content.content
				}
			}

			// Emit event to add interruption to history
			if (assistantMessage) {
				this.emitConversationHistoryUpdateEvent(cancelReason, assistantMessage)
			}

			// Emit abort event
			this.emitAbortEvent(cancelReason, streamingFailedMessage, assistantMessage)

			// Reset stream state
			await this.resetToInitialState()
		} catch (error) {
			console.error("Error during stream abort:", error)
			// Ensure state is reset even if cleanup fails
			await this.resetToInitialState()
		} finally {
			// Always mark as finished aborting and reset abort flag
			this.state.didFinishAbortingStream = true
			this.isAborting = false
		}
	}

	/**
	 * Handle cleanup of partial messages
	 */
	private async handlePartialMessageCleanup(): Promise<void> {
		// Emit event for partial message cleanup
		// The Task will handle the actual cleanup
		this.emitPartialMessageCleanupEvent()
	}

	/**
	 * Prepare for a new streaming operation
	 */
	async prepareForStreaming(): Promise<void> {
		// Ensure clean state before starting new stream
		await this.resetToInitialState()

		// Set initial streaming state
		this.updateState({
			isStreaming: false,
			isWaitingForFirstChunk: false,
			didCompleteReadingStream: false,
			didFinishAbortingStream: false,
		})
	}

	/**
	 * Mark streaming as started
	 */
	markStreamingStarted(): void {
		this.updateState({
			isStreaming: true,
			isWaitingForFirstChunk: false,
		})
		this.emitStateChangeEvent("started")
	}

	/**
	 * Mark streaming as completed
	 */
	markStreamingCompleted(): void {
		this.updateState({
			isStreaming: false,
			didCompleteReadingStream: true,
		})
		this.emitStateChangeEvent("completed")
	}

	/**
	 * Check if stream is in a safe state for operations
	 */
	isStreamSafe(): boolean {
		return !this.isAborting && this.state.isStreaming
	}

	/**
	 * Get current stream state snapshot for debugging
	 */
	getStreamStateSnapshot(): Partial<StreamState> {
		return { ...this.state }
	}

	/**
	 * Force cleanup - for emergency situations
	 * @internal
	 */
	forceCleanup(): void {
		this.isAborting = false
		this.state.isStreaming = false
		this.state.didFinishAbortingStream = true
		this.state.assistantMessageContent = []
		this.state.userMessageContent = []
	}

	// Event emission methods

	private emitStateChangeEvent(
		state: "started" | "completed" | "aborted" | "reset" | "changed",
		metadata?: any,
	): void {
		const event: StreamStateChangeEvent = {
			taskId: this.taskId,
			timestamp: Date.now(),
			state,
			metadata,
		}
		this.eventBus.emitEvent(StreamEventType.STREAM_STATE_CHANGED, event)

		// Also emit specific events
		switch (state) {
			case "started":
				this.eventBus.emitEvent(StreamEventType.STREAM_STARTED, event)
				break
			case "completed":
				this.eventBus.emitEvent(StreamEventType.STREAM_COMPLETED, event)
				break
		}
	}

	private emitAbortEvent(
		cancelReason: ClineApiReqCancelReason,
		streamingFailedMessage?: string,
		assistantMessage?: string,
	): void {
		const event: StreamAbortEvent = {
			taskId: this.taskId,
			timestamp: Date.now(),
			cancelReason,
			streamingFailedMessage,
			assistantMessage,
		}
		this.eventBus.emitEvent(StreamEventType.STREAM_ABORTED, event)
	}

	private emitResetEvent(reason?: string): void {
		const event: StreamResetEvent = {
			taskId: this.taskId,
			timestamp: Date.now(),
			reason,
		}
		this.eventBus.emitEvent(StreamEventType.STREAM_RESET, event)
	}

	private emitUIUpdateEvent(type: "diff_view_update" | "diff_view_revert" | "message_update", data?: any): void {
		const event: UIUpdateEvent = {
			taskId: this.taskId,
			timestamp: Date.now(),
			type,
			data,
		}

		if (type === "diff_view_revert") {
			this.eventBus.emitEvent(StreamEventType.DIFF_VIEW_REVERT_NEEDED, event)
		} else {
			this.eventBus.emitEvent(StreamEventType.DIFF_VIEW_UPDATE_NEEDED, event)
		}
	}

	private emitPartialMessageCleanupEvent(): void {
		const event: PartialMessageCleanupEvent = {
			taskId: this.taskId,
			timestamp: Date.now(),
			messageIndex: -1, // Task will determine the actual index
			message: null,
		}
		this.eventBus.emitEvent(StreamEventType.PARTIAL_MESSAGE_CLEANUP_NEEDED, event)
	}

	private emitConversationHistoryUpdateEvent(interruptionReason: string, assistantMessage: string): void {
		const event: ConversationHistoryUpdateEvent = {
			taskId: this.taskId,
			timestamp: Date.now(),
			role: "assistant",
			content: [
				{
					type: "text",
					text:
						assistantMessage +
						`\n\n[${
							interruptionReason === "streaming_failed"
								? "Response interrupted by API Error"
								: "Response interrupted by user"
						}]`,
				},
			],
			interruptionReason,
		}
		this.eventBus.emitEvent(StreamEventType.CONVERSATION_HISTORY_UPDATE_NEEDED, event)
	}

	private emitDiffUpdateEvent(
		action: "apply" | "revert" | "reset" | "show" | "hide",
		filePath?: string,
		metadata?: Record<string, any>,
	): void {
		const event: DiffUpdateEvent = {
			taskId: this.taskId,
			timestamp: Date.now(),
			action,
			filePath,
			metadata,
		}
		this.eventBus.emitEvent(StreamEventType.DIFF_UPDATE_NEEDED, event)
	}
}
