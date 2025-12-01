/**
 * Parser for Kimi K2 model's tool call format
 * Handles the <|tool_calls_section_begin|> style format
 */
export class KimiToolCallParser {
	private buffer: string = ""
	private inToolCallSection: boolean = false
	private currentToolCall: {
		id?: string
		name?: string
		arguments?: string
	} = {}

	/**
	 * Process a chunk of text and extract tool calls if present
	 * @param chunk The text chunk to process
	 * @returns Array of parsed content (text or tool calls)
	 */
	public processChunk(chunk: string): Array<{ type: "text" | "tool_call"; content?: string; toolCall?: any }> {
		const results: Array<{ type: "text" | "tool_call"; content?: string; toolCall?: any }> = []
		this.buffer += chunk

		// Check for tool call section markers
		const toolCallStartPattern = /<\|tool_calls_section_begin\|>/g
		const toolCallSectionEndPattern = /<\|tool_calls_section_end\|>/g
		const toolCallBeginPattern = /<\|tool_call_begin\|>/g
		const toolCallEndPattern = /<\|tool_call_end\|>/g
		const toolCallArgPattern = /<\|tool_call_argument_begin\|>/g

		let processedBuffer = this.buffer

		// Process tool call sections
		while (true) {
			const startMatch = processedBuffer.match(toolCallStartPattern)
			if (!startMatch) break

			const startIndex = startMatch.index!
			const beforeToolCall = processedBuffer.substring(0, startIndex)

			// Add any text before the tool call section
			if (beforeToolCall.trim()) {
				results.push({ type: "text", content: beforeToolCall })
			}

			// Find the end of the tool call section
			const endMatch = processedBuffer.substring(startIndex).match(toolCallSectionEndPattern)
			if (!endMatch) {
				// Tool call section not complete yet, keep it in buffer
				this.buffer = processedBuffer.substring(startIndex)
				return results
			}

			const endIndex = startIndex + endMatch.index! + endMatch[0].length
			const toolCallSection = processedBuffer.substring(startIndex, endIndex)

			// Parse the tool call section
			const toolCall = this.parseToolCallSection(toolCallSection)
			if (toolCall) {
				results.push({ type: "tool_call", toolCall })
			}

			// Continue processing the rest of the buffer
			processedBuffer = processedBuffer.substring(endIndex)
		}

		// Handle remaining text
		if (processedBuffer.trim()) {
			// Check if we might be in the middle of a tool call marker
			const partialMarkers = ["<|tool_calls_section_begin", "<|tool_call_begin", "<|tool_call_argument_begin"]
			const hasPartialMarker = partialMarkers.some((marker) => processedBuffer.includes(marker))

			if (hasPartialMarker) {
				// Keep partial markers in buffer for next chunk
				this.buffer = processedBuffer
			} else {
				// Output remaining text
				results.push({ type: "text", content: processedBuffer })
				this.buffer = ""
			}
		} else {
			this.buffer = ""
		}

		return results
	}

	/**
	 * Parse a complete tool call section
	 */
	private parseToolCallSection(section: string): any | null {
		// Extract tool call details
		const toolCallMatch = section.match(
			/<\|tool_call_begin\|>\s*functions\.(\w+):(\d+)\s*<\|tool_call_argument_begin\|>\s*({[^}]*})\s*<\|tool_call_end\|>/,
		)

		if (toolCallMatch) {
			const [, functionName, callId, argumentsJson] = toolCallMatch
			try {
				const args = JSON.parse(argumentsJson)
				return {
					id: `tool_call_${callId}`,
					name: functionName,
					arguments: JSON.stringify(args),
				}
			} catch (e) {
				console.error("Failed to parse Kimi tool call arguments:", e)
				return null
			}
		}

		// Alternative format without explicit function prefix
		const altMatch = section.match(
			/<\|tool_call_begin\|>\s*(\w+):(\d+)\s*<\|tool_call_argument_begin\|>\s*({[^}]*})\s*<\|tool_call_end\|>/,
		)

		if (altMatch) {
			const [, functionName, callId, argumentsJson] = altMatch
			try {
				const args = JSON.parse(argumentsJson)
				return {
					id: `tool_call_${callId}`,
					name: functionName,
					arguments: JSON.stringify(args),
				}
			} catch (e) {
				console.error("Failed to parse Kimi tool call arguments:", e)
				return null
			}
		}

		return null
	}

	/**
	 * Get any remaining buffered content
	 */
	public flush(): Array<{ type: "text" | "tool_call"; content?: string; toolCall?: any }> {
		const results: Array<{ type: "text" | "tool_call"; content?: string; toolCall?: any }> = []
		if (this.buffer.trim()) {
			results.push({ type: "text", content: this.buffer })
			this.buffer = ""
		}
		return results
	}
}
