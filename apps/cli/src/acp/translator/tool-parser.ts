/**
 * Tool Parser
 *
 * Parses tool information from ClineMessage format.
 * Extracts tool name, parameters, and generates titles.
 */

import * as path from "node:path"
import type * as acp from "@agentclientprotocol/sdk"
import type { ClineMessage } from "@roo-code/types"

import { mapToolToKind, isEditTool as isFileEditTool } from "../tool-registry.js"
import { extractLocations } from "./location-extractor.js"
import { parseUnifiedDiff } from "./diff-parser.js"
import { resolveFilePathUnsafe } from "../utils/index.js"

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed tool call information.
 */
export interface ToolCallInfo {
	/** Unique identifier for the tool call */
	id: string
	/** Tool name */
	name: string
	/** Human-readable title */
	title: string
	/** Tool parameters */
	params: Record<string, unknown>
	/** File locations involved */
	locations: acp.ToolCallLocation[]
	/** Tool content (diffs, etc.) */
	content?: acp.ToolCallContent[]
}

// =============================================================================
// Tool Call ID Generation
// =============================================================================

/**
 * Generate a tool call ID from a ClineMessage timestamp.
 *
 * Uses the message timestamp directly, which provides:
 * - Deterministic IDs - same message always produces same ID
 * - Natural deduplication - duplicate waitingForInput events use same ID
 * - Easy debugging - can correlate ACP tool calls to ClineMessages
 * - Sortable by creation time
 *
 * @param timestamp - ClineMessage timestamp (message.ts)
 * @returns Tool call ID
 */
function generateToolCallId(timestamp: number): string {
	return `tool-${timestamp}`
}

// =============================================================================
// Tool Parsing
// =============================================================================

/**
 * Parse tool information from a ClineMessage.
 *
 * Handles two formats:
 * 1. JSON format: Message text is JSON with tool name and parameters
 * 2. Text format: Tool name extracted from text like "Using/Executing/Running X"
 *
 * @param message - The ClineMessage to parse
 * @param workspacePath - Optional workspace path to resolve relative paths
 * @returns Parsed tool info or null if parsing fails
 */
export function parseToolFromMessage(message: ClineMessage, workspacePath?: string): ToolCallInfo | null {
	if (!message.text) {
		return null
	}

	// Tool messages typically have JSON content describing the tool
	try {
		// Try to parse as JSON first
		if (message.text.startsWith("{")) {
			const parsed = JSON.parse(message.text) as Record<string, unknown>
			const toolName = (parsed.tool as string) || "unknown"
			const filePath = (parsed.path as string) || undefined

			return {
				id: generateToolCallId(message.ts),
				name: toolName,
				title: generateToolTitle(toolName, filePath),
				params: parsed,
				locations: extractLocations(parsed, workspacePath),
				content: extractToolContent(parsed, workspacePath),
			}
		}
	} catch {
		// Not JSON, try to extract tool info from text
	}

	// Extract tool name from text content
	const toolMatch = message.text.match(/(?:Using|Executing|Running)\s+(\w+)/i)
	const toolName = toolMatch?.[1] || "unknown"

	return {
		id: generateToolCallId(message.ts),
		name: toolName,
		title: message.text.slice(0, 100),
		params: {},
		locations: [],
	}
}

// =============================================================================
// Tool Title Generation
// =============================================================================

/**
 * Generate a human-readable title for a tool operation.
 *
 * Maps tool names to descriptive titles, optionally including file names.
 *
 * @param toolName - The tool name
 * @param filePath - Optional file path for context
 * @returns Human-readable title
 */
export function generateToolTitle(toolName: string, filePath?: string): string {
	const fileName = filePath ? path.basename(filePath) : undefined

	// Map tool names to human-readable titles
	const toolTitles: Record<string, string> = {
		// File creation
		newFileCreated: fileName ? `Creating ${fileName}` : "Creating file",
		write_to_file: fileName ? `Writing ${fileName}` : "Writing file",
		create_file: fileName ? `Creating ${fileName}` : "Creating file",

		// File editing
		editedExistingFile: fileName ? `Edit ${fileName}` : "Edit file",
		apply_diff: fileName ? `Edit ${fileName}` : "Edit file",
		appliedDiff: fileName ? `Edit ${fileName}` : "Edit file",
		modify_file: fileName ? `Edit ${fileName}` : "Edit file",

		// File reading
		read_file: fileName ? `Read ${fileName}` : "Read file",
		readFile: fileName ? `Read ${fileName}` : "Read file",

		// File listing
		list_files: filePath ? `Listing files in ${filePath}` : "Listing files",
		listFiles: filePath ? `Listing files in ${filePath}` : "Listing files",

		// File search
		search_files: "Searching files",
		searchFiles: "Searching files",

		// Command execution
		execute_command: "Running command",
		executeCommand: "Running command",

		// Browser actions
		browser_action: "Browser action",
		browserAction: "Browser action",

		// Plan updates
		updateTodoList: "Update plan",
		update_todo_list: "Update plan",
	}

	return toolTitles[toolName] || (fileName ? `${toolName}: ${fileName}` : toolName)
}

// =============================================================================
// Tool Content Extraction
// =============================================================================

/**
 * Extract tool content for ACP (diffs, text, etc.)
 *
 * For file edit tools, parses the content as a unified diff.
 *
 * @param params - Tool parameters
 * @param workspacePath - Optional workspace path
 * @returns Array of tool content or undefined
 */
export function extractToolContent(
	params: Record<string, unknown>,
	workspacePath?: string,
): acp.ToolCallContent[] | undefined {
	const content: acp.ToolCallContent[] = []

	// Check if this is a file operation with diff content
	const filePath = params.path as string | undefined
	const diffContent = params.content as string | undefined
	const toolName = params.tool as string | undefined

	if (filePath && diffContent && isFileEditTool(toolName || "")) {
		const absolutePath = resolveFilePathUnsafe(filePath, workspacePath)
		const parsedDiff = parseUnifiedDiff(diffContent)

		if (parsedDiff) {
			// Use ACP diff format
			content.push({
				type: "diff",
				path: absolutePath,
				oldText: parsedDiff.oldText,
				newText: parsedDiff.newText,
			} as acp.ToolCallContent)
		}
	}

	return content.length > 0 ? content : undefined
}

// =============================================================================
// Tool Call Building
// =============================================================================

/**
 * Build an ACP ToolCall from a ClineMessage.
 *
 * @param message - The ClineMessage to parse
 * @param workspacePath - Optional workspace path to resolve relative paths
 * @returns ACP ToolCall object
 */
export function buildToolCallFromMessage(message: ClineMessage, workspacePath?: string): acp.ToolCall {
	const toolInfo = parseToolFromMessage(message, workspacePath)

	const toolCall: acp.ToolCall = {
		toolCallId: toolInfo?.id || generateToolCallId(message.ts),
		title: toolInfo?.title || message.text?.slice(0, 100) || "Tool execution",
		kind: toolInfo ? mapToolToKind(toolInfo.name) : "other",
		status: "pending",
		locations: toolInfo?.locations || [],
		rawInput: toolInfo?.params || {},
	}

	// Include content if available (e.g., diffs for file operations)
	if (toolInfo?.content && toolInfo.content.length > 0) {
		toolCall.content = toolInfo.content
	}

	return toolCall
}
