/**
 * Tool Handler Abstraction
 *
 * Provides a polymorphic interface for handling different tool types.
 * Each handler knows how to process a specific category of tool operations,
 * enabling cleaner separation of concerns and easier testing.
 */

import type * as acp from "@agentclientprotocol/sdk"
import type { ClineMessage, ClineAsk } from "@roo-code/types"

import { parseToolFromMessage, type ToolCallInfo } from "./translator.js"
import type { IAcpLogger } from "./interfaces.js"
import { isEditTool, isReadTool, isSearchTool, isListFilesTool, mapToolToKind } from "./tool-registry.js"
import {
	formatSearchResults,
	formatReadContent,
	wrapInCodeBlock,
	readFileContent,
	extractContentFromParams,
	DEFAULT_FORMAT_CONFIG,
} from "./utils/index.js"

// =============================================================================
// Types
// =============================================================================

/**
 * Context passed to tool handlers for processing.
 */
export interface ToolHandlerContext {
	/** The original message from the extension */
	message: ClineMessage
	/** The ask type if this is a permission request */
	ask: ClineAsk
	/** Workspace path for resolving relative file paths */
	workspacePath: string
	/** Parsed tool information from the message */
	toolInfo: ToolCallInfo | null
	/** Logger instance */
	logger: IAcpLogger
}

/**
 * Result of handling a tool call.
 */
export interface ToolHandleResult {
	/** Initial tool_call update to send */
	initialUpdate: acp.SessionNotification["update"]
	/** Completion update to send (for non-command tools) */
	completionUpdate?: acp.SessionNotification["update"]
	/** Whether to track this as a pending command */
	trackAsPendingCommand?: {
		toolCallId: string
		command: string
		ts: number
	}
}

/**
 * Interface for tool handlers.
 *
 * Each implementation handles a specific category of tools (commands, files, search, etc.)
 * and knows how to create the appropriate ACP updates.
 */
export interface ToolHandler {
	/**
	 * Check if this handler can process the given tool.
	 */
	canHandle(context: ToolHandlerContext): boolean

	/**
	 * Handle the tool call and return the appropriate updates.
	 */
	handle(context: ToolHandlerContext): ToolHandleResult
}

// =============================================================================
// Base Handler
// =============================================================================

/**
 * Base class providing common functionality for tool handlers.
 */
abstract class BaseToolHandler implements ToolHandler {
	abstract canHandle(context: ToolHandlerContext): boolean
	abstract handle(context: ToolHandlerContext): ToolHandleResult

	/**
	 * Build the basic tool call structure from context.
	 */
	protected buildBaseToolCall(context: ToolHandlerContext, kindOverride?: acp.ToolKind): acp.ToolCall {
		const { message, toolInfo } = context

		return {
			toolCallId: toolInfo?.id || `tool-${message.ts}`,
			title: toolInfo?.title || message.text?.slice(0, 100) || "Tool execution",
			kind: kindOverride ?? (toolInfo ? mapToolToKind(toolInfo.name) : "other"),
			status: "pending",
			locations: toolInfo?.locations || [],
			rawInput: toolInfo?.params || {},
		}
	}

	/**
	 * Create the initial in_progress update.
	 */
	protected createInitialUpdate(
		toolCall: acp.ToolCall,
		kindOverride?: acp.ToolKind,
	): acp.SessionNotification["update"] {
		return {
			sessionUpdate: "tool_call",
			...toolCall,
			kind: kindOverride ?? toolCall.kind,
			status: "in_progress",
		}
	}
}

// =============================================================================
// Command Tool Handler
// =============================================================================

/**
 * Handles command execution tools.
 *
 * Commands are special because:
 * - They use "execute" kind for the "Run Command" UI
 * - They track pending calls for output correlation
 * - Completion comes via command_output messages, not immediately
 */
export class CommandToolHandler extends BaseToolHandler {
	canHandle(context: ToolHandlerContext): boolean {
		return context.ask === "command"
	}

	handle(context: ToolHandlerContext): ToolHandleResult {
		const { message, logger } = context

		const toolCall = this.buildBaseToolCall(context, "execute")

		logger.info("CommandToolHandler", `Handling command: ${toolCall.toolCallId}`)

		return {
			initialUpdate: this.createInitialUpdate(toolCall, "execute"),
			trackAsPendingCommand: {
				toolCallId: toolCall.toolCallId,
				command: message.text || "",
				ts: message.ts,
			},
		}
	}
}

// =============================================================================
// File Edit Tool Handler
// =============================================================================

/**
 * Handles file editing operations (write, apply_diff, create, modify).
 *
 * File edits include diff content in the completion update for UI display.
 */
export class FileEditToolHandler extends BaseToolHandler {
	canHandle(context: ToolHandlerContext): boolean {
		if (context.ask !== "tool") return false

		const toolName = context.toolInfo?.name || ""
		return isEditTool(toolName)
	}

	handle(context: ToolHandlerContext): ToolHandleResult {
		const { toolInfo, logger } = context

		const toolCall = this.buildBaseToolCall(context, "edit")

		// Include diff content if available
		if (toolInfo?.content && toolInfo.content.length > 0) {
			toolCall.content = toolInfo.content
		}

		logger.info("FileEditToolHandler", `Handling file edit: ${toolCall.toolCallId}`)

		const completionUpdate: acp.SessionNotification["update"] = {
			sessionUpdate: "tool_call_update",
			toolCallId: toolCall.toolCallId,
			status: "completed",
			rawOutput: toolInfo?.params || {},
		}

		// Include diff content in completion
		if (toolInfo?.content && toolInfo.content.length > 0) {
			completionUpdate.content = toolInfo.content
		}

		return {
			initialUpdate: this.createInitialUpdate(toolCall, "edit"),
			completionUpdate,
		}
	}
}

// =============================================================================
// File Read Tool Handler
// =============================================================================

/**
 * Handles file reading operations.
 *
 * For readFile tools, the rawInput.content contains the file PATH (not contents),
 * so we need to read the actual file content.
 */
export class FileReadToolHandler extends BaseToolHandler {
	canHandle(context: ToolHandlerContext): boolean {
		if (context.ask !== "tool") return false

		const toolName = context.toolInfo?.name || ""
		return isReadTool(toolName)
	}

	handle(context: ToolHandlerContext): ToolHandleResult {
		const { toolInfo, workspacePath, logger } = context

		const toolCall = this.buildBaseToolCall(context, "read")
		const rawInput = (toolInfo?.params as Record<string, unknown>) || {}

		logger.info("FileReadToolHandler", `Handling file read: ${toolCall.toolCallId}`)

		// Read actual file content using shared utility
		const result = readFileContent(rawInput, workspacePath)
		const fileContent = result.ok ? result.value : result.error

		// Format the content (truncate if needed, wrap in code block)
		const formattedContent = fileContent
			? wrapInCodeBlock(formatReadContent(fileContent, DEFAULT_FORMAT_CONFIG))
			: undefined

		const completionUpdate: acp.SessionNotification["update"] = {
			sessionUpdate: "tool_call_update",
			toolCallId: toolCall.toolCallId,
			status: "completed",
			rawOutput: rawInput,
		}

		if (formattedContent) {
			completionUpdate.content = [
				{
					type: "content",
					content: { type: "text", text: formattedContent },
				},
			]
		}

		return {
			initialUpdate: this.createInitialUpdate(toolCall, "read"),
			completionUpdate,
		}
	}
}

// =============================================================================
// Search Tool Handler
// =============================================================================

/**
 * Handles search operations (search_files, codebase_search, grep, etc.).
 *
 * Search results are formatted into a clean file list with summary.
 */
export class SearchToolHandler extends BaseToolHandler {
	canHandle(context: ToolHandlerContext): boolean {
		if (context.ask !== "tool") return false

		const toolName = context.toolInfo?.name || ""
		return isSearchTool(toolName)
	}

	handle(context: ToolHandlerContext): ToolHandleResult {
		const { toolInfo, logger } = context

		const toolCall = this.buildBaseToolCall(context, "search")
		const rawInput = (toolInfo?.params as Record<string, unknown>) || {}

		logger.info("SearchToolHandler", `Handling search: ${toolCall.toolCallId}`)

		// Format search results using shared utility
		const rawContent = rawInput.content as string | undefined
		const formattedContent = rawContent ? wrapInCodeBlock(formatSearchResults(rawContent)) : undefined

		const completionUpdate: acp.SessionNotification["update"] = {
			sessionUpdate: "tool_call_update",
			toolCallId: toolCall.toolCallId,
			status: "completed",
			rawOutput: rawInput,
		}

		if (formattedContent) {
			completionUpdate.content = [
				{
					type: "content",
					content: { type: "text", text: formattedContent },
				},
			]
		}

		return {
			initialUpdate: this.createInitialUpdate(toolCall, "search"),
			completionUpdate,
		}
	}
}

// =============================================================================
// List Files Tool Handler
// =============================================================================

/**
 * Handles list_files operations.
 */
export class ListFilesToolHandler extends BaseToolHandler {
	canHandle(context: ToolHandlerContext): boolean {
		if (context.ask !== "tool") return false

		const toolName = context.toolInfo?.name || ""
		return isListFilesTool(toolName)
	}

	handle(context: ToolHandlerContext): ToolHandleResult {
		const { toolInfo, logger } = context

		const toolCall = this.buildBaseToolCall(context, "read")
		const rawInput = (toolInfo?.params as Record<string, unknown>) || {}

		logger.info("ListFilesToolHandler", `Handling list files: ${toolCall.toolCallId}`)

		// Extract content using shared utility
		const rawContent = extractContentFromParams(rawInput)

		const completionUpdate: acp.SessionNotification["update"] = {
			sessionUpdate: "tool_call_update",
			toolCallId: toolCall.toolCallId,
			status: "completed",
			rawOutput: rawInput,
		}

		if (rawContent) {
			completionUpdate.content = [
				{
					type: "content",
					content: { type: "text", text: rawContent },
				},
			]
		}

		return {
			initialUpdate: this.createInitialUpdate(toolCall, "read"),
			completionUpdate,
		}
	}
}

// =============================================================================
// Default Tool Handler
// =============================================================================

/**
 * Fallback handler for tools not matched by other handlers.
 */
export class DefaultToolHandler extends BaseToolHandler {
	canHandle(_context: ToolHandlerContext): boolean {
		// Default handler always matches as fallback
		return true
	}

	handle(context: ToolHandlerContext): ToolHandleResult {
		const { toolInfo, logger } = context

		const toolCall = this.buildBaseToolCall(context)
		const rawInput = (toolInfo?.params as Record<string, unknown>) || {}

		logger.info("DefaultToolHandler", `Handling tool: ${toolCall.toolCallId}, kind: ${toolCall.kind}`)

		// Extract content using shared utility
		const rawContent = extractContentFromParams(rawInput)

		const completionUpdate: acp.SessionNotification["update"] = {
			sessionUpdate: "tool_call_update",
			toolCallId: toolCall.toolCallId,
			status: "completed",
			rawOutput: rawInput,
		}

		if (rawContent) {
			completionUpdate.content = [
				{
					type: "content",
					content: { type: "text", text: rawContent },
				},
			]
		}

		return {
			initialUpdate: this.createInitialUpdate(toolCall),
			completionUpdate,
		}
	}
}

// =============================================================================
// Tool Handler Registry
// =============================================================================

/**
 * Registry that manages tool handlers and dispatches to the appropriate one.
 *
 * Handlers are checked in order - the first one that canHandle() returns true wins.
 * DefaultToolHandler should always be last as it accepts everything.
 */
export class ToolHandlerRegistry {
	private readonly handlers: ToolHandler[]

	constructor(handlers?: ToolHandler[]) {
		// Default handler order - more specific handlers first
		this.handlers = handlers || [
			new CommandToolHandler(),
			new FileEditToolHandler(),
			new FileReadToolHandler(),
			new SearchToolHandler(),
			new ListFilesToolHandler(),
			new DefaultToolHandler(),
		]
	}

	/**
	 * Find the appropriate handler for the given context.
	 */
	getHandler(context: ToolHandlerContext): ToolHandler {
		for (const handler of this.handlers) {
			if (handler.canHandle(context)) {
				return handler
			}
		}

		// Should never happen if DefaultToolHandler is last
		throw new Error("No handler found for tool - DefaultToolHandler should always match")
	}

	/**
	 * Handle a tool call by finding the appropriate handler and dispatching.
	 */
	handle(context: ToolHandlerContext): ToolHandleResult {
		const handler = this.getHandler(context)
		return handler.handle(context)
	}

	/**
	 * Create a context object from message and ask.
	 */
	static createContext(
		message: ClineMessage,
		ask: ClineAsk,
		workspacePath: string,
		logger: IAcpLogger,
	): ToolHandlerContext {
		return {
			message,
			ask,
			workspacePath,
			toolInfo: parseToolFromMessage(message, workspacePath),
			logger,
		}
	}
}

// =============================================================================
// Exports
// =============================================================================

export { BaseToolHandler }
