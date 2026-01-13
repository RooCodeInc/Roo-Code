/**
 * Prompt State Machine
 *
 * Manages the lifecycle state of a prompt turn in a type-safe way.
 * Replaces boolean flags with explicit state transitions and guards.
 *
 * State transitions:
 *   idle -> processing (on startPrompt)
 *   processing -> idle (on complete/cancel)
 *   idle -> idle (reset)
 *
 * This state machine ensures:
 * - Only one prompt can be active at a time
 * - State transitions are valid
 * - Stop reasons are correctly mapped
 */

import type * as acp from "@agentclientprotocol/sdk"
import type { IAcpLogger } from "./interfaces.js"
import { NullLogger } from "./interfaces.js"

// =============================================================================
// Types
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
 * Events that can occur during prompt lifecycle.
 */
export type PromptEvent =
	| { type: "START_PROMPT" }
	| { type: "COMPLETE"; success: boolean }
	| { type: "CANCEL" }
	| { type: "RESET" }

/**
 * Options for creating a PromptStateMachine.
 */
export interface PromptStateMachineOptions {
	/** Logger instance (optional, defaults to NullLogger) */
	logger?: IAcpLogger
}

// =============================================================================
// PromptStateMachine Class
// =============================================================================

/**
 * State machine for managing prompt lifecycle.
 *
 * Provides explicit state transitions with validation,
 * replacing ad-hoc boolean flag management.
 */
export class PromptStateMachine {
	private state: PromptStateType = "idle"
	private abortController: AbortController | null = null
	private resolvePrompt: ((result: PromptCompletionResult) => void) | null = null
	private currentPromptText: string | null = null
	private readonly logger: IAcpLogger

	constructor(options: PromptStateMachineOptions = {}) {
		this.logger = options.logger ?? new NullLogger()
	}

	/**
	 * Get the current state.
	 */
	getState(): PromptStateType {
		return this.state
	}

	/**
	 * Get the abort signal for the current prompt.
	 */
	getAbortSignal(): AbortSignal | null {
		return this.abortController?.signal ?? null
	}

	/**
	 * Get the current prompt text (for echo detection).
	 */
	getCurrentPromptText(): string | null {
		return this.currentPromptText
	}

	/**
	 * Alias for getCurrentPromptText for compatibility.
	 */
	getPromptText(): string | null {
		return this.currentPromptText
	}

	/**
	 * Check if a prompt can be started.
	 */
	canStartPrompt(): boolean {
		return this.state === "idle"
	}

	/**
	 * Check if currently processing a prompt.
	 */
	isProcessing(): boolean {
		return this.state === "processing"
	}

	/**
	 * Start a new prompt.
	 *
	 * @param promptText - The user's prompt text (for echo detection)
	 * @returns A promise that resolves when the prompt completes
	 * @throws If a prompt is already in progress
	 */
	startPrompt(promptText: string): Promise<PromptCompletionResult> {
		if (this.state !== "idle") {
			// Cancel existing prompt first
			this.cancel()
		}

		this.state = "processing"
		this.abortController = new AbortController()
		this.currentPromptText = promptText

		return new Promise((resolve) => {
			this.resolvePrompt = resolve

			// Handle abort signal
			this.abortController?.signal.addEventListener("abort", () => {
				if (this.state === "processing") {
					this.transitionToComplete("cancelled")
				}
			})
		})
	}

	/**
	 * Complete the prompt with success or failure.
	 *
	 * @param success - Whether the task completed successfully
	 * @returns The stop reason that was used
	 */
	complete(success: boolean): acp.StopReason {
		const stopReason = this.mapSuccessToStopReason(success)
		this.transitionToComplete(stopReason)
		return stopReason
	}

	/**
	 * Cancel the current prompt.
	 *
	 * Safe to call even if no prompt is active.
	 */
	cancel(): void {
		if (this.state !== "processing") {
			return
		}

		this.abortController?.abort()
		// Note: The abort handler will call transitionToComplete
	}

	/**
	 * Reset to idle state.
	 *
	 * Should be called when starting a new prompt to ensure clean state.
	 */
	reset(): void {
		// Clean up any pending resources
		if (this.abortController) {
			this.abortController.abort()
			this.abortController = null
		}

		this.state = "idle"
		this.resolvePrompt = null
		this.currentPromptText = null
	}

	// ===========================================================================
	// Public Methods (for direct control)
	// ===========================================================================

	/**
	 * Transition to completion and resolve the promise.
	 * This is public to allow direct control of the stop reason (e.g., for cancellation).
	 */
	transitionToComplete(stopReason: acp.StopReason): void {
		if (this.state !== "processing") {
			return
		}

		this.state = "idle"

		// Resolve the promise
		if (this.resolvePrompt) {
			this.resolvePrompt({ stopReason })
			this.resolvePrompt = null
		}

		// Clean up
		this.abortController = null
		this.currentPromptText = null
	}

	/**
	 * Map task success to ACP stop reason.
	 *
	 * ACP defines these stop reasons:
	 * - end_turn: Normal completion
	 * - max_tokens: Token limit reached
	 * - max_turn_requests: Request limit reached
	 * - refusal: Agent refused to continue
	 * - cancelled: User cancelled
	 */
	private mapSuccessToStopReason(success: boolean): acp.StopReason {
		// Use "refusal" for failed tasks as it's the closest match
		// (indicates the task couldn't continue normally)
		return success ? "end_turn" : "refusal"
	}
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new prompt state machine.
 */
export function createPromptStateMachine(options?: PromptStateMachineOptions): PromptStateMachine {
	return new PromptStateMachine(options)
}
