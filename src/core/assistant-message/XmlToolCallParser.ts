/**
 * Parser for XML-style tool calls from models like Qwen3-Coder-Next.
 *
 * Some models (especially local models running via llama.cpp) output XML-style tool calls
 * instead of native JSON tool calls. This parser detects and converts them to the same
 * tool call events (tool_call_start/delta/end) that native tool calling uses.
 *
 * Example XML format:
 * ```
 * <function=read_file>
 * <parameter=path>src/main.ts</parameter>
 * </function>
 * ```
 *
 * Or with equals signs inside parameter values:
 * ```
 * <function=attempt_completion>
 * <parameter=result>Task completed successfully</parameter>
 * </function>
 * ```
 */

import type {
	ApiStreamToolCallStartChunk,
	ApiStreamToolCallDeltaChunk,
	ApiStreamToolCallEndChunk,
} from "../../api/transform/stream"

export type XmlToolCallEvent = ApiStreamToolCallStartChunk | ApiStreamToolCallDeltaChunk | ApiStreamToolCallEndChunk

/**
 * State for tracking an in-progress XML tool call during streaming.
 */
interface XmlToolCallState {
	id: string
	name: string
	parameters: Record<string, string>
	hasStarted: boolean
	buffer: string
}

/**
 * Result of processing text through the XML tool call parser.
 */
export interface XmlToolCallParseResult {
	/** Text content that is NOT part of a tool call (to be displayed to user) */
	textContent: string
	/** Tool call events to be processed */
	events: XmlToolCallEvent[]
	/** Whether we're currently inside an incomplete tool call (for streaming) */
	isPartialToolCall: boolean
}

/**
 * Parser for XML-style tool calls.
 *
 * This parser maintains state across multiple text chunks to handle streaming scenarios
 * where a tool call may be split across multiple chunks.
 */
export class XmlToolCallParser {
	private static toolCallCounter = 0

	/** Buffer for accumulating text that might be part of a tool call */
	private buffer: string = ""

	/** Current in-progress tool call state */
	private currentToolCall: XmlToolCallState | null = null

	/** Track if we've detected the start of a potential tool call */
	private potentialToolCallStart: boolean = false

	/**
	 * Generate a unique ID for XML tool calls.
	 * Uses a prefix to distinguish from native tool call IDs.
	 */
	private static generateToolCallId(): string {
		return `xml_tool_${Date.now()}_${++this.toolCallCounter}`
	}

	/**
	 * Check if text contains an XML tool call pattern.
	 * Returns true if the text contains a complete or partial tool call.
	 */
	public static containsXmlToolCall(text: string): boolean {
		// Check for complete function tag
		if (/<function=\w+>/.test(text)) {
			return true
		}
		// Check for start of function tag (partial)
		if (/<function=/.test(text) || /<function$/.test(text)) {
			return true
		}
		// Check for opening angle bracket that might be start of a tag
		if (/<$/.test(text)) {
			return true
		}
		return false
	}

	/**
	 * Process a text chunk and extract any XML tool calls.
	 *
	 * @param text - The text chunk to process
	 * @returns Parse result with text content and tool call events
	 */
	public processChunk(text: string): XmlToolCallParseResult {
		const events: XmlToolCallEvent[] = []
		let textContent = ""

		// Add new text to buffer
		this.buffer += text

		// Process the buffer
		while (this.buffer.length > 0) {
			// If we're inside a tool call, look for the end
			if (this.currentToolCall) {
				const result = this.processInsideToolCall()
				events.push(...result.events)
				if (result.completed) {
					this.currentToolCall = null
				} else {
					// Tool call is incomplete, wait for more data
					break
				}
			} else {
				// Look for the start of a tool call
				const functionMatch = this.buffer.match(/<function=(\w+)>/)

				if (functionMatch) {
					const matchIndex = functionMatch.index!
					const matchEnd = matchIndex + functionMatch[0].length

					// Output any text before the tool call
					if (matchIndex > 0) {
						textContent += this.buffer.substring(0, matchIndex)
					}

					// Start a new tool call
					const toolName = functionMatch[1]
					const toolId = XmlToolCallParser.generateToolCallId()

					this.currentToolCall = {
						id: toolId,
						name: toolName,
						parameters: {},
						hasStarted: false,
						buffer: "",
					}

					// Remove processed content from buffer
					this.buffer = this.buffer.substring(matchEnd)

					// Emit start event
					events.push({
						type: "tool_call_start",
						id: toolId,
						name: toolName,
					})
					this.currentToolCall.hasStarted = true
				} else if (
					this.buffer.includes("<function=") ||
					this.buffer.endsWith("<") ||
					this.buffer.endsWith("<f")
				) {
					// Potential partial tool call start - wait for more data
					// But first check if we have any complete text before the potential start
					const potentialStart = this.buffer.lastIndexOf("<")
					if (potentialStart > 0) {
						// Check if it looks like it could be a function tag
						const afterBracket = this.buffer.substring(potentialStart)
						if (
							afterBracket === "<" ||
							afterBracket.startsWith("<f") ||
							afterBracket.startsWith("<fu") ||
							afterBracket.startsWith("<fun") ||
							afterBracket.startsWith("<func") ||
							afterBracket.startsWith("<funct") ||
							afterBracket.startsWith("<functi") ||
							afterBracket.startsWith("<functio") ||
							afterBracket.startsWith("<function") ||
							afterBracket.startsWith("<function=")
						) {
							textContent += this.buffer.substring(0, potentialStart)
							this.buffer = afterBracket
							this.potentialToolCallStart = true
							break
						}
					}
					// If we get here with a partial <function= at the start, wait for more
					if (this.buffer.startsWith("<function=") && !this.buffer.includes(">")) {
						this.potentialToolCallStart = true
						break
					}
					// Not a tool call pattern, output as text
					textContent += this.buffer
					this.buffer = ""
				} else {
					// No tool call found, output all text
					textContent += this.buffer
					this.buffer = ""
				}
			}
		}

		return {
			textContent,
			events,
			isPartialToolCall: this.currentToolCall !== null || this.potentialToolCallStart,
		}
	}

	/**
	 * Process content inside a tool call, looking for parameters and the closing tag.
	 */
	private processInsideToolCall(): { events: XmlToolCallEvent[]; completed: boolean } {
		const events: XmlToolCallEvent[] = []

		if (!this.currentToolCall) {
			return { events, completed: true }
		}

		// Look for the closing </function> tag
		const closingMatch = this.buffer.match(/<\/function>/)

		if (closingMatch) {
			const closingIndex = closingMatch.index!

			// Extract content before closing tag
			const content = this.buffer.substring(0, closingIndex)

			// Parse parameters from content
			this.parseParameters(content)

			// Build the arguments JSON
			const argsJson = JSON.stringify(this.currentToolCall.parameters)

			// Emit delta with the arguments
			events.push({
				type: "tool_call_delta",
				id: this.currentToolCall.id,
				delta: argsJson,
			})

			// Emit end event
			events.push({
				type: "tool_call_end",
				id: this.currentToolCall.id,
			})

			// Remove processed content from buffer (including closing tag)
			this.buffer = this.buffer.substring(closingIndex + "</function>".length)

			return { events, completed: true }
		}

		// Check if we have a partial closing tag at the end
		if (
			this.buffer.endsWith("<") ||
			this.buffer.endsWith("</") ||
			this.buffer.endsWith("</f") ||
			this.buffer.endsWith("</fu") ||
			this.buffer.endsWith("</fun") ||
			this.buffer.endsWith("</func") ||
			this.buffer.endsWith("</funct") ||
			this.buffer.endsWith("</functi") ||
			this.buffer.endsWith("</functio") ||
			this.buffer.endsWith("</function") ||
			this.buffer.endsWith("</function>")
		) {
			// Wait for more data
			return { events, completed: false }
		}

		// No closing tag found, keep waiting
		return { events, completed: false }
	}

	/**
	 * Parse parameter tags from content.
	 * Format: <parameter=name>value</parameter>
	 */
	private parseParameters(content: string): void {
		if (!this.currentToolCall) {
			return
		}

		// Match all parameter tags
		const paramRegex = /<parameter=(\w+)>([\s\S]*?)<\/parameter>/g
		let match

		while ((match = paramRegex.exec(content)) !== null) {
			const paramName = match[1]
			const paramValue = match[2].trim()
			this.currentToolCall.parameters[paramName] = paramValue
		}
	}

	/**
	 * Finalize parsing and return any remaining content.
	 * Call this at the end of a stream to handle any incomplete tool calls.
	 */
	public finalize(): XmlToolCallParseResult {
		const events: XmlToolCallEvent[] = []

		// If we have an incomplete tool call, try to complete it or emit as text
		if (this.currentToolCall) {
			// Check if we have a closing tag in the buffer
			if (this.buffer.includes("</function>")) {
				const result = this.processInsideToolCall()
				events.push(...result.events)
			} else {
				// Incomplete tool call - emit end event with what we have
				const argsJson = JSON.stringify(this.currentToolCall.parameters)
				events.push({
					type: "tool_call_delta",
					id: this.currentToolCall.id,
					delta: argsJson,
				})
				events.push({
					type: "tool_call_end",
					id: this.currentToolCall.id,
				})
			}
			this.currentToolCall = null
		}

		// Return any remaining buffer as text
		const textContent = this.buffer
		this.buffer = ""
		this.potentialToolCallStart = false

		return {
			textContent,
			events,
			isPartialToolCall: false,
		}
	}

	/**
	 * Reset parser state.
	 */
	public reset(): void {
		this.buffer = ""
		this.currentToolCall = null
		this.potentialToolCallStart = false
	}

	/**
	 * Check if parser has pending content.
	 */
	public hasPendingContent(): boolean {
		return this.buffer.length > 0 || this.currentToolCall !== null
	}

	/**
	 * Static utility method to parse a complete text block for XML tool calls.
	 * Use this for non-streaming scenarios.
	 *
	 * @param text - Complete text to parse
	 * @returns Parse result with text content and tool call events
	 */
	public static parseComplete(text: string): XmlToolCallParseResult {
		const parser = new XmlToolCallParser()
		const chunkResult = parser.processChunk(text)
		const finalResult = parser.finalize()

		return {
			textContent: chunkResult.textContent + finalResult.textContent,
			events: [...chunkResult.events, ...finalResult.events],
			isPartialToolCall: false,
		}
	}
}
