/**
 * Session Event Handler
 *
 * Handles events from the ExtensionClient and ExtensionHost, translating them to ACP updates.
 */

import type { SessionMode } from "@agentclientprotocol/sdk"
import type {
	ClineMessage,
	ClineAsk,
	ClineSay,
	ExtensionMessage,
	ExtensionState,
	WebviewMessage,
	ModeConfig,
} from "@roo-code/types"

import type { WaitingForInputEvent, TaskCompletedEvent, CommandExecutionOutputEvent } from "@/agent/events.js"

import {
	translateToAcpUpdate,
	isPermissionAsk,
	isCompletionAsk,
	isTodoListMessage,
	createPlanUpdateFromMessage,
} from "./translator.js"
import { isUserEcho } from "./utils/index.js"
import type {
	IAcpLogger,
	IExtensionClient,
	IExtensionHost,
	IPromptStateMachine,
	ICommandStreamManager,
	IToolContentStreamManager,
	IDeltaTracker,
	SendUpdateFn,
} from "./interfaces.js"
import { ToolHandlerRegistry } from "./tool-handler.js"

// =============================================================================
// Streaming Configuration
// =============================================================================

/**
 * Configuration for streaming content types.
 * Defines which message types should be delta-streamed and how.
 */
interface StreamConfig {
	/** ACP update type to use */
	readonly updateType: "agent_message_chunk" | "agent_thought_chunk"
	/** Optional transform to apply to the text before delta tracking */
	readonly textTransform?: (text: string) => string
}

/**
 * Type for the delta stream configuration map.
 * Uses Partial<Record<ClineSay, StreamConfig>> for type safety.
 */
type DeltaStreamConfigMap = Partial<Record<ClineSay, StreamConfig>>

/**
 * Declarative configuration for which `say` types should be delta-streamed.
 * Any say type not listed here will fall through to the translator for
 * non-streaming handling.
 *
 * Type safety is enforced by:
 * - DELTA_STREAM_KEYS constrained to ClineSay values
 * - DeltaStreamConfigMap type annotation
 *
 * To add a new streaming type:
 * 1. Add the key to DELTA_STREAM_KEYS
 * 2. Add the configuration below
 */
const DELTA_STREAM_CONFIG: DeltaStreamConfigMap = {
	// Regular text messages from the agent
	text: { updateType: "agent_message_chunk" },

	// Command output (terminal results, etc.)
	command_output: { updateType: "agent_message_chunk" },

	// Final completion summary
	completion_result: { updateType: "agent_message_chunk" },

	// Agent's reasoning/thinking
	reasoning: { updateType: "agent_thought_chunk" },

	// Error messages (prefixed with "Error: ")
	error: {
		updateType: "agent_message_chunk",
		textTransform: (text: string) => `Error: ${text}`,
	},
}

/**
 * Get stream configuration for a say type.
 * Returns undefined if the say type is not configured for streaming.
 */
function getStreamConfig(sayType: ClineSay): StreamConfig | undefined {
	return DELTA_STREAM_CONFIG[sayType]
}

// =============================================================================
// Types
// =============================================================================

/**
 * Dependencies for the SessionEventHandler.
 */
export interface SessionEventHandlerDeps {
	/** Logger instance */
	logger: IAcpLogger
	/** Extension client for event subscription */
	client: IExtensionClient
	/** Extension host for host-level events (modes, etc.) */
	extensionHost: IExtensionHost
	/** Prompt state machine */
	promptState: IPromptStateMachine
	/** Delta tracker for streaming */
	deltaTracker: IDeltaTracker
	/** Command stream manager */
	commandStreamManager: ICommandStreamManager
	/** Tool content stream manager */
	toolContentStreamManager: IToolContentStreamManager
	/** Tool handler registry */
	toolHandlerRegistry: ToolHandlerRegistry
	/** Callback to send updates */
	sendUpdate: SendUpdateFn
	/** Callback to approve extension actions */
	approveAction: () => void
	/** Callback to respond with text */
	respondWithText: (text: string) => void
	/** Callback to send message to extension */
	sendToExtension: (message: WebviewMessage) => void
	/** Workspace path */
	workspacePath: string
	/** Initial mode ID */
	initialModeId: string
	/** Callback to check if cancellation is in progress */
	isCancelling: () => boolean
}

/**
 * Callback for task completion.
 */
export type TaskCompletedCallback = (success: boolean) => void

/**
 * Callback for mode changes.
 */
export type ModeChangedCallback = (modeId: string, availableModes: SessionMode[]) => void

// =============================================================================
// SessionEventHandler Class
// =============================================================================

/**
 * Handles events from the ExtensionClient and ExtensionHost, translating them to ACP updates.
 *
 * Responsibilities:
 * - Subscribe to extension client events
 * - Subscribe to extension host events (mode changes, etc.)
 * - Handle streaming for text/reasoning messages
 * - Handle tool permission requests
 * - Handle task completion
 * - Track mode state changes
 */
export class SessionEventHandler {
	private readonly logger: IAcpLogger
	private readonly client: IExtensionClient
	private readonly extensionHost: IExtensionHost
	private readonly promptState: IPromptStateMachine
	private readonly deltaTracker: IDeltaTracker
	private readonly commandStreamManager: ICommandStreamManager
	private readonly toolContentStreamManager: IToolContentStreamManager
	private readonly toolHandlerRegistry: ToolHandlerRegistry
	private readonly sendUpdate: SendUpdateFn
	private readonly approveAction: () => void
	private readonly respondWithText: (text: string) => void
	private readonly sendToExtension: (message: WebviewMessage) => void
	private readonly workspacePath: string
	private readonly isCancelling: () => boolean

	private taskCompletedCallback: TaskCompletedCallback | null = null
	private modeChangedCallback: ModeChangedCallback | null = null

	/** Current mode ID (Roo Code mode like 'code', 'architect', etc.) */
	private currentModeId: string

	/** Available modes from extension state */
	private availableModes: SessionMode[] = []

	/** Listener for extension host messages */
	private extensionMessageListener: ((msg: unknown) => void) | null = null

	/**
	 * Track processed permission requests to prevent duplicates.
	 * The extension may fire multiple waitingForInput events for the same tool call
	 * as the message is updated. We deduplicate by generating a stable key from
	 * the ask type and relevant content.
	 */
	private processedPermissions: Set<string> = new Set()

	constructor(deps: SessionEventHandlerDeps) {
		this.logger = deps.logger
		this.client = deps.client
		this.extensionHost = deps.extensionHost
		this.promptState = deps.promptState
		this.deltaTracker = deps.deltaTracker
		this.commandStreamManager = deps.commandStreamManager
		this.toolContentStreamManager = deps.toolContentStreamManager
		this.toolHandlerRegistry = deps.toolHandlerRegistry
		this.sendUpdate = deps.sendUpdate
		this.approveAction = deps.approveAction
		this.respondWithText = deps.respondWithText
		this.sendToExtension = deps.sendToExtension
		this.workspacePath = deps.workspacePath
		this.currentModeId = deps.initialModeId
		this.isCancelling = deps.isCancelling
	}

	// ===========================================================================
	// Public API
	// ===========================================================================

	/**
	 * Set up event handlers to translate ExtensionClient and ExtensionHost events to ACP updates.
	 */
	setupEventHandlers(): void {
		// Handle new messages
		this.client.on("message", (msg: unknown) => {
			this.handleMessage(msg as ClineMessage)
		})

		// Handle message updates (partial -> complete)
		this.client.on("messageUpdated", (msg: unknown) => {
			this.handleMessage(msg as ClineMessage)
		})

		// Handle permission requests (tool calls, commands, etc.)
		this.client.on("waitingForInput", (event: unknown) => {
			void this.handleWaitingForInput(event as WaitingForInputEvent)
		})

		// Handle streaming command execution output (live terminal output)
		this.client.on("commandExecutionOutput", (event: unknown) => {
			const cmdEvent = event as CommandExecutionOutputEvent
			this.commandStreamManager.handleExecutionOutput(cmdEvent.executionId, cmdEvent.output)
		})

		// Handle task completion
		this.client.on("taskCompleted", (event: unknown) => {
			this.handleTaskCompleted(event as TaskCompletedEvent)
		})

		// Handle extension host messages (modes, state, etc.)
		this.extensionMessageListener = (msg: unknown) => {
			this.handleExtensionMessage(msg as ExtensionMessage)
		}
		this.extensionHost.on("extensionWebviewMessage", this.extensionMessageListener)
	}

	/**
	 * Set the callback for task completion.
	 */
	onTaskCompleted(callback: TaskCompletedCallback): void {
		this.taskCompletedCallback = callback
	}

	/**
	 * Set the callback for mode changes.
	 */
	onModeChanged(callback: ModeChangedCallback): void {
		this.modeChangedCallback = callback
	}

	/**
	 * Get the current mode ID.
	 */
	getCurrentModeId(): string {
		return this.currentModeId
	}

	/**
	 * Get the available modes.
	 */
	getAvailableModes(): SessionMode[] {
		return this.availableModes
	}

	/**
	 * Reset state for a new prompt.
	 */
	reset(): void {
		this.deltaTracker.reset()
		this.commandStreamManager.reset()
		this.toolContentStreamManager.reset()
		this.processedPermissions.clear()
	}

	/**
	 * Clean up event listeners.
	 */
	cleanup(): void {
		if (this.extensionMessageListener) {
			this.extensionHost.off("extensionWebviewMessage", this.extensionMessageListener)
			this.extensionMessageListener = null
		}
	}

	// ===========================================================================
	// Message Handling
	// ===========================================================================

	/**
	 * Handle an incoming message from the extension.
	 *
	 * Uses the declarative DELTA_STREAM_CONFIG to automatically determine
	 * which message types should be delta-streamed and how.
	 */
	private handleMessage(message: ClineMessage): void {
		// Don't process messages if there's no active prompt
		// NOTE: isCancelling guard REMOVED - we now show all content even during cancellation
		// so the user can see exactly what was produced before the task paused
		if (!this.promptState.isProcessing()) {
			return
		}

		// === TEST LOGGING: Log messages that arrive during cancellation ===
		if (this.isCancelling()) {
			const msgType = message.type === "say" ? `say:${message.say}` : `ask:${message.ask}`
			const partial = message.partial ? "PARTIAL" : "COMPLETE"
			this.logger.info("EventHandler", `MSG DURING CANCEL (processing): ${msgType} ${partial} ts=${message.ts}`)
		}

		// Handle todo list updates - translate to ACP plan updates
		// Detects both tool asks for updateTodoList and user_edit_todos say messages
		if (isTodoListMessage(message)) {
			const planUpdate = createPlanUpdateFromMessage(message)
			if (planUpdate) {
				this.sendUpdate(planUpdate)
			}
			// Don't return - let the message also be processed by other handlers
			// (e.g., for permission requests that may follow)
		}

		// Handle streaming for tool ask messages (file creates/edits)
		// These contain content that grows as the LLM generates it
		if (this.toolContentStreamManager.isToolAskMessage(message)) {
			this.toolContentStreamManager.handleToolContentStreaming(message)
			return
		}

		// Check if this is a streaming message type
		if (message.type === "say" && message.text && message.say) {
			// Handle command_output specially for the "Run Command" UI
			if (this.commandStreamManager.isCommandOutputMessage(message)) {
				this.commandStreamManager.handleCommandOutput(message)
				return
			}

			const config = getStreamConfig(message.say)

			if (config) {
				// Filter out user message echo
				if (message.say === "text" && isUserEcho(message.text, this.promptState.getPromptText())) {
					return
				}

				// Apply text transform if configured (e.g., "Error: " prefix)
				const textToSend = config.textTransform ? config.textTransform(message.text) : message.text

				// Get delta using the tracker (handles all bookkeeping automatically)
				const delta = this.deltaTracker.getDelta(message.ts, textToSend)

				if (delta) {
					this.sendUpdate({
						sessionUpdate: config.updateType,
						content: { type: "text", text: delta },
					})
				}
				return
			}
		}

		// For non-streaming message types, use the translator
		const update = translateToAcpUpdate(message)
		if (update) {
			this.sendUpdate(update)
		}
	}

	// ===========================================================================
	// Permission Handling
	// ===========================================================================

	/**
	 * Handle waiting for input events (permission requests).
	 */
	private async handleWaitingForInput(event: WaitingForInputEvent): Promise<void> {
		const { ask, message } = event
		const askType = ask as ClineAsk

		// Don't auto-approve asks if there's no active prompt or if cancellation is in progress
		if (!this.promptState.isProcessing() || this.isCancelling()) {
			// === TEST LOGGING: Skipped ask due to cancellation ===
			if (this.isCancelling()) {
				this.logger.info("EventHandler", `ASK SKIPPED (cancelling): ask=${askType} ts=${message.ts}`)
			}
			return
		}

		// Handle permission-required asks
		if (isPermissionAsk(askType)) {
			this.handlePermissionRequest(message, askType)
			return
		}

		// Handle completion asks
		if (isCompletionAsk(askType)) {
			// Completion is handled by taskCompleted event
			return
		}

		// Handle followup questions - auto-continue for now
		// In a more sophisticated implementation, these could be surfaced
		// to the ACP client for user input
		if (askType === "followup") {
			this.respondWithText("")
			return
		}

		// Handle resume_task - auto-resume
		if (askType === "resume_task") {
			this.approveAction()
			return
		}

		// Handle API failures - auto-retry for now
		if (askType === "api_req_failed") {
			this.approveAction()
			return
		}

		// Default: approve and continue
		this.approveAction()
	}

	/**
	 * Handle a permission request for a tool call.
	 *
	 * Uses the ToolHandlerRegistry for polymorphic dispatch to the appropriate
	 * handler based on tool type. Auto-approves all tool calls without prompting
	 * the user, allowing autonomous operation.
	 *
	 * For commands, tracks the call to enable the "Run Command" UI with output.
	 * For other tools (search, read, etc.), both initial and completion updates
	 * are sent immediately as the results are already available.
	 */
	private handlePermissionRequest(message: ClineMessage, ask: ClineAsk): void {
		// Generate a stable key for deduplication based on ask type and content
		// The extension may fire multiple waitingForInput events for the same tool
		// as the message is updated. We use the message text as a stable identifier.
		const permissionKey = `${ask}:${message.text || ""}`

		// Check if we've already processed this permission request
		if (this.processedPermissions.has(permissionKey)) {
			// Still need to approve the action to unblock the extension
			this.approveAction()
			return
		}

		// Mark this permission as processed
		this.processedPermissions.add(permissionKey)

		// Create context for the tool handler
		const context = ToolHandlerRegistry.createContext(message, ask, this.workspacePath, this.logger)

		// Dispatch to the appropriate handler via the registry
		const result = this.toolHandlerRegistry.handle(context)

		// Send the initial in_progress update
		this.sendUpdate(result.initialUpdate)

		// Track pending commands for the "Run Command" UI
		if (result.trackAsPendingCommand) {
			const { toolCallId, command, ts } = result.trackAsPendingCommand
			this.commandStreamManager.trackCommand(toolCallId, command, ts)
		}

		// Send completion update if available (non-command tools)
		if (result.completionUpdate) {
			this.sendUpdate(result.completionUpdate)
		}

		// Auto-approve the tool call
		this.approveAction()
	}

	// ===========================================================================
	// Task Completion
	// ===========================================================================

	/**
	 * Handle task completion.
	 */
	private handleTaskCompleted(event: TaskCompletedEvent): void {
		if (this.taskCompletedCallback) {
			this.taskCompletedCallback(event.success)
		}
	}

	// ===========================================================================
	// Extension Message Handling (Modes, State)
	// ===========================================================================

	/**
	 * Handle extension messages for mode and state updates.
	 */
	private handleExtensionMessage(msg: ExtensionMessage): void {
		// Handle "modes" message - list of available modes
		if (msg.type === "modes" && msg.modes) {
			this.availableModes = msg.modes.map((m) => ({
				id: m.slug,
				name: m.name,
				description: undefined,
			}))
		}

		// Handle "state" message - includes current mode
		if (msg.type === "state" && msg.state) {
			const state = msg.state as ExtensionState
			if (state.mode && state.mode !== this.currentModeId) {
				this.currentModeId = state.mode

				// Send mode update notification
				this.sendUpdate({
					sessionUpdate: "current_mode_update",
					currentModeId: this.currentModeId,
				})

				// Notify callback
				if (this.modeChangedCallback) {
					this.modeChangedCallback(this.currentModeId, this.availableModes)
				}
			}

			// Update available modes from customModes
			if (state.customModes && Array.isArray(state.customModes)) {
				this.updateAvailableModesFromConfig(state.customModes as ModeConfig[])
			}
		}
	}

	/**
	 * Update available modes from ModeConfig array.
	 */
	private updateAvailableModesFromConfig(modes: ModeConfig[]): void {
		this.availableModes = modes.map((m) => ({
			id: m.slug,
			name: m.name,
			description: undefined,
		}))
	}
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new SessionEventHandler instance.
 */
export function createSessionEventHandler(deps: SessionEventHandlerDeps): SessionEventHandler {
	return new SessionEventHandler(deps)
}
