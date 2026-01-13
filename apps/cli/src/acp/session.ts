/**
 * ACP Session
 *
 * Manages a single ACP session, wrapping an ExtensionHost instance.
 * Handles message translation, event streaming, and permission requests.
 */

import {
	type SessionUpdate,
	type PromptRequest,
	type PromptResponse,
	type SessionModeState,
	AgentSideConnection,
} from "@agentclientprotocol/sdk"

import type { SupportedProvider } from "@/types/types.js"
import { getProviderSettings } from "@/lib/utils/provider.js"
import { type ExtensionHostOptions, ExtensionHost } from "@/agent/extension-host.js"
import { AgentLoopState } from "@/agent/agent-state.js"

import { DEFAULT_MODELS } from "./types.js"
import { extractPromptText, extractPromptImages } from "./translator.js"
import { acpLog } from "./logger.js"
import { DeltaTracker } from "./delta-tracker.js"
import { PromptStateMachine } from "./prompt-state.js"
import { ToolHandlerRegistry } from "./tool-handler.js"
import { CommandStreamManager } from "./command-stream.js"
import { ToolContentStreamManager } from "./tool-content-stream.js"
import { SessionEventHandler, createSessionEventHandler } from "./session-event-handler.js"
import type {
	IAcpSession,
	IAcpLogger,
	IDeltaTracker,
	IPromptStateMachine,
	AcpSessionDependencies,
} from "./interfaces.js"
import { type Result, ok, err } from "./utils/index.js"

export interface AcpSessionOptions {
	extensionPath: string
	provider: SupportedProvider
	apiKey?: string
	model: string
	mode: string
}

/**
 * AcpSession wraps an ExtensionHost instance and bridges it to the ACP protocol.
 *
 * Each ACP session creates its own ExtensionHost, which loads the extension
 * in a sandboxed environment. The session translates events from the
 * ExtensionClient to ACP session updates and handles permission requests.
 */
export class AcpSession implements IAcpSession {
	/** Logger instance (injected) */
	private readonly logger: IAcpLogger

	/** State machine for prompt lifecycle management */
	private readonly promptState: IPromptStateMachine

	/** Delta tracker for streaming content - ensures only new text is sent */
	private readonly deltaTracker: IDeltaTracker

	/** Tool handler registry for polymorphic tool dispatch */
	private readonly toolHandlerRegistry: ToolHandlerRegistry

	/** Command stream manager for handling command output */
	private readonly commandStreamManager: CommandStreamManager

	/** Tool content stream manager for handling file creates/edits */
	private readonly toolContentStreamManager: ToolContentStreamManager

	/** Session event handler for managing extension events */
	private readonly eventHandler: SessionEventHandler

	/** Current model ID */
	private currentModelId: string = DEFAULT_MODELS[0]!.modelId

	/** Track if we're in the process of cancelling a task */
	private isCancelling: boolean = false

	private constructor(
		private readonly sessionId: string,
		private readonly extensionHost: ExtensionHost,
		private readonly connection: AgentSideConnection,
		private readonly workspacePath: string,
		private readonly options: AcpSessionOptions,
		deps: AcpSessionDependencies = {},
	) {
		this.logger = deps.logger ?? acpLog
		this.promptState = deps.createPromptStateMachine?.() ?? new PromptStateMachine({ logger: this.logger })
		this.deltaTracker = deps.createDeltaTracker?.() ?? new DeltaTracker()

		const sendUpdate = (update: SessionUpdate) => connection.sessionUpdate({ sessionId: this.sessionId, update })

		this.toolHandlerRegistry = new ToolHandlerRegistry()

		this.commandStreamManager = new CommandStreamManager({
			deltaTracker: this.deltaTracker,
			sendUpdate,
			logger: this.logger,
		})

		this.toolContentStreamManager = new ToolContentStreamManager({
			deltaTracker: this.deltaTracker,
			sendUpdate,
			logger: this.logger,
		})

		// Create event handler with extension host for mode tracking.
		this.eventHandler = createSessionEventHandler({
			logger: this.logger,
			client: extensionHost.client,
			extensionHost,
			promptState: this.promptState,
			deltaTracker: this.deltaTracker,
			commandStreamManager: this.commandStreamManager,
			toolContentStreamManager: this.toolContentStreamManager,
			toolHandlerRegistry: this.toolHandlerRegistry,
			sendUpdate,
			approveAction: () => this.extensionHost.client.approve(),
			respondWithText: (text: string, images?: string[]) => this.extensionHost.client.respond(text, images),
			sendToExtension: (message) => this.extensionHost.sendToExtension(message),
			workspacePath,
			initialModeId: this.options.mode,
			isCancelling: () => this.isCancelling,
		})

		this.eventHandler.onTaskCompleted((success) => this.handleTaskCompleted(success))

		// Listen for state changes to log and detect cancellation completion.
		this.extensionHost.client.on("stateChange", (event) => {
			const prev = event.previousState
			const curr = event.currentState

			// Only log if something actually changed.
			const stateChanged =
				prev.state !== curr.state ||
				prev.isRunning !== curr.isRunning ||
				prev.isStreaming !== curr.isStreaming ||
				prev.currentAsk !== curr.currentAsk

			if (stateChanged) {
				this.logger.info(
					"ExtensionClient",
					`STATE: ${prev.state} → ${curr.state} (running=${curr.isRunning}, streaming=${curr.isStreaming}, ask=${curr.currentAsk || "none"})`,
				)
			}

			// If we're cancelling and the extension transitions to NO_TASK or IDLE, complete the cancellation
			// NO_TASK: messages were cleared
			// IDLE: task stopped (e.g., completion_result, api_req_failed, or just stopped)
			if (this.isCancelling) {
				const newState = curr.state
				const isTerminalState =
					newState === AgentLoopState.NO_TASK ||
					newState === AgentLoopState.IDLE ||
					newState === AgentLoopState.RESUMABLE

				// Also check if the agent is no longer running/streaming (it has stopped processing)
				const hasStopped = !curr.isRunning && !curr.isStreaming

				if (isTerminalState || hasStopped) {
					this.handleCancellationComplete()
				}
			}
		})
	}

	/**
	 * Create a new AcpSession.
	 *
	 * This initializes an ExtensionHost for the given working directory
	 * and sets up event handlers to stream updates to the ACP client.
	 */
	static async create({
		sessionId,
		cwd,
		connection,
		options,
		deps,
	}: {
		sessionId: string
		cwd: string
		connection: AgentSideConnection
		options: AcpSessionOptions
		deps: AcpSessionDependencies
	}): Promise<AcpSession> {
		const hostOptions: ExtensionHostOptions = {
			mode: options.mode,
			user: null,
			provider: options.provider as ExtensionHostOptions["provider"],
			apiKey: options.apiKey,
			model: options.model,
			workspacePath: cwd,
			extensionPath: options.extensionPath,
			disableOutput: true, // ACP mode: disable direct output, we stream through ACP.
			ephemeral: true, // Don't persist state - ACP clients manage their own sessions.
		}

		const extensionHost = new ExtensionHost(hostOptions)
		await extensionHost.activate()

		const session = new AcpSession(sessionId, extensionHost, connection, cwd, options, deps)
		session.setupEventHandlers()

		return session
	}

	// ===========================================================================
	// Event Handlers
	// ===========================================================================

	/**
	 * Set up event handlers to translate ExtensionClient events to ACP updates.
	 * This includes both ExtensionClient events and ExtensionHost events (modes, state).
	 */
	private setupEventHandlers(): void {
		this.eventHandler.setupEventHandlers()
	}

	/**
	 * Reset state for a new prompt.
	 */
	private resetForNewPrompt(): void {
		this.eventHandler.reset()
		this.isCancelling = false
	}

	/**
	 * Handle task completion.
	 */
	private handleTaskCompleted(success: boolean): void {
		// If we're cancelling, override the stop reason to "cancelled"
		if (this.isCancelling) {
			this.handleCancellationComplete()
		} else {
			// Normal completion
			this.promptState.complete(success)
		}
	}

	/**
	 * Handle cancellation completion.
	 * Called when the extension has finished cancelling (either via taskCompleted or NO_TASK transition).
	 */
	private handleCancellationComplete(): void {
		if (!this.isCancelling) {
			return // Already handled
		}

		this.isCancelling = false

		// Directly transition to complete with "cancelled" stop reason
		this.promptState.transitionToComplete("cancelled")
	}

	// ===========================================================================
	// ACP Methods
	// ===========================================================================

	/**
	 * Process a prompt request from the ACP client.
	 */
	async prompt(params: PromptRequest): Promise<PromptResponse> {
		// Extract text and images from prompt.
		const text = extractPromptText(params.prompt)
		const images = extractPromptImages(params.prompt)

		// Check if we're in a resumable state (paused after cancel).
		// If so, resume the existing conversation instead of starting fresh.
		const currentState = this.extensionHost.client.getAgentState()
		if (currentState.state === AgentLoopState.RESUMABLE && currentState.currentAsk === "resume_task") {
			this.logger.info(
				"Session",
				`RESUME TASK: resuming paused task with user input (was ask=${currentState.currentAsk})`,
			)

			// Reset state for the resumed prompt (but don't cancel - task is already paused)
			this.eventHandler.reset()
			this.isCancelling = false

			// Start tracking the prompt
			const promise = this.promptState.startPrompt(text)

			// Resume the task with the user's message as follow-up
			this.extensionHost.client.respond(text, images.length > 0 ? images : undefined)

			return promise
		}

		// Cancel any pending prompt.
		this.cancel()

		// Reset state for new prompt.
		this.resetForNewPrompt()

		// Start the prompt using the state machine.
		const promise = this.promptState.startPrompt(text)

		if (images.length > 0) {
			this.extensionHost.sendToExtension({ type: "newTask", text, images })
		} else {
			this.extensionHost.sendToExtension({ type: "newTask", text })
		}

		return promise
	}

	/**
	 * Cancel the current prompt.
	 */
	cancel(): void {
		if (this.promptState.isProcessing()) {
			this.isCancelling = true
			// Content continues flowing to the client during cancellation so users
			// see what the LLM was generating when cancel was triggered.
			this.extensionHost.sendToExtension({ type: "cancelTask" })
			// We wait for the extension to send a taskCompleted event or transition to NO_TASK
			// which will trigger handleTaskCompleted -> promptState.transitionToComplete("cancelled")
		}
	}

	/**
	 * Set the session mode (Roo Code operational mode like 'code', 'architect').
	 * The mode change is tracked by the event handler which listens to extension state updates.
	 */
	setMode(mode: string): void {
		this.extensionHost.sendToExtension({ type: "updateSettings", updatedSettings: { mode } })
	}

	/**
	 * Set the current model.
	 * This updates the provider settings to use the specified model.
	 */
	setModel(modelId: string): void {
		this.currentModelId = modelId
		const updatedSettings = getProviderSettings(this.options.provider, this.options.apiKey, modelId)
		this.extensionHost.sendToExtension({ type: "updateSettings", updatedSettings })
	}

	/**
	 * Get the current mode state (delegated to event handler).
	 */
	getModeState(): SessionModeState {
		return {
			currentModeId: this.eventHandler.getCurrentModeId(),
			availableModes: this.eventHandler.getAvailableModes(),
		}
	}

	/**
	 * Get the current mode ID (delegated to event handler).
	 */
	getCurrentModeId(): string {
		return this.eventHandler.getCurrentModeId()
	}

	/**
	 * Get the current model ID.
	 */
	getCurrentModelId(): string {
		return this.currentModelId
	}

	/**
	 * Dispose of the session and release resources.
	 */
	async dispose(): Promise<void> {
		this.cancel()
		this.eventHandler.cleanup()
		await this.extensionHost.dispose()
	}

	// ===========================================================================
	// Helpers
	// ===========================================================================

	/**
	 * Send an update directly to the ACP client.
	 *
	 * @returns Result indicating success or failure with error details.
	 */
	private async sendUpdate(update: SessionUpdate): Promise<Result<void>> {
		try {
			// Log the update being sent to ACP connection (commented out - too noisy)
			this.logger.info("Session", `OUT: ${JSON.stringify(update)}`)
			await this.connection.sessionUpdate({ sessionId: this.sessionId, update })
			return ok(undefined)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logger.error("Session", `Failed to send update: ${errorMessage}`, error)
			return err(`Failed to send update to ACP client: ${errorMessage}`)
		}
	}

	/**
	 * Get the session ID.
	 */
	getSessionId(): string {
		return this.sessionId
	}
}
