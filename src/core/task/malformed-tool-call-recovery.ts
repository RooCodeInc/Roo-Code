/**
 * Malformed Tool Call Recovery
 *
 * Detects common XML-style tool call patterns in assistant text output when no
 * native tool calls were detected. This is especially common with open-weight
 * models (e.g., qwen3-coder) that sometimes emit tool calls as plain text
 * instead of using the native tool calling mechanism.
 *
 * IMPORTANT: Recovered information is NEVER auto-executed. It is only used to
 * provide a clearer retry message to the model so it can self-correct.
 */

export interface RecoveredToolCall {
	toolName: string
	parameters: Record<string, string>
}

/**
 * Attempts to recover a malformed tool call from the assistant's text output.
 *
 * Supported patterns:
 * 1. `<function=TOOL_NAME><parameter=PARAM_NAME>VALUE</parameter></function>` (with optional `</tool_call>`)
 * 2. `<tool_call><function=TOOL_NAME>...</function></tool_call>`
 * 3. XML-style `<TOOL_NAME><PARAM_NAME>VALUE</PARAM_NAME></TOOL_NAME>`
 *
 * @param text - The assistant's text output to scan
 * @returns A RecoveredToolCall if a malformed tool call is detected, or null otherwise
 */
export function recoverMalformedToolCall(text: string): RecoveredToolCall | null {
	// Pattern 1: <function=TOOL_NAME><parameter=PARAM_NAME>VALUE</parameter></function>
	// Optionally wrapped in <tool_call>...</tool_call>
	const functionPattern = /<function=([a-z_]+)>\s*([\s\S]*?)<\/function>/i
	const functionMatch = text.match(functionPattern)

	if (functionMatch) {
		const toolName = functionMatch[1]
		const body = functionMatch[2]

		const parameters: Record<string, string> = {}
		const paramPattern = /<parameter=([a-z_]+)>([\s\S]*?)<\/parameter>/gi
		let paramMatch

		while ((paramMatch = paramPattern.exec(body)) !== null) {
			parameters[paramMatch[1]] = paramMatch[2].trim()
		}

		return { toolName, parameters }
	}

	// Pattern 2: XML-style <tool_name><param_name>value</param_name></tool_name>
	// Common with some models that try to emulate XML tool calling.
	// Requires at least one underscore in the tool name to avoid matching regular HTML tags.
	const xmlToolPattern = /<([a-z]+_[a-z_]+)>\s*((?:<[a-z_]+>[\s\S]*?<\/[a-z_]+>\s*)+)<\/\1>/i
	const xmlMatch = text.match(xmlToolPattern)

	if (xmlMatch) {
		const toolName = xmlMatch[1]
		const body = xmlMatch[2]

		const parameters: Record<string, string> = {}
		const paramPattern = /<([a-z_]+)>([\s\S]*?)<\/\1>/gi
		let paramMatch

		while ((paramMatch = paramPattern.exec(body)) !== null) {
			parameters[paramMatch[1]] = paramMatch[2].trim()
		}

		// Only return if we found at least one parameter
		if (Object.keys(parameters).length > 0) {
			return { toolName, parameters }
		}
	}

	return null
}

/**
 * Formats a recovered tool call into a human-readable summary for the retry message.
 */
export function formatRecoveredToolCall(recovered: RecoveredToolCall): string {
	const paramSummary = Object.entries(recovered.parameters)
		.map(([key, value]) => {
			// Truncate long parameter values to keep the message concise
			const truncated = value.length > 100 ? value.substring(0, 100) + "..." : value
			return `  - ${key}: "${truncated}"`
		})
		.join("\n")

	return `Tool: ${recovered.toolName}\nParameters:\n${paramSummary}`
}
