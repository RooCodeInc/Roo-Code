/**
 * Roo Code Client Library
 *
 * Provides state detection and event-based tracking for the Roo Code agent loop.
 */

// Main Client
export { ExtensionClient, createClient, createMockClient } from "./client.js"

// State Detection
export {
	AgentLoopState,
	type AgentStateInfo,
	type RequiredAction,
	detectAgentState,
	isAgentWaitingForInput,
	isAgentRunning,
	isContentStreaming,
} from "./agent-state.js"

// Events
export {
	TypedEventEmitter,
	Observable,
	type Observer,
	type Unsubscribe,
	type ClientEventMap,
	type AgentStateChangeEvent,
	type WaitingForInputEvent,
	type TaskCompletedEvent,
	isSignificantStateChange,
	transitionedToWaiting,
	transitionedToRunning,
	streamingStarted,
	streamingEnded,
	taskCompleted,
} from "./events.js"

// State Store
export { StateStore, type StoreState, getDefaultStore, resetDefaultStore } from "./state-store.js"

// Message Processing
export {
	MessageProcessor,
	type MessageProcessorOptions,
	isValidClineMessage,
	isValidExtensionMessage,
	parseExtensionMessage,
	parseApiReqStartedText,
} from "./message-processor.js"

// Types - Re-exported from @roo-code/types
export {
	type ClineAsk,
	type IdleAsk,
	type ResumableAsk,
	type InteractiveAsk,
	type NonBlockingAsk,
	clineAsks,
	idleAsks,
	resumableAsks,
	interactiveAsks,
	nonBlockingAsks,
	isIdleAsk,
	isResumableAsk,
	isInteractiveAsk,
	isNonBlockingAsk,
	type ClineSay,
	clineSays,
	type ClineMessage,
	type ToolProgressStatus,
	type ContextCondense,
	type ContextTruncation,
	type ClineAskResponse,
	type WebviewMessage,
	type ExtensionMessage,
	type ExtensionState,
	type ApiReqStartedText,
} from "./types.js"
