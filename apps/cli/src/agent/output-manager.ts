/**
 * OutputManager - Handles all CLI output and streaming
 *
 * This manager is responsible for:
 * - Writing messages to stdout/stderr
 * - Tracking what's been displayed (to avoid duplicates)
 * - Managing streaming content with delta computation
 * - Formatting different message types appropriately
 *
 * Design notes:
 * - Uses the Observable pattern from client/events.ts for internal state
 * - Single responsibility: CLI output only (no prompting, no state detection)
 * - Can be disabled for TUI mode where Ink controls the terminal
 */

import fs from "fs"
import { ClineMessage, ClineSay } from "@roo-code/types"

// Debug logging to file (for CLI debugging without breaking TUI)
const DEBUG_LOG = "/tmp/roo-cli-debug.log"
function debugLog(message: string, data?: unknown) {
	const timestamp = new Date().toISOString()
	const entry = data ? `[${timestamp}] ${message}: ${JSON.stringify(data, null, 2)}\n` : `[${timestamp}] ${message}\n`
	fs.appendFileSync(DEBUG_LOG, entry)
}

import { Observable } from "./events.js"

// =============================================================================
// Types
// =============================================================================

/**
 * Tracks what we've displayed for a specific message ts.
 */
export interface DisplayedMessage {
	ts: number
	text: string
	partial: boolean
}

/**
 * Tracks streaming state for a message.
 */
export interface StreamState {
	ts: number
	text: string
	headerShown: boolean
}

/**
 * Configuration options for OutputManager.
 */
export interface OutputManagerOptions {
	/**
	 * When true, completely disables all output.
	 * Use for TUI mode where another system controls the terminal.
	 */
	disabled?: boolean

	/**
	 * Stream for normal output (default: process.stdout).
	 */
	stdout?: NodeJS.WriteStream

	/**
	 * Stream for error output (default: process.stderr).
	 */
	stderr?: NodeJS.WriteStream

	/**
	 * When true, outputs verbose debug info for tool requests.
	 * Enabled by -d flag in CLI.
	 */
	debug?: boolean
}

// =============================================================================
// OutputManager Class
// =============================================================================

export class OutputManager {
	private disabled: boolean
	private stdout: NodeJS.WriteStream
	private stderr: NodeJS.WriteStream
	private debug: boolean

	/**
	 * Track displayed messages by ts to avoid duplicate output.
	 * Observable pattern allows external systems to subscribe if needed.
	 */
	private displayedMessages = new Map<number, DisplayedMessage>()

	/**
	 * Track streamed content by ts for delta computation.
	 */
	private streamedContent = new Map<number, StreamState>()

	/**
	 * Track which ts is currently streaming (for newline management).
	 */
	private currentlyStreamingTs: number | null = null

	/**
	 * Track first partial logs (for debugging first/last pattern).
	 */
	private loggedFirstPartial = new Set<number>()

	/**
	 * Track streaming terminal output by execution ID.
	 */
	private terminalOutputByExecutionId = new Map<string, string>()

	/**
	 * Flag to track if we've streamed any terminal output (to skip command_output).
	 */
	private hasStreamedTerminalOutput = false

	/**
	 * Observable for streaming state changes.
	 * External systems can subscribe to know when streaming starts/ends.
	 */
	public readonly streamingState = new Observable<{ ts: number | null; isStreaming: boolean }>({
		ts: null,
		isStreaming: false,
	})

	constructor(options: OutputManagerOptions = {}) {
		this.disabled = options.disabled ?? false
		this.stdout = options.stdout ?? process.stdout
		this.stderr = options.stderr ?? process.stderr
		this.debug = options.debug ?? false
	}

	// ===========================================================================
	// Public API
	// ===========================================================================

	/**
	 * Output a ClineMessage based on its type.
	 * This is the main entry point for message output.
	 *
	 * @param msg - The message to output
	 * @param skipFirstUserMessage - If true, skip the first "text" message (user prompt echo)
	 */
	outputMessage(msg: ClineMessage, skipFirstUserMessage = true): void {
		const ts = msg.ts
		const text = msg.text || ""
		const isPartial = msg.partial === true
		const previousDisplay = this.displayedMessages.get(ts)
		const alreadyDisplayedComplete = previousDisplay && !previousDisplay.partial

		if (msg.type === "say" && msg.say) {
			this.outputSayMessage(ts, msg.say, text, isPartial, alreadyDisplayedComplete, skipFirstUserMessage)
		} else if (msg.type === "ask" && msg.ask) {
			// Handle streaming output for different ask types
			switch (msg.ask) {
				case "command_output":
					this.outputCommandOutput(ts, text, isPartial, alreadyDisplayedComplete)
					break

				case "tool":
					// Stream tool requests (file create/edit/delete) as they come in
					this.outputToolRequest(ts, text, isPartial, alreadyDisplayedComplete)
					break

				case "command":
					// Stream command requests as they come in
					this.outputCommandRequest(ts, text, isPartial, alreadyDisplayedComplete)
					break

				// Other ask types (followup, completion_result, etc.) are handled by AskDispatcher
				// when complete (partial: false)
			}
		}
	}

	/**
	 * Get a timestamp for debug output.
	 */
	private getTimestamp(): string {
		const now = new Date()
		return `[${now.toISOString().slice(11, 23)}]`
	}

	/**
	 * Whether to include timestamps in output (for debugging).
	 */
	private showTimestamps = !!process.env.DEBUG_TIMESTAMPS

	/**
	 * Output a simple text line with a label.
	 */
	output(label: string, text?: string): void {
		if (this.disabled) return
		const ts = this.showTimestamps ? `${this.getTimestamp()} ` : ""
		const message = text ? `${ts}${label} ${text}\n` : `${ts}${label}\n`
		this.stdout.write(message)
	}

	/**
	 * Output an error message.
	 */
	outputError(label: string, text?: string): void {
		if (this.disabled) return
		const ts = this.showTimestamps ? `${this.getTimestamp()} ` : ""
		const message = text ? `${ts}${label} ${text}\n` : `${ts}${label}\n`
		this.stderr.write(message)
	}

	/**
	 * Write raw text to stdout (for streaming).
	 */
	writeRaw(text: string): void {
		if (this.disabled) return
		const ts = this.showTimestamps ? `${this.getTimestamp()} ` : ""
		this.stdout.write(ts + text)
	}

	/**
	 * Check if a message has already been displayed (streamed or complete).
	 * Returns true if we've streamed content for this ts OR if we've fully displayed it.
	 */
	isAlreadyDisplayed(ts: number): boolean {
		// Check if we've streamed any content for this message
		// (streamedContent is set during streaming, before displayedMessages is finalized)
		if (this.streamedContent.has(ts)) {
			return true
		}
		// Check if we've fully displayed this message
		const displayed = this.displayedMessages.get(ts)
		return displayed !== undefined && !displayed.partial
	}

	/**
	 * Check if we're currently streaming any message.
	 */
	isCurrentlyStreaming(): boolean {
		return this.currentlyStreamingTs !== null
	}

	/**
	 * Get the ts of the currently streaming message.
	 */
	getCurrentlyStreamingTs(): number | null {
		return this.currentlyStreamingTs
	}

	/**
	 * Mark a message as displayed (useful for external coordination).
	 */
	markDisplayed(ts: number, text: string, partial: boolean): void {
		this.displayedMessages.set(ts, { ts, text, partial })
	}

	/**
	 * Clear all tracking state.
	 * Call this when starting a new task.
	 */
	clear(): void {
		this.displayedMessages.clear()
		this.streamedContent.clear()
		this.currentlyStreamingTs = null
		this.loggedFirstPartial.clear()
		this.terminalOutputByExecutionId.clear()
		this.hasStreamedTerminalOutput = false
		this.toolContentStreamed.clear()
		this.toolContentTruncated.clear()
		this.toolLastDisplayedCharCount.clear()
		this.streamingState.next({ ts: null, isStreaming: false })
	}

	/**
	 * Get debugging info about first partial logging.
	 */
	hasLoggedFirstPartial(ts: number): boolean {
		return this.loggedFirstPartial.has(ts)
	}

	/**
	 * Record that we've logged the first partial for a ts.
	 */
	setLoggedFirstPartial(ts: number): void {
		this.loggedFirstPartial.add(ts)
	}

	/**
	 * Clear the first partial record (when complete).
	 */
	clearLoggedFirstPartial(ts: number): void {
		this.loggedFirstPartial.delete(ts)
	}

	// ===========================================================================
	// Say Message Output
	// ===========================================================================

	private outputSayMessage(
		ts: number,
		say: ClineSay,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
		skipFirstUserMessage: boolean,
	): void {
		switch (say) {
			case "text":
				this.outputTextMessage(ts, text, isPartial, alreadyDisplayedComplete, skipFirstUserMessage)
				break

			// case "thinking": - not a valid ClineSay type
			case "reasoning":
				this.outputReasoningMessage(ts, text, isPartial, alreadyDisplayedComplete)
				break

			case "command_output":
				this.outputCommandOutput(ts, text, isPartial, alreadyDisplayedComplete)
				break

			// Note: completion_result is an "ask" type, not a "say" type.
			// It is handled via the TaskCompleted event in extension-host.ts

			case "error":
				if (!alreadyDisplayedComplete) {
					this.outputError("\n[error]", text || "Unknown error")
					this.displayedMessages.set(ts, { ts, text: text || "", partial: false })
				}
				break

			case "api_req_started":
				// Silent - no output needed
				break

			default:
				// NO-OP for unknown say types
				break
		}
	}

	private outputTextMessage(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
		skipFirstUserMessage: boolean,
	): void {
		// Skip the initial user prompt echo (first message with no prior messages)
		if (skipFirstUserMessage && this.displayedMessages.size === 0 && !this.displayedMessages.has(ts)) {
			this.displayedMessages.set(ts, { ts, text, partial: !!isPartial })
			return
		}

		if (isPartial && text) {
			// Stream partial content
			this.streamContent(ts, text, "[assistant]")
			this.displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			// Message complete - ensure all content is output
			const streamed = this.streamedContent.get(ts)

			if (streamed) {
				// We were streaming - output any remaining delta and finish
				if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
					const delta = text.slice(streamed.text.length)
					this.writeRaw(delta)
				}
				this.finishStream(ts)
			} else {
				// Not streamed yet - output complete message
				this.output("\n[assistant]", text)
			}

			this.displayedMessages.set(ts, { ts, text, partial: false })
			this.streamedContent.set(ts, { ts, text, headerShown: true })
		}
	}

	private outputReasoningMessage(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		if (isPartial && text) {
			this.streamContent(ts, text, "[reasoning]")
			this.displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			// Reasoning complete - finish the stream
			const streamed = this.streamedContent.get(ts)

			if (streamed) {
				if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
					const delta = text.slice(streamed.text.length)
					this.writeRaw(delta)
				}
				this.finishStream(ts)
			} else {
				this.output("\n[reasoning]", text)
			}

			this.displayedMessages.set(ts, { ts, text, partial: false })
		}
	}

	/**
	 * Output command_output (shared between say and ask types).
	 * Skips output if we've already streamed terminal output via commandExecutionStatus.
	 */
	outputCommandOutput(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		// Skip if we've already streamed terminal output - avoid duplicate display
		if (this.hasStreamedTerminalOutput) {
			// Mark as displayed but don't output - we already showed it via [terminal]
			if (!isPartial) {
				this.displayedMessages.set(ts, { ts, text, partial: false })
			}
			return
		}

		if (isPartial && text) {
			this.streamContent(ts, text, "[command output]")
			this.displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			const streamed = this.streamedContent.get(ts)

			if (streamed) {
				if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
					const delta = text.slice(streamed.text.length)
					this.writeRaw(delta)
				}
				this.finishStream(ts)
			} else {
				this.writeRaw("\n[command output] ")
				this.writeRaw(text)
				this.writeRaw("\n")
			}

			this.displayedMessages.set(ts, { ts, text, partial: false })
			this.streamedContent.set(ts, { ts, text, headerShown: true })
		}
	}

	/**
	 * Track streamed tool content separately (content grows, not the full JSON text).
	 */
	private toolContentStreamed = new Map<number, string>()

	/**
	 * Track which tool messages have already shown truncation marker.
	 */
	private toolContentTruncated = new Set<number>()

	/**
	 * Track the last displayed character count for streaming updates.
	 */
	private toolLastDisplayedCharCount = new Map<number, number>()

	/**
	 * Maximum lines to show when streaming file content.
	 */
	private static readonly MAX_PREVIEW_LINES = 5

	/**
	 * Helper to write debug output to stderr with timestamp.
	 */
	private debugOutput(message: string): void {
		if (!this.debug) return
		const ts = this.getTimestamp()
		this.stderr.write(`${ts} [DEBUG] ${message}\n`)
	}

	/**
	 * Output tool request (file create/edit/delete) with streaming content preview.
	 * Shows the file content being written (up to 20 lines), then final state when complete.
	 */
	private outputToolRequest(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		// Parse tool info to get the tool name, path, and content for display
		let toolName = "tool"
		let toolPath = ""
		let content = ""
		try {
			const toolInfo = JSON.parse(text) as Record<string, unknown>
			toolName = (toolInfo.tool as string) || "tool"
			toolPath = (toolInfo.path as string) || ""
			content = (toolInfo.content as string) || ""
		} catch {
			// Use default if not JSON
		}

		// Debug output: show every tool request message
		this.debugOutput(
			`outputToolRequest: ts=${ts} partial=${isPartial} tool=${toolName} path="${toolPath}" contentLen=${content.length}`,
		)

		debugLog("[outputToolRequest] called", {
			ts,
			isPartial,
			toolName,
			toolPath,
			contentLen: content.length,
		})

		if (isPartial && text) {
			const previousContent = this.toolContentStreamed.get(ts) || ""
			const previous = this.streamedContent.get(ts)
			const currentLineCount = content === "" ? 0 : content.split("\n").length

			// Check for valid extension: must have a dot followed by 1+ characters
			const hasValidExtension = /\.[a-zA-Z0-9]+$/.test(toolPath)

			// Don't show header until we have BOTH a valid path AND some content.
			// This prevents showing "[newFileCreated] (0 chars)" followed by a long
			// pause while the LLM generates the content.
			const shouldShowHeader = hasValidExtension && content.length > 0

			if (!previous && shouldShowHeader) {
				// First partial with valid path and content - show header
				const pathInfo = ` ${toolPath}`
				debugLog("[outputToolRequest] FIRST PARTIAL - header", {
					toolName,
					toolPath,
					contentLen: content.length,
				})
				this.writeRaw(`\n[${toolName}]${pathInfo} (${content.length} chars)\n`)
				this.streamedContent.set(ts, { ts, text, headerShown: true })
				this.toolLastDisplayedCharCount.set(ts, content.length)
				this.currentlyStreamingTs = ts
				this.streamingState.next({ ts, isStreaming: true })
			} else if (!previous && !shouldShowHeader) {
				// Early partial without valid path/content - track but don't show yet
				// Just set headerShown: false to track we've seen this ts
				this.streamedContent.set(ts, { ts, text, headerShown: false })
			} else if (previous && !previous.headerShown && shouldShowHeader) {
				// Path and content now valid - show the header now
				const pathInfo = ` ${toolPath}`
				debugLog("[outputToolRequest] DEFERRED HEADER", { toolName, toolPath, contentLen: content.length })
				this.writeRaw(`\n[${toolName}]${pathInfo} (${content.length} chars)\n`)
				this.streamedContent.set(ts, { ts, text, headerShown: true })
				this.toolLastDisplayedCharCount.set(ts, content.length)
				this.currentlyStreamingTs = ts
				this.streamingState.next({ ts, isStreaming: true })
			}

			// Stream content delta (new content since last update)
			if (content.length > previousContent.length && content.startsWith(previousContent)) {
				const delta = content.slice(previousContent.length)
				// Check if we're still within the preview limit
				const previousLineCount = previousContent === "" ? 0 : previousContent.split("\n").length
				const previouslyTruncated = this.toolContentTruncated.has(ts)

				if (!previouslyTruncated) {
					if (currentLineCount <= OutputManager.MAX_PREVIEW_LINES) {
						// Still under limit - output the delta
						this.writeRaw(delta)
					} else if (previousLineCount < OutputManager.MAX_PREVIEW_LINES) {
						// Just crossed the limit - output remaining lines up to limit, mark as truncated
						const linesToShow = OutputManager.MAX_PREVIEW_LINES - previousLineCount
						const deltaLines = delta.split("\n")
						const truncatedDelta = deltaLines.slice(0, linesToShow).join("\n")
						if (truncatedDelta) {
							this.writeRaw(truncatedDelta)
						}
						this.toolContentTruncated.add(ts)
						// Show streaming indicator with char count
						this.writeRaw(`\n... streaming (${content.length} chars)`)
						this.toolLastDisplayedCharCount.set(ts, content.length)
					} else {
						// Already at/past limit but not yet marked - just mark as truncated
						this.toolContentTruncated.add(ts)
					}
				} else {
					// Already truncated - update streaming char count on each update
					// Output on new lines so updates are visible in captured output
					const lastDisplayed = this.toolLastDisplayedCharCount.get(ts) || 0
					if (content.length !== lastDisplayed) {
						this.writeRaw(`\n... streaming (${content.length} chars)`)
						this.toolLastDisplayedCharCount.set(ts, content.length)
					}
				}
				this.toolContentStreamed.set(ts, content)
			}

			this.displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && !alreadyDisplayedComplete) {
			// Tool request complete
			const previousContent = this.toolContentStreamed.get(ts) || ""
			const currentLineCount = content === "" ? 0 : content.split("\n").length
			const wasTruncated = this.toolContentTruncated.has(ts)

			// Show final truncation message
			if (wasTruncated && previousContent) {
				const remainingLines = currentLineCount - OutputManager.MAX_PREVIEW_LINES
				this.writeRaw(`\n... (${remainingLines} more lines)\n`)
			}

			// Show final stats
			const pathInfo = toolPath ? ` ${toolPath}` : ""
			const charCount = content.length
			this.writeRaw(`[${toolName}]${pathInfo} complete (${currentLineCount} lines, ${charCount} chars)\n`)
			this.currentlyStreamingTs = null
			this.streamingState.next({ ts: null, isStreaming: false })
			this.displayedMessages.set(ts, { ts, text, partial: false })
			// Clean up tool content tracking
			this.toolContentStreamed.delete(ts)
			this.toolContentTruncated.delete(ts)
			this.toolLastDisplayedCharCount.delete(ts)
		}
	}

	/**
	 * Output command request with streaming support.
	 * Streams partial content as it arrives from the LLM.
	 */
	private outputCommandRequest(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		if (isPartial && text) {
			this.streamContent(ts, text, "[command]")
			this.displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && !alreadyDisplayedComplete) {
			// Command request complete - finish the stream
			// Note: AskDispatcher will handle the actual prompt/approval
			const streamed = this.streamedContent.get(ts)

			if (streamed) {
				if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
					const delta = text.slice(streamed.text.length)
					this.writeRaw(delta)
				}
				this.finishStream(ts)
			}
			// Don't output non-streamed content here - AskDispatcher handles complete command requests

			this.displayedMessages.set(ts, { ts, text, partial: false })
		}
	}

	// ===========================================================================
	// Streaming Helpers
	// ===========================================================================

	/**
	 * Stream content with delta computation - only output new characters.
	 */
	streamContent(ts: number, text: string, header: string): void {
		const previous = this.streamedContent.get(ts)

		if (!previous) {
			// First time seeing this message - output header and initial text
			this.writeRaw(`\n${header} `)
			this.writeRaw(text)
			this.streamedContent.set(ts, { ts, text, headerShown: true })
			this.currentlyStreamingTs = ts
			this.streamingState.next({ ts, isStreaming: true })
		} else if (text.length > previous.text.length && text.startsWith(previous.text)) {
			// Text has grown - output delta
			const delta = text.slice(previous.text.length)
			this.writeRaw(delta)
			this.streamedContent.set(ts, { ts, text, headerShown: true })
		}
	}

	/**
	 * Finish streaming a message (add newline).
	 */
	finishStream(ts: number): void {
		if (this.currentlyStreamingTs === ts) {
			this.writeRaw("\n")
			this.currentlyStreamingTs = null
			this.streamingState.next({ ts: null, isStreaming: false })
		}
	}

	/**
	 * Output completion message (called from TaskCompleted handler).
	 */
	outputCompletionResult(ts: number, text: string): void {
		const previousDisplay = this.displayedMessages.get(ts)
		if (!previousDisplay || previousDisplay.partial) {
			this.output("\n[task complete]", text || "")
			this.displayedMessages.set(ts, { ts, text: text || "", partial: false })
		}
	}

	// ===========================================================================
	// Terminal Output Streaming (commandExecutionStatus)
	// ===========================================================================

	/**
	 * Output streaming terminal output from commandExecutionStatus messages.
	 * This provides live terminal output during command execution, before
	 * the final command_output message is created.
	 *
	 * @param executionId - Unique execution ID for this command
	 * @param output - The accumulated terminal output so far
	 */
	outputStreamingTerminalOutput(executionId: string, output: string): void {
		if (this.disabled) return

		// Mark that we've streamed terminal output (to skip command_output later)
		this.hasStreamedTerminalOutput = true

		const previousOutput = this.terminalOutputByExecutionId.get(executionId)

		if (!previousOutput) {
			// First time seeing this execution - output header and initial content
			this.writeRaw("\n[terminal] ")
			this.writeRaw(output)
			this.terminalOutputByExecutionId.set(executionId, output)
		} else if (output.length > previousOutput.length && output.startsWith(previousOutput)) {
			// Output has grown - write only the delta
			const delta = output.slice(previousOutput.length)
			this.writeRaw(delta)
			this.terminalOutputByExecutionId.set(executionId, output)
		}
		// If output hasn't grown or doesn't start with previous, ignore (likely reset)
	}
}
