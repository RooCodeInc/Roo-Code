/**
 * ACP Interfaces
 *
 * Defines interfaces for dependency injection and testability.
 * These interfaces allow for mocking in tests and swapping implementations.
 */

import type * as acp from "@agentclientprotocol/sdk"

// =============================================================================
// Logger Interface
// =============================================================================

/**
 * Interface for ACP logging.
 * Allows for different logging implementations (file, console, mock for tests).
 */
export interface IAcpLogger {
	/**
	 * Log an info message.
	 */
	info(component: string, message: string, data?: unknown): void

	/**
	 * Log a debug message.
	 */
	debug(component: string, message: string, data?: unknown): void

	/**
	 * Log a warning message.
	 */
	warn(component: string, message: string, data?: unknown): void

	/**
	 * Log an error message.
	 */
	error(component: string, message: string, data?: unknown): void

	/**
	 * Log an incoming request.
	 */
	request(method: string, params?: unknown): void

	/**
	 * Log an outgoing response.
	 */
	response(method: string, result?: unknown): void

	/**
	 * Log an outgoing notification.
	 */
	notification(method: string, params?: unknown): void
}

// =============================================================================
// Content Formatter Interface
// =============================================================================

/**
 * Interface for content formatting operations.
 */
export interface IContentFormatter {
	/**
	 * Format tool result content based on the tool kind.
	 */
	formatToolResult(kind: string, content: string): string

	/**
	 * Format search results into a clean summary with file list.
	 */
	formatSearchResults(content: string): string

	/**
	 * Format read results by truncating long file contents.
	 */
	formatReadResults(content: string): string

	/**
	 * Wrap content in markdown code block for better rendering.
	 */
	wrapInCodeBlock(content: string, language?: string): string

	/**
	 * Check if a text message is an echo of the user's prompt.
	 */
	isUserEcho(text: string, promptText: string | null): boolean
}

// =============================================================================
// Session Interface
// =============================================================================

/**
 * Interface for ACP Session.
 * Enables mocking for tests.
 */
export interface IAcpSession {
	/**
	 * Process a prompt request from the ACP client.
	 */
	prompt(params: acp.PromptRequest): Promise<acp.PromptResponse>

	/**
	 * Cancel the current prompt.
	 */
	cancel(): void

	/**
	 * Set the session mode.
	 */
	setMode(mode: string): void

	/**
	 * Dispose of the session and release resources.
	 */
	dispose(): Promise<void>

	/**
	 * Get the session ID.
	 */
	getSessionId(): string
}

// =============================================================================
// Extension Client Interface
// =============================================================================

/**
 * Events emitted by the extension client.
 */
export interface ExtensionClientEvents {
	message: (msg: unknown) => void
	messageUpdated: (msg: unknown) => void
	waitingForInput: (event: unknown) => void
	commandExecutionOutput: (event: unknown) => void
	taskCompleted: (event: unknown) => void
}

/**
 * Interface for extension client interactions.
 */
export interface IExtensionClient {
	on<K extends keyof ExtensionClientEvents>(event: K, handler: ExtensionClientEvents[K]): void
	off<K extends keyof ExtensionClientEvents>(event: K, handler: ExtensionClientEvents[K]): void
	respond(text: string): void
	approve(): void
	reject(message?: string): void
}

// =============================================================================
// Extension Host Interface
// =============================================================================

/**
 * Events emitted by the extension host.
 */
export interface ExtensionHostEvents {
	extensionWebviewMessage: (msg: unknown) => void
}

/**
 * Interface for extension host interactions.
 */
export interface IExtensionHost {
	/**
	 * Get the extension client for event handling.
	 */
	readonly client: IExtensionClient

	/**
	 * Subscribe to extension host events.
	 */
	on<K extends keyof ExtensionHostEvents>(event: K, handler: ExtensionHostEvents[K]): void

	/**
	 * Unsubscribe from extension host events.
	 */
	off<K extends keyof ExtensionHostEvents>(event: K, handler: ExtensionHostEvents[K]): void

	/**
	 * Activate the extension host.
	 */
	activate(): Promise<void>

	/**
	 * Dispose of the extension host.
	 */
	dispose(): Promise<void>

	/**
	 * Send a message to the extension.
	 */
	sendToExtension(message: unknown): void
}

// =============================================================================
// Delta Tracker Interface
// =============================================================================

/**
 * Interface for delta tracking.
 */
export interface IDeltaTracker {
	/**
	 * Get the delta (new portion) of text that hasn't been sent yet.
	 */
	getDelta(id: string | number, fullText: string): string

	/**
	 * Check if there would be a delta without updating tracking.
	 */
	peekDelta(id: string | number, fullText: string): string

	/**
	 * Reset all tracking.
	 */
	reset(): void

	/**
	 * Reset tracking for a specific ID only.
	 */
	resetId(id: string | number): void
}

// =============================================================================
// Prompt State Interface
// =============================================================================

/**
 * Valid states for a prompt turn.
 *
 * - idle: No prompt is being processed, ready for new prompts
 * - processing: A prompt is actively being processed
 */
export type PromptStateType = "idle" | "processing"

/**
 * Result of completing a prompt.
 */
export interface PromptCompletionResult {
	stopReason: acp.StopReason
}

/**
 * Interface for prompt state management.
 */
export interface IPromptStateMachine {
	/**
	 * Get the current state.
	 */
	getState(): PromptStateType

	/**
	 * Get the abort signal for the current prompt.
	 */
	getAbortSignal(): AbortSignal | null

	/**
	 * Get the current prompt text.
	 */
	getPromptText(): string | null

	/**
	 * Check if a prompt can be started.
	 */
	canStartPrompt(): boolean

	/**
	 * Check if currently processing a prompt.
	 */
	isProcessing(): boolean

	/**
	 * Start a new prompt.
	 */
	startPrompt(promptText: string): Promise<PromptCompletionResult>

	/**
	 * Complete the prompt with success or failure.
	 */
	complete(success: boolean): acp.StopReason

	/**
	 * Transition to completion with a specific stop reason.
	 * This allows direct control over the stop reason (e.g., for cancellation).
	 */
	transitionToComplete(stopReason: acp.StopReason): void

	/**
	 * Cancel the current prompt.
	 */
	cancel(): void

	/**
	 * Reset to idle state.
	 */
	reset(): void
}

// =============================================================================
// Stream Manager Interfaces
// =============================================================================

/**
 * Callback to send an ACP session update.
 */
export type SendUpdateFn = (update: acp.SessionNotification["update"]) => void

/**
 * Options for creating stream managers.
 */
export interface StreamManagerOptions {
	/** Delta tracker for tracking already-sent content */
	deltaTracker: IDeltaTracker
	/** Callback to send session updates */
	sendUpdate: SendUpdateFn
	/** Logger instance */
	logger: IAcpLogger
}

/**
 * Interface for command output streaming.
 */
export interface ICommandStreamManager {
	trackCommand(toolCallId: string, command: string, ts: number): void
	handleCommandOutput(message: unknown): void
	handleExecutionOutput(executionId: string, output: string): void
	isCommandOutputMessage(message: unknown): boolean
	reset(): void
}

/**
 * Interface for tool content streaming.
 */
export interface IToolContentStreamManager {
	isToolAskMessage(message: unknown): boolean
	handleToolContentStreaming(message: unknown): boolean
	reset(): void
}

// =============================================================================
// Session Dependencies
// =============================================================================

/**
 * Dependencies required for creating an AcpSession.
 * Enables dependency injection for testing.
 */
export interface AcpSessionDependencies {
	/** Logger instance */
	logger?: IAcpLogger
	/** Content formatter instance */
	contentFormatter?: IContentFormatter
	/** Delta tracker factory */
	createDeltaTracker?: () => IDeltaTracker
	/** Prompt state machine factory */
	createPromptStateMachine?: () => IPromptStateMachine
}

// =============================================================================
// Null/Mock Implementations for Testing
// =============================================================================

/**
 * No-op logger implementation for testing.
 */
export class NullLogger implements IAcpLogger {
	info(_component: string, _message: string, _data?: unknown): void {}
	debug(_component: string, _message: string, _data?: unknown): void {}
	warn(_component: string, _message: string, _data?: unknown): void {}
	error(_component: string, _message: string, _data?: unknown): void {}
	request(_method: string, _params?: unknown): void {}
	response(_method: string, _result?: unknown): void {}
	notification(_method: string, _params?: unknown): void {}
}
