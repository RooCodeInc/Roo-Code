import { v4 as uuidv4 } from "uuid"

import { type ToolName, toolNames } from "@roo-code/types"

import { type ToolUse, type ToolParamName, toolParamNames } from "../../shared/tools"
import { resolveToolAlias } from "../prompts/tools/filter-tools-for-mode"

/**
 * List of tool names that can be parsed from XML format.
 * These match the tools in containsXmlToolMarkup() in presentAssistantMessage.ts
 */
const XML_TOOL_NAMES = [
	"access_mcp_resource",
	"apply_diff",
	"apply_patch",
	"ask_followup_question",
	"attempt_completion",
	"browser_action",
	"codebase_search",
	"edit_file",
	"execute_command",
	"fetch_instructions",
	"generate_image",
	"list_files",
	"new_task",
	"read_file",
	"search_and_replace",
	"search_files",
	"search_replace",
	"switch_mode",
	"update_todo_list",
	"use_mcp_tool",
	"write_to_file",
] as const

/**
 * Result of parsing XML tool calls from text.
 */
export interface XmlToolCallParseResult {
	/** The tool use objects extracted from the text */
	toolUses: ToolUse[]
	/** Any text content that was not part of a tool call */
	remainingText: string
	/** Whether any tool calls were found */
	hasToolCalls: boolean
}

/**
 * Parser for XML-formatted tool calls.
 *
 * Some API providers (like kie.ai with Gemini 3 Pro) don't fully support
 * native function calling and instead output XML-formatted tool calls in
 * the text response. This parser extracts those tool calls and converts
 * them to the ToolUse format used by the existing tool execution infrastructure.
 *
 * Example XML format:
 * ```
 * <read_file>
 * <path>src/file.ts</path>
 * </read_file>
 * ```
 */
export class XmlToolCallParser {
	/**
	 * Generate a unique tool call ID for native protocol compatibility.
	 * Uses the format "toolu_" prefix followed by a UUID to match Anthropic's format.
	 */
	private static generateToolCallId(): string {
		return `toolu_${uuidv4().replace(/-/g, "").substring(0, 24)}`
	}

	/**
	 * Check if text contains XML tool markup (outside of code blocks).
	 */
	public static containsXmlToolMarkup(text: string): boolean {
		// Strip code blocks first to avoid false positives
		const textWithoutCodeBlocks = text
			.replace(/```[\s\S]*?```/g, "") // Remove fenced code blocks
			.replace(/`[^`]+`/g, "") // Remove inline code

		const lower = textWithoutCodeBlocks.toLowerCase()
		if (!lower.includes("<") || !lower.includes(">")) {
			return false
		}

		return XML_TOOL_NAMES.some((name) => lower.includes(`<${name}`) || lower.includes(`</${name}`))
	}

	/**
	 * Parse XML tool calls from text content.
	 *
	 * @param text - The text content potentially containing XML tool calls
	 * @returns Parse result with extracted tool uses and remaining text
	 */
	public static parseXmlToolCalls(text: string): XmlToolCallParseResult {
		// Collect all matches with their positions to maintain document order
		const matches: Array<{
			position: number
			fullMatch: string
			innerContent: string
			toolName: string
		}> = []

		// Find all tool matches across all tool names
		for (const toolName of XML_TOOL_NAMES) {
			// Pattern to match complete tool tags: <tool_name>...</tool_name>
			// Uses a non-greedy match for content to handle multiple tool calls
			const regex = new RegExp(`<${toolName}>([\\s\\S]*?)</${toolName}>`, "gi")

			let match
			while ((match = regex.exec(text)) !== null) {
				matches.push({
					position: match.index,
					fullMatch: match[0],
					innerContent: match[1],
					toolName,
				})
			}
		}

		// Sort matches by position to maintain document order
		matches.sort((a, b) => a.position - b.position)

		// Process matches in document order
		const toolUses: ToolUse[] = []
		let remainingText = text

		for (const match of matches) {
			// Parse the inner XML parameters
			const params = this.parseToolParams(match.innerContent)

			// Resolve tool alias to canonical name
			const resolvedName = resolveToolAlias(match.toolName) as ToolName

			// Create the ToolUse object
			const toolUse = this.createToolUse(resolvedName, params, match.toolName)

			if (toolUse) {
				toolUses.push(toolUse)
			}

			// Remove the matched tool call from remaining text
			remainingText = remainingText.replace(match.fullMatch, "")
		}

		// Clean up remaining text - trim and remove multiple consecutive newlines
		remainingText = remainingText.replace(/\n{3,}/g, "\n\n").trim()

		return {
			toolUses,
			remainingText,
			hasToolCalls: toolUses.length > 0,
		}
	}

	/**
	 * Parse parameter tags from XML tool content.
	 * Handles both simple text content and nested structures.
	 *
	 * @param content - The inner content of a tool tag
	 * @returns Map of parameter names to their values
	 */
	private static parseToolParams(content: string): Map<string, string> {
		const params = new Map<string, string>()

		// Match parameter tags: <param_name>value</param_name>
		// Also handles CDATA sections and multi-line content
		const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g

		let match
		while ((match = paramRegex.exec(content)) !== null) {
			const paramName = match[1]
			let paramValue = match[2]

			// Handle CDATA sections
			const cdataMatch = paramValue.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
			if (cdataMatch) {
				paramValue = cdataMatch[1]
			} else {
				// Trim whitespace for regular values
				paramValue = paramValue.trim()
			}

			params.set(paramName, paramValue)
		}

		return params
	}

	/**
	 * Create a ToolUse object from parsed parameters.
	 *
	 * @param name - The canonical tool name
	 * @param params - Map of parameter names to values
	 * @param originalName - The original tool name if it was an alias
	 * @returns ToolUse object or null if parameters are invalid
	 */
	private static createToolUse(name: ToolName, params: Map<string, string>, originalName?: string): ToolUse | null {
		// Validate tool name
		if (!toolNames.includes(name)) {
			console.warn(`[XmlToolCallParser] Unknown tool name: ${name}`)
			return null
		}

		// Convert params Map to the record format expected by ToolUse
		const paramsRecord: Partial<Record<ToolParamName, string>> = {}
		for (const [key, value] of params.entries()) {
			if (toolParamNames.includes(key as ToolParamName)) {
				paramsRecord[key as ToolParamName] = value
			}
		}

		// Build nativeArgs based on tool type
		const nativeArgs = this.buildNativeArgs(name, params)

		const toolUse: ToolUse = {
			type: "tool_use",
			id: this.generateToolCallId(),
			name,
			params: paramsRecord,
			partial: false,
			nativeArgs,
		}

		// Preserve original name if it was an alias
		if (originalName && originalName !== name) {
			toolUse.originalName = originalName
		}

		return toolUse
	}

	/**
	 * Build typed nativeArgs for a tool based on its parameters.
	 * This mirrors the logic in NativeToolCallParser.parseToolCall().
	 *
	 * @param name - The tool name
	 * @param params - Map of parameter names to string values
	 * @returns Typed nativeArgs object or undefined
	 */
	private static buildNativeArgs(name: ToolName, params: Map<string, string>): any {
		// Helper to safely get and parse JSON values
		const getJson = (key: string): any => {
			const value = params.get(key)
			if (!value) {
				return undefined
			}
			try {
				return JSON.parse(value)
			} catch {
				return value
			}
		}

		const get = (key: string): string | undefined => params.get(key)
		const getBool = (key: string): boolean | undefined => {
			const value = params.get(key)
			if (value === undefined) {
				return undefined
			}
			return value.toLowerCase() === "true"
		}

		switch (name) {
			case "read_file": {
				// For XML format, files is typically a path string, not an array
				const path = get("path")
				if (path) {
					return { files: [{ path }] }
				}
				// Try parsing as JSON array if provided
				const files = getJson("files")
				if (Array.isArray(files)) {
					return { files }
				}
				return undefined
			}

			case "attempt_completion": {
				const result = get("result")
				if (result !== undefined) {
					return { result }
				}
				return undefined
			}

			case "execute_command": {
				const command = get("command")
				if (command) {
					return {
						command,
						cwd: get("cwd"),
					}
				}
				return undefined
			}

			case "write_to_file": {
				const path = get("path")
				const content = get("content")
				if (path !== undefined && content !== undefined) {
					return { path, content }
				}
				return undefined
			}

			case "apply_diff": {
				const path = get("path")
				const diff = get("diff")
				if (path !== undefined && diff !== undefined) {
					return { path, diff }
				}
				return undefined
			}

			case "search_and_replace": {
				const path = get("path")
				const operations = getJson("operations")
				if (path !== undefined && Array.isArray(operations)) {
					return { path, operations }
				}
				return undefined
			}

			case "ask_followup_question": {
				const question = get("question")
				const follow_up = getJson("follow_up")
				if (question !== undefined && follow_up !== undefined) {
					return { question, follow_up }
				}
				return undefined
			}

			case "browser_action": {
				const action = get("action")
				if (action !== undefined) {
					return {
						action,
						url: get("url"),
						coordinate: get("coordinate"),
						size: get("size"),
						text: get("text"),
						path: get("path"),
					}
				}
				return undefined
			}

			case "codebase_search": {
				const query = get("query")
				if (query !== undefined) {
					return {
						query,
						path: get("path"),
					}
				}
				return undefined
			}

			case "fetch_instructions": {
				const task = get("task")
				if (task !== undefined) {
					return { task }
				}
				return undefined
			}

			case "generate_image": {
				const prompt = get("prompt")
				const path = get("path")
				if (prompt !== undefined && path !== undefined) {
					return {
						prompt,
						path,
						image: get("image"),
					}
				}
				return undefined
			}

			case "run_slash_command": {
				const command = get("command")
				if (command !== undefined) {
					return {
						command,
						args: get("args"),
					}
				}
				return undefined
			}

			case "search_files": {
				const path = get("path")
				const regex = get("regex")
				if (path !== undefined && regex !== undefined) {
					return {
						path,
						regex,
						file_pattern: get("file_pattern"),
					}
				}
				return undefined
			}

			case "switch_mode": {
				const mode_slug = get("mode_slug")
				const reason = get("reason")
				if (mode_slug !== undefined && reason !== undefined) {
					return { mode_slug, reason }
				}
				return undefined
			}

			case "update_todo_list": {
				const todos = get("todos")
				if (todos !== undefined) {
					return { todos }
				}
				return undefined
			}

			case "use_mcp_tool": {
				const server_name = get("server_name")
				const tool_name = get("tool_name")
				if (server_name !== undefined && tool_name !== undefined) {
					return {
						server_name,
						tool_name,
						arguments: getJson("arguments"),
					}
				}
				return undefined
			}

			case "access_mcp_resource": {
				const server_name = get("server_name")
				const uri = get("uri")
				if (server_name !== undefined && uri !== undefined) {
					return { server_name, uri }
				}
				return undefined
			}

			case "apply_patch": {
				const patch = get("patch")
				if (patch !== undefined) {
					return { patch }
				}
				return undefined
			}

			case "search_replace": {
				const file_path = get("file_path")
				const old_string = get("old_string")
				const new_string = get("new_string")
				if (file_path !== undefined && old_string !== undefined && new_string !== undefined) {
					return { file_path, old_string, new_string }
				}
				return undefined
			}

			case "edit_file": {
				const file_path = get("file_path")
				const old_string = get("old_string")
				const new_string = get("new_string")
				if (file_path !== undefined && old_string !== undefined && new_string !== undefined) {
					return {
						file_path,
						old_string,
						new_string,
						expected_replacements: getJson("expected_replacements"),
					}
				}
				return undefined
			}

			case "list_files": {
				const path = get("path")
				if (path !== undefined) {
					return {
						path,
						recursive: getBool("recursive"),
					}
				}
				return undefined
			}

			case "new_task": {
				const mode = get("mode")
				const message = get("message")
				if (mode !== undefined && message !== undefined) {
					return {
						mode,
						message,
						todos: get("todos"),
					}
				}
				return undefined
			}

			default:
				return undefined
		}
	}
}
