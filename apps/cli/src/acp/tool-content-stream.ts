/**
 * ToolContentStreamManager
 *
 * Manages streaming of tool content (file creates/edits) with headers and code fences.
 * Provides live feedback as files are being written by the LLM.
 *
 * Extracted from session.ts to separate the tool content streaming concern.
 */

import type { ClineMessage } from "@roo-code/types"

import type { IDeltaTracker, IAcpLogger, SendUpdateFn } from "./interfaces.js"
import { isFileWriteTool } from "./tool-registry.js"
import { hasValidFilePath } from "./utils/index.js"

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating a ToolContentStreamManager.
 */
export interface ToolContentStreamManagerOptions {
	/** Delta tracker for tracking already-sent content */
	deltaTracker: IDeltaTracker
	/** Callback to send session updates */
	sendUpdate: SendUpdateFn
	/** Logger instance */
	logger: IAcpLogger
}

// =============================================================================
// ToolContentStreamManager Class
// =============================================================================

/**
 * Manages streaming of tool content for file creates/edits.
 *
 * Responsibilities:
 * - Track which tools have sent their header
 * - Stream file content as it's being generated
 * - Wrap content in proper markdown code blocks
 * - Clean up tracking state
 */
export class ToolContentStreamManager {
	/**
	 * Track which tool content streams have sent their header.
	 * Used to show file path before streaming content.
	 */
	private toolContentHeadersSent: Set<number> = new Set()

	private readonly deltaTracker: IDeltaTracker
	private readonly sendUpdate: SendUpdateFn
	private readonly logger: IAcpLogger

	constructor(options: ToolContentStreamManagerOptions) {
		this.deltaTracker = options.deltaTracker
		this.sendUpdate = options.sendUpdate
		this.logger = options.logger
	}

	// ===========================================================================
	// Public API
	// ===========================================================================

	/**
	 * Check if a message is a tool ask message that this manager handles.
	 */
	isToolAskMessage(message: ClineMessage): boolean {
		return message.type === "ask" && message.ask === "tool"
	}

	/**
	 * Handle streaming content for tool ask messages (file creates/edits).
	 *
	 * This streams the content field from tool JSON as agent_message_chunk updates,
	 * providing live feedback as files are being written.
	 *
	 * @returns true if the message was handled, false if it should fall through
	 */
	handleToolContentStreaming(message: ClineMessage): boolean {
		const isPartial = message.partial === true
		const ts = message.ts
		const text = message.text || ""

		// Parse tool info to get the tool name, path, and content
		const parsed = this.parseToolMessage(text)

		// If we couldn't parse yet (early streaming), skip until we can identify the tool
		if (!parsed) {
			return true // Handled (by skipping)
		}

		const { toolName, toolPath, content } = parsed

		// Only stream content for file write operations (uses tool registry)
		if (!isFileWriteTool(toolName)) {
			return true // Handled (by skipping)
		}

		// Check if we have valid path and content to start streaming
		// Path must have a file extension to be considered valid (uses shared utility)
		const validPath = hasValidFilePath(toolPath)
		const hasContent = content.length > 0

		if (isPartial) {
			this.handlePartialMessage(ts, toolPath, content, validPath, hasContent)
		} else {
			this.handleCompleteMessage(ts, toolPath, content)
		}

		return true // Handled
	}

	/**
	 * Reset state for a new prompt.
	 */
	reset(): void {
		this.toolContentHeadersSent.clear()
	}

	/**
	 * Get the number of active headers (for testing/debugging).
	 */
	getActiveHeaderCount(): number {
		return this.toolContentHeadersSent.size
	}

	// ===========================================================================
	// Private Methods
	// ===========================================================================

	/**
	 * Parse a tool message to extract tool info.
	 * Returns null if JSON is incomplete (expected early in streaming).
	 */
	private parseToolMessage(text: string): { toolName: string; toolPath: string; content: string } | null {
		try {
			const toolInfo = JSON.parse(text || "{}") as Record<string, unknown>
			return {
				toolName: (toolInfo.tool as string) || "tool",
				toolPath: (toolInfo.path as string) || "",
				content: (toolInfo.content as string) || "",
			}
		} catch {
			// Early in streaming, JSON may be incomplete - this is expected
			return null
		}
	}

	/**
	 * Handle a partial (streaming) tool message.
	 */
	private handlePartialMessage(
		ts: number,
		toolPath: string,
		content: string,
		hasValidPath: boolean,
		hasContent: boolean,
	): void {
		// Send header as soon as we have a valid path (even without content yet)
		// This provides immediate feedback that a file is being created, reducing
		// perceived latency during the gap while LLM generates file content.
		if (hasValidPath && !this.toolContentHeadersSent.has(ts)) {
			this.toolContentHeadersSent.add(ts)
			this.sendUpdate({
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: `\n**Creating ${toolPath}**\n\`\`\`\n` },
			})
		}

		// Stream content deltas when content becomes available
		if (hasValidPath && hasContent) {
			// Use a unique key for delta tracking: "tool-content-{ts}"
			const deltaKey = `tool-content-${ts}`
			const delta = this.deltaTracker.getDelta(deltaKey, content)

			if (delta) {
				this.sendUpdate({
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: delta },
				})
			}
		}
	}

	/**
	 * Handle a complete (non-partial) tool message.
	 */
	private handleCompleteMessage(ts: number, _toolPath: string, _content: string): void {
		// Message complete - finish streaming and clean up
		if (this.toolContentHeadersSent.has(ts)) {
			// Send closing code fence
			this.sendUpdate({
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: "\n```\n" },
			})
			this.toolContentHeadersSent.delete(ts)
		}

		// Note: The actual tool_call notification will be sent via handleWaitingForInput
		// when the waitingForInput event fires (which happens when partial becomes false)
	}
}
