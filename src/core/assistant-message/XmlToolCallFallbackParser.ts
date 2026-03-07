/**
 * Fallback parser for XML-formatted tool calls in text responses.
 *
 * When a model doesn't support native function/tool calling (common with
 * some OpenAI-compatible proxies), it may output tool calls as XML text
 * instead of structured tool_call events. This parser extracts those
 * XML tool calls from the text and converts them to ToolUse blocks.
 *
 * Supported format:
 *   <tool_name>
 *     <param_name>value</param_name>
 *   </tool_name>
 *
 * For example:
 *   <read_file>
 *     <path>src/main.ts</path>
 *   </read_file>
 */

import { type ToolName, toolNames } from "@roo-code/types"

import { type ToolUse, type ToolParamName, toolParamNames, TOOL_ALIASES } from "../../shared/tools"

/**
 * Set of all recognized tool names (canonical names + aliases).
 */
const ALL_TOOL_NAMES: Set<string> = new Set([...toolNames, ...Object.keys(TOOL_ALIASES)])

/**
 * Set of all recognized parameter names for quick lookup.
 */
const VALID_PARAM_NAMES: Set<string> = new Set(toolParamNames)

/**
 * Resolve an alias to its canonical tool name, or return the name as-is if not aliased.
 */
function resolveAlias(name: string): ToolName | undefined {
	if ((toolNames as readonly string[]).includes(name)) {
		return name as ToolName
	}
	const aliased = TOOL_ALIASES[name]
	return aliased ?? undefined
}

/**
 * Extract parameter values from the inner XML content of a tool call.
 *
 * Handles both single-line and multi-line parameter values:
 *   <path>src/main.ts</path>
 *   <content>line 1\nline 2</content>
 */
function extractParams(innerXml: string): Partial<Record<ToolParamName, string>> {
	const params: Partial<Record<ToolParamName, string>> = {}

	// Match XML parameter tags - supports multi-line content within params.
	// Uses a non-greedy match to handle multiple params correctly.
	const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g
	let match: RegExpExecArray | null

	while ((match = paramRegex.exec(innerXml)) !== null) {
		const paramName = match[1]
		const paramValue = match[2]

		if (VALID_PARAM_NAMES.has(paramName)) {
			params[paramName as ToolParamName] = paramValue
		}
	}

	return params
}

export interface XmlToolCallParseResult {
	/** The tool uses parsed from the text. */
	toolUses: ToolUse[]
	/** Whether any tool calls were found and parsed. */
	found: boolean
}

/**
 * Parse XML-formatted tool calls from text content.
 *
 * Scans the given text for patterns like `<tool_name><param>value</param></tool_name>`
 * where tool_name is a recognized tool name. Returns an array of ToolUse blocks.
 *
 * @param text - The text content to scan for XML tool calls
 * @returns Parse result with found tool uses
 */
export function parseXmlToolCalls(text: string): XmlToolCallParseResult {
	const toolUses: ToolUse[] = []

	if (!text || text.trim().length === 0) {
		return { toolUses, found: false }
	}

	// Build a regex that matches any known tool name as an XML tag.
	// The tool name must be a complete word boundary to avoid false positives
	// with tags like <environment_details>.
	const toolNamePattern = [...ALL_TOOL_NAMES].join("|")

	// Match: <tool_name>...content...</tool_name>
	// - Tool name must be an exact match (not a substring of another tag)
	// - Content between tags is captured (can be multi-line)
	const toolCallRegex = new RegExp(`<(${toolNamePattern})>([\\s\\S]*?)<\\/\\1>`, "g")

	let match: RegExpExecArray | null
	let idCounter = 0

	while ((match = toolCallRegex.exec(text)) !== null) {
		const rawToolName = match[1]
		const innerContent = match[2]

		const canonicalName = resolveAlias(rawToolName)
		if (!canonicalName) {
			continue
		}

		const params = extractParams(innerContent)

		idCounter++
		const toolUse: ToolUse = {
			type: "tool_use",
			id: `xml_fallback_${idCounter}_${Date.now()}`,
			name: canonicalName,
			params,
			partial: false,
			usedLegacyFormat: true,
		}

		// If the alias differs from canonical, preserve it
		if (rawToolName !== canonicalName) {
			toolUse.originalName = rawToolName
		}

		toolUses.push(toolUse)
	}

	return { toolUses, found: toolUses.length > 0 }
}
