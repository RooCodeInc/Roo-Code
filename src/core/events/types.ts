import { ClineApiReqCancelReason } from "../../shared/ExtensionMessage"

/**
 * Event types for stream state management
 */
export enum StreamEventType {
	// Stream state change events
	STREAM_STATE_CHANGED = "stream:state:changed",
	STREAM_STARTED = "stream:started",
	STREAM_COMPLETED = "stream:completed",
	STREAM_ABORTED = "stream:aborted",
	STREAM_RESET = "stream:reset",

	// Stream data events
	STREAM_CHUNK = "stream:chunk",
	STREAM_ERROR = "stream:error",

	// UI update events
	DIFF_VIEW_UPDATE_NEEDED = "diff:view:update",
	DIFF_VIEW_REVERT_NEEDED = "diff:view:revert",

	// Abort request events
	ABORT_REQUESTED = "stream:abort:requested",

	// Message events
	PARTIAL_MESSAGE_CLEANUP_NEEDED = "message:partial:cleanup",
	CONVERSATION_HISTORY_UPDATE_NEEDED = "conversation:history:update",

	// State synchronization events
	STREAM_STATE_SYNC_NEEDED = "stream:state:sync",

	// New UI-specific events for Phase 4
	DIFF_UPDATE_NEEDED = "ui:diff:update",
	TASK_PROGRESS_UPDATE = "ui:task:progress",
	ERROR_DISPLAY_NEEDED = "ui:error:display",
}

/**
 * Base event data interface
 */
export interface BaseEventData {
	taskId: string
	timestamp: number
}

/**
 * Stream state change event data
 */
export interface StreamStateChangeEvent extends BaseEventData {
	state: "started" | "completed" | "aborted" | "reset" | "changed"
	metadata?: Record<string, any>
}

/**
 * Stream abort event data
 */
export interface StreamAbortEvent extends BaseEventData {
	cancelReason: ClineApiReqCancelReason
	streamingFailedMessage?: string
	assistantMessage?: string
}

/**
 * Stream reset event data
 */
export interface StreamResetEvent extends BaseEventData {
	reason?: string
}

/**
 * UI update event data
 */
export interface UIUpdateEvent extends BaseEventData {
	type: "diff_view_update" | "diff_view_revert" | "message_update"
	data?: any
}

/**
 * Partial message cleanup event data
 */
export interface PartialMessageCleanupEvent extends BaseEventData {
	messageIndex: number
	message: any
}

/**
 * Conversation history update event data
 */
export interface ConversationHistoryUpdateEvent extends BaseEventData {
	role: "assistant" | "user"
	content: any[]
	interruptionReason?: string
}

/**
 * Stream chunk event data
 */
export interface StreamChunkEvent extends BaseEventData {
	chunk: any
}

/**
 * Stream error event data
 */
export interface StreamErrorEvent extends BaseEventData {
	error: Error
	context?: string
}

/**
 * Diff update event data - for requesting diff view updates
 */
export interface DiffUpdateEvent extends BaseEventData {
	filePath?: string
	action: "apply" | "revert" | "reset" | "show" | "hide"
	content?: string
	lineNumber?: number
	metadata?: Record<string, any>
}

/**
 * Task progress event data - for displaying progress updates
 */
export interface TaskProgressEvent extends BaseEventData {
	stage: "starting" | "processing" | "completing" | "error" | "cancelled"
	progress?: number // 0-100 percentage
	message?: string
	tool?: string
	metadata?: Record<string, any>
}

/**
 * Error display event data - for showing error messages to user
 */
export interface ErrorDisplayEvent extends BaseEventData {
	error: Error | string
	severity: "info" | "warning" | "error" | "critical"
	category: "api" | "tool" | "system" | "validation" | "retry"
	context?: string
	retryable?: boolean
	metadata?: Record<string, any>
}

/**
 * Type mapping for events
 */
export interface StreamEventMap {
	[StreamEventType.STREAM_STATE_CHANGED]: StreamStateChangeEvent
	[StreamEventType.STREAM_STARTED]: StreamStateChangeEvent
	[StreamEventType.STREAM_COMPLETED]: StreamStateChangeEvent
	[StreamEventType.STREAM_ABORTED]: StreamAbortEvent
	[StreamEventType.STREAM_RESET]: StreamResetEvent
	[StreamEventType.STREAM_CHUNK]: StreamChunkEvent
	[StreamEventType.STREAM_ERROR]: StreamErrorEvent
	[StreamEventType.DIFF_VIEW_UPDATE_NEEDED]: UIUpdateEvent
	[StreamEventType.DIFF_VIEW_REVERT_NEEDED]: UIUpdateEvent
	[StreamEventType.ABORT_REQUESTED]: StreamAbortEvent
	[StreamEventType.PARTIAL_MESSAGE_CLEANUP_NEEDED]: PartialMessageCleanupEvent
	[StreamEventType.CONVERSATION_HISTORY_UPDATE_NEEDED]: ConversationHistoryUpdateEvent
	[StreamEventType.STREAM_STATE_SYNC_NEEDED]: BaseEventData
	[StreamEventType.DIFF_UPDATE_NEEDED]: DiffUpdateEvent
	[StreamEventType.TASK_PROGRESS_UPDATE]: TaskProgressEvent
	[StreamEventType.ERROR_DISPLAY_NEEDED]: ErrorDisplayEvent
}

/**
 * Type-safe event emitter interface
 */
export interface IStreamEventEmitter {
	emit<K extends keyof StreamEventMap>(event: K, data: StreamEventMap[K]): boolean
	on<K extends keyof StreamEventMap>(event: K, listener: (data: StreamEventMap[K]) => void): this
	once<K extends keyof StreamEventMap>(event: K, listener: (data: StreamEventMap[K]) => void): this
	off<K extends keyof StreamEventMap>(event: K, listener: (data: StreamEventMap[K]) => void): this
}
