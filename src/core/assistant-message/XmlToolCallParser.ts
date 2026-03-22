/**
 * XmlToolCallParser: streaming parser that detects XML-formatted tool calls
 * from model text output and converts them into ToolUse objects.
 *
 * When useXmlToolCalling is enabled, models output tool calls as XML text:
 *   <read_file>
 *     <path>src/app.ts</path>
 *   </read_file>
 *
 * This parser watches the accumulated text for complete tool call XML blocks,
 * extracts parameters, and delegates to NativeToolCallParser.parseToolCall()
 * to produce properly typed ToolUse objects with nativeArgs.
 */

import { randomUUID } from "crypto"

import { type ToolName, toolNames } from "@roo-code/types"
import { type ToolUse, type McpToolUse } from "../../shared/tools"
import { NativeToolCallParser } from "./NativeToolCallParser"
import { resolveToolAlias } from "../prompts/tools/filter-tools-for-mode"

// Build a Set of all known tool names (including aliases) for fast lookup
const KNOWN_TOOL_NAMES = new Set<string>([
	...toolNames,
	// Common aliases that models might use
	"write_file",
	"search_and_replace",
])

/**
 * Result from feeding text to the parser.
 */
export interface XmlParseResult {
	/** Any text before the tool call (to be displayed as chat text) */
	textBeforeToolCall: string
	/** Parsed tool calls found in the text */
	toolCalls: Array<ToolUse | McpToolUse>
	/** Any text after all parsed tool calls (remaining text to continue accumulating) */
	remainingText: string
}

/**
 * XmlToolCallParser detects and parses XML tool calls from streamed text.
 *
 * Usage:
 *   const parser = new XmlToolCallParser()
 *   // As text streams in, feed the full accumulated text:
 *   const result = parser.parse(accumulatedText)
 *   // result.textBeforeToolCall = text to display
 *   // result.toolCalls = completed tool calls to execute
 *   // result.remainingText = leftover text (may contain partial XML)
 */
export class XmlToolCallParser {
	/** Track which tool calls we've already emitted so we don't duplicate */
	private emittedToolCallCount = 0

	/**
	 * Parse accumulated text for XML tool calls.
	 *
	 * This method finds complete `<tool_name>...</tool_name>` blocks in the text,
	 * extracts parameters from child XML tags, and converts them into ToolUse objects.
	 *
	 * @param fullText - The complete accumulated assistant text so far
	 * @returns Parsed results with text segments and tool calls
	 */
	public parse(fullText: string): XmlParseResult {
		const toolCalls: Array<ToolUse | McpToolUse> = []
		let textBeforeToolCall = ""
		// Pre-process: strip thinking tags and convert alternative tool call formats
		let remainingText = this.stripThinkingTags(fullText)
		remainingText = this.normalizeToolCallFormat(remainingText)
		let searchStartIndex = 0

		// Scan for complete XML tool call blocks
		while (searchStartIndex < remainingText.length) {
			// Find the next opening tag that matches a known tool name
			const openTagMatch = this.findNextToolOpenTag(remainingText, searchStartIndex)

			if (!openTagMatch) {
				// No more tool tags found
				break
			}

			const { toolName, tagStart, tagEnd } = openTagMatch

			// Look for the matching closing tag
			const closeTag = `</${toolName}>`
			const closeTagIndex = remainingText.indexOf(closeTag, tagEnd)

			if (closeTagIndex === -1) {
				// Closing tag not found yet - this is a partial tool call still streaming.
				// Split: text before the opening tag is displayable, the rest is partial XML.
				if (toolCalls.length === 0) {
					textBeforeToolCall = remainingText.substring(0, tagStart).trimEnd()
					remainingText = remainingText.substring(tagStart)
				}
				// Return immediately — don't fall through to findPartialToolTagStart
				// which only checks the last 35 chars and would miss this.
				return { textBeforeToolCall, toolCalls, remainingText }
			}

			// We have a complete tool call block
			const xmlContent = remainingText.substring(tagEnd, closeTagIndex)
			const blockEnd = closeTagIndex + closeTag.length

			// Check if this tool call was already emitted
			const toolCallIndex = this.countCompletedToolCalls(remainingText.substring(0, blockEnd))
			if (toolCallIndex <= this.emittedToolCallCount) {
				// Already emitted, skip past it
				searchStartIndex = blockEnd
				continue
			}

			// Extract text before this tool call (only for the first un-emitted tool)
			if (toolCalls.length === 0) {
				textBeforeToolCall = remainingText.substring(0, tagStart).trimEnd()
			}

			// Parse the XML content into parameters
			const params = this.extractParams(xmlContent)

			// Convert to a ToolUse via NativeToolCallParser.parseToolCall()
			const toolCall = this.buildToolUse(toolName, params)
			if (toolCall) {
				toolCalls.push(toolCall)
				this.emittedToolCallCount++
			}

			searchStartIndex = blockEnd
		}

		// If we found tool calls, remaining text is everything after the last one
		if (toolCalls.length > 0) {
			remainingText = remainingText.substring(searchStartIndex).trimStart()
		} else {
			// No complete tool calls found.
			// Check if there's a partial opening tag at the end that we should not display yet.
			const partialTagStart = this.findPartialToolTagStart(remainingText)
			if (partialTagStart !== -1) {
				textBeforeToolCall = remainingText.substring(0, partialTagStart)
				remainingText = remainingText.substring(partialTagStart)
			} else {
				textBeforeToolCall = remainingText
				remainingText = ""
			}
		}

		return { textBeforeToolCall, toolCalls, remainingText }
	}

	/**
	 * Check if text currently contains a partial (incomplete) tool call XML tag
	 * that is still being streamed.
	 */
	public hasPartialToolCall(text: string): boolean {
		const cleanText = this.stripThinkingTags(text)
		const openTag = this.findNextToolOpenTag(cleanText, 0)
		if (!openTag) {
			return false
		}
		const closeTag = `</${openTag.toolName}>`
		return cleanText.indexOf(closeTag, openTag.tagEnd) === -1
	}

	/**
	 * Reset parser state (e.g. for a new message).
	 */
	public reset(): void {
		this.emittedToolCallCount = 0
	}

	/**
	 * Strip <thinking>...</thinking> tags and their content from text.
	 * Models sometimes output tool calls inside thinking tags which shouldn't be parsed,
	 * or the thinking content is so large it overwhelms the actual tool call.
	 */
	private stripThinkingTags(text: string): string {
		// Remove complete <thinking>...</thinking> blocks
		return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
	}

	/**
	 * Normalize alternative tool call formats to our standard XML format.
	 * Handles Meta/Llama style: <tool_call><function=tool_name><parameter=param>value</parameter></function></tool_call>
	 */
	private normalizeToolCallFormat(text: string): string {
		// Match <tool_call>...<function=TOOL_NAME>...<parameter=PARAM>VALUE</parameter>...</function></tool_call>
		const toolCallRegex = /<tool_call>\s*<function=([a-z_]+)>([\s\S]*?)<\/function>\s*<\/tool_call>/g
		return text.replace(toolCallRegex, (_match, toolName: string, content: string) => {
			// Extract <parameter=name>value</parameter> pairs
			const paramRegex = /<parameter=([a-z_]+)>([\s\S]*?)<\/parameter>/g
			const params: string[] = []
			let paramMatch: RegExpExecArray | null
			while ((paramMatch = paramRegex.exec(content)) !== null) {
				const paramName = paramMatch[1]
				const paramValue = paramMatch[2].trim()
				params.push(`<${paramName}>${paramValue}</${paramName}>`)
			}
			return `<${toolName}>\n${params.join("\n")}\n</${toolName}>`
		})
	}

	// ── Private helpers ───────────────────────────────────────────────

	/**
	 * Find the next opening XML tag that matches a known tool name.
	 */
	private findNextToolOpenTag(
		text: string,
		startIndex: number,
	): { toolName: string; tagStart: number; tagEnd: number } | null {
		// Match <tool_name> or <tool_name > (with optional whitespace)
		const tagRegex = /<([a-z_]+)(?:\s*)>/g
		tagRegex.lastIndex = startIndex

		let match: RegExpExecArray | null
		while ((match = tagRegex.exec(text)) !== null) {
			const candidateName = match[1]

			// Check if it's a known tool name (or an alias)
			if (KNOWN_TOOL_NAMES.has(candidateName)) {
				return {
					toolName: candidateName,
					tagStart: match.index,
					tagEnd: match.index + match[0].length,
				}
			}

			// Also check if it resolves to a known tool via alias
			const resolved = resolveToolAlias(candidateName)
			if (resolved !== candidateName && toolNames.includes(resolved as ToolName)) {
				return {
					toolName: candidateName,
					tagStart: match.index,
					tagEnd: match.index + match[0].length,
				}
			}
		}

		return null
	}

	/**
	 * Find the start of a potential partial tool tag at the end of the text.
	 * This prevents displaying partial `<read_fi` text that's still being streamed.
	 */
	private findPartialToolTagStart(text: string): number {
		// Look for an opening `<` near the end that could be the start of a tool tag
		// We check the last 30 chars (longest tool name is ~25 chars + angle brackets)
		const searchRegion = text.substring(Math.max(0, text.length - 35))
		const regionStart = Math.max(0, text.length - 35)

		const lastOpenAngle = searchRegion.lastIndexOf("<")
		if (lastOpenAngle === -1) {
			return -1
		}

		// Check if this `<` could be the start of a known tool tag
		const afterAngle = searchRegion.substring(lastOpenAngle + 1)

		// It's a partial tag if:
		// 1. We don't have a closing `>` yet, AND
		// 2. What we have so far could prefix a known tool name
		if (afterAngle.includes(">")) {
			return -1 // This tag is already closed, not partial
		}

		// Check if the partial text could be the beginning of a tool name
		const partialName = afterAngle.replace(/\s+$/, "")
		if (partialName.length === 0) {
			// Just a bare `<` at the end — could be anything
			return regionStart + lastOpenAngle
		}

		for (const name of KNOWN_TOOL_NAMES) {
			if (name.startsWith(partialName)) {
				return regionStart + lastOpenAngle
			}
		}

		return -1
	}

	/**
	 * Count how many complete tool call blocks exist in text up to a position.
	 */
	private countCompletedToolCalls(text: string): number {
		let count = 0
		let searchFrom = 0

		while (true) {
			const openTag = this.findNextToolOpenTag(text, searchFrom)
			if (!openTag) {
				break
			}
			const closeTag = `</${openTag.toolName}>`
			const closeIndex = text.indexOf(closeTag, openTag.tagEnd)
			if (closeIndex === -1) {
				break
			}
			count++
			searchFrom = closeIndex + closeTag.length
		}

		return count
	}

	/**
	 * Extract parameter key-value pairs from XML content.
	 * Handles nested XML tags like:
	 *   <path>src/app.ts</path>
	 *   <content>multi\nline\ncontent</content>
	 */
	private extractParams(xmlContent: string): Record<string, string> {
		const params: Record<string, string> = {}

		// Match parameter tags: <param_name>value</param_name>
		// Use a non-greedy match that handles multi-line values
		const paramRegex = /<([a-z_]+)>([\s\S]*?)<\/\1>/g

		let match: RegExpExecArray | null
		while ((match = paramRegex.exec(xmlContent)) !== null) {
			const paramName = match[1]
			let paramValue = match[2]

			// Trim leading/trailing whitespace from the value (models often add newlines)
			paramValue = paramValue.trim()

			params[paramName] = paramValue
		}

		return params
	}

	/**
	 * Build a ToolUse object from parsed XML parameters.
	 * Delegates to NativeToolCallParser.parseToolCall() for proper typing.
	 */
	private buildToolUse(toolName: string, params: Record<string, string>): ToolUse | McpToolUse | null {
		// Generate a synthetic tool call ID (Anthropic format)
		const syntheticId = `toolu_xml_${randomUUID().replace(/-/g, "").substring(0, 24)}`

		// Resolve aliases
		const resolvedName = resolveToolAlias(toolName) as ToolName

		// Convert string params to the right types for JSON args.
		// NativeToolCallParser.parseToolCall expects a JSON string of arguments.
		// We need to convert our extracted string params to the format the native parser expects.
		const args = this.convertParamsToArgs(resolvedName, params)

		try {
			const result = NativeToolCallParser.parseToolCall({
				id: syntheticId,
				name: resolvedName,
				arguments: JSON.stringify(args),
			})

			// NativeToolCallParser.parseToolCall doesn't set `id` on the returned ToolUse.
			// We must set it here so presentAssistantMessage.ts can find it and
			// pushToolResultToUserContent can reference it.
			if (result) {
				;(result as any).id = syntheticId
			}

			return result
		} catch (error) {
			console.error(`[XmlToolCallParser] Failed to parse tool call '${toolName}':`, error)
			return null
		}
	}

	/**
	 * Convert string XML params to properly typed argument objects.
	 * Most params remain strings, but some need type coercion (booleans, numbers, objects).
	 */
	private convertParamsToArgs(toolName: ToolName, params: Record<string, string>): Record<string, unknown> {
		const args: Record<string, unknown> = {}

		for (const [key, value] of Object.entries(params)) {
			switch (key) {
				// Boolean parameters
				case "recursive":
				case "replace_all":
				case "include_siblings":
				case "include_header":
					args[key] = value.toLowerCase() === "true"
					break

				// Numeric parameters
				case "offset":
				case "limit":
				case "timeout":
				case "anchor_line":
				case "max_levels":
				case "max_lines":
				case "expected_replacements":
					args[key] = parseInt(value, 10)
					break

				// JSON object parameters
				case "arguments":
					// For use_mcp_tool, arguments is a JSON object
					if (toolName === "use_mcp_tool") {
						try {
							args[key] = JSON.parse(value)
						} catch {
							args[key] = value
						}
					} else {
						args[key] = value
					}
					break

				case "follow_up":
					// ask_followup_question follow_up — models output in many formats:
					//   1. JSON array: [{"text":"a"},{"text":"b"}]
					//   2. JSON objects without brackets: {"text":"a"},{"text":"b"}
					//   3. JSON objects without commas: {"text":"a"} {"text":"b"}
					//   4. <suggest> XML tags (Kilo Code/Cline format):
					//      <suggest>Option A</suggest><suggest mode="code">Option B</suggest>
					//   5. Plain text suggestions
					{
						// First check for <suggest> tags (common XML format from Kilo/Cline trained models)
						const suggestRegex = /<suggest(?:\s+mode="([^"]*)")?>([\s\S]*?)<\/suggest>/g
						const suggests: Array<{ text: string; mode?: string }> = []
						let suggestMatch: RegExpExecArray | null
						while ((suggestMatch = suggestRegex.exec(value)) !== null) {
							const mode = suggestMatch[1]
							const text = suggestMatch[2].trim()
							if (text) {
								suggests.push(mode ? { text, mode } : { text })
							}
						}
						if (suggests.length > 0) {
							args[key] = suggests
							break
						}

						// Try JSON formats
						try {
							args[key] = JSON.parse(value)
						} catch {
							try {
								const fixed = value.replace(/\}\s*\{/g, "},{")
								args[key] = JSON.parse(`[${fixed}]`)
							} catch {
								// Plain text fallback
								args[key] = [{ text: value }]
							}
						}
					}
					break

				case "todos":
					// update_todo_list and new_task todos — could be JSON or plain text
					if (toolName === "update_todo_list" || toolName === "new_task") {
						args[key] = value
					} else {
						args[key] = value
					}
					break

				case "indentation":
					// read_file indentation is a JSON object
					try {
						args[key] = JSON.parse(value)
					} catch {
						args[key] = value
					}
					break

				// Everything else is a string
				default:
					args[key] = value
					break
			}
		}

		return args
	}
}
