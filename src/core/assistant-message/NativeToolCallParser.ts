import { type ToolName, toolNames } from "@roo-code/types"
import { type ToolUse, type ToolParamName, toolParamNames } from "../../shared/tools"

/**
 * Parser for native tool calls (OpenAI-style function calling).
 * Converts native tool call format to ToolUse format for compatibility
 * with existing tool execution infrastructure.
 */
export class NativeToolCallParser {
	/**
	 * Convert a native tool call chunk to a ToolUse object.
	 *
	 * @param toolCall - The native tool call from the API stream
	 * @returns A ToolUse object compatible with existing tool handlers
	 */
	public static parseToolCall(toolCall: { id: string; name: string; arguments: string }): ToolUse | null {
		console.log(`[NATIVE_TOOL] Parser received:`, {
			id: toolCall.id,
			name: toolCall.name,
			arguments: toolCall.arguments,
		})

		// Validate tool name
		if (!toolNames.includes(toolCall.name as ToolName)) {
			console.error(`[NATIVE_TOOL] Invalid tool name: ${toolCall.name}`)
			console.error(`[NATIVE_TOOL] Valid tool names:`, toolNames)
			return null
		}

		console.log(`[NATIVE_TOOL] Tool name validated: ${toolCall.name}`)

		try {
			// Parse the arguments JSON string
			console.log(`[NATIVE_TOOL] Parsing arguments JSON:`, toolCall.arguments)
			const args = JSON.parse(toolCall.arguments)
			console.log(`[NATIVE_TOOL] Parsed args:`, args)

			// Convert arguments to params format
			const params: Partial<Record<ToolParamName, string>> = {}

			for (const [key, value] of Object.entries(args)) {
				console.log(`[NATIVE_TOOL] Processing param: ${key} =`, value)

				// Validate parameter name
				if (!toolParamNames.includes(key as ToolParamName)) {
					console.warn(`[NATIVE_TOOL] Unknown parameter '${key}' for tool '${toolCall.name}'`)
					console.warn(`[NATIVE_TOOL] Valid param names:`, toolParamNames)
					continue
				}

				// Convert value to string if it isn't already
				const stringValue = typeof value === "string" ? value : JSON.stringify(value)
				params[key as ToolParamName] = stringValue
				console.log(`[NATIVE_TOOL] Added param: ${key} = "${stringValue}"`)
			}

			const result = {
				type: "tool_use" as const,
				name: toolCall.name as ToolName,
				params,
				partial: false, // Native tool calls are always complete when yielded
			}

			console.log(`[NATIVE_TOOL] Parser returning ToolUse:`, result)
			return result
		} catch (error) {
			console.error(`[NATIVE_TOOL] Failed to parse tool call arguments:`, error)
			console.error(`[NATIVE_TOOL] Error details:`, error instanceof Error ? error.message : String(error))
			return null
		}
	}
}
