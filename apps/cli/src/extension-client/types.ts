/**
 * Type definitions for Roo Code client
 *
 * Re-exports types from @roo-code/types and adds client-specific types.
 */

import type { ClineMessage as RooCodeClineMessage, ExtensionMessage as RooCodeExtensionMessage } from "@roo-code/types"

// =============================================================================
// Re-export all types from @roo-code/types
// =============================================================================

// Message types
export type {
	ClineAsk,
	IdleAsk,
	ResumableAsk,
	InteractiveAsk,
	NonBlockingAsk,
	ClineSay,
	ClineMessage,
	ToolProgressStatus,
	ContextCondense,
	ContextTruncation,
} from "@roo-code/types"

// Ask arrays and type guards
export {
	clineAsks,
	idleAsks,
	resumableAsks,
	interactiveAsks,
	nonBlockingAsks,
	clineSays,
	isIdleAsk,
	isResumableAsk,
	isInteractiveAsk,
	isNonBlockingAsk,
} from "@roo-code/types"

// Webview message types
export type { WebviewMessage, ClineAskResponse } from "@roo-code/types"

// =============================================================================
// Client-specific types
// =============================================================================

/**
 * Simplified ExtensionState for client purposes.
 *
 * The full ExtensionState from @roo-code/types has many required fields,
 * but for agent loop state detection, we only need clineMessages.
 * This type allows partial state updates while still being compatible
 * with the full type.
 */
export interface ExtensionState {
	clineMessages: RooCodeClineMessage[]
	/** Allow other fields from the full ExtensionState to pass through */
	[key: string]: unknown
}

/**
 * Simplified ExtensionMessage for client purposes.
 *
 * We only care about certain message types for state detection.
 * Other fields pass through unchanged.
 */
export interface ExtensionMessage {
	type: RooCodeExtensionMessage["type"]
	state?: ExtensionState
	clineMessage?: RooCodeClineMessage
	action?: string
	invoke?: "newChat" | "sendMessage" | "primaryButtonClick" | "secondaryButtonClick" | "setChatBoxMessage"
	/** Allow other fields to pass through */
	[key: string]: unknown
}

/**
 * Structure of the text field in api_req_started messages.
 * Used to determine if the API request has completed (cost is defined).
 */
export interface ApiReqStartedText {
	cost?: number // Undefined while streaming, defined when complete
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
}
