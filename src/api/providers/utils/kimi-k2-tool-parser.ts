/**
 * Parser for Kimi K2 Thinking model's native tool call format.
 * Kimi K2 uses special tokens in the content stream rather than the standard OpenAI tool_calls field.
 *
 * Token format:
 * <|tool_calls_section_begin|>
 * <|tool_call_begin|>
 * functions.tool_name:call_id
 * <|tool_call_argument_begin|>
 * {"arg": "value"}
 * <|tool_call_end|>
 * <|tool_calls_section_end|>
 */
export class KimiK2ToolCallParser {
	private contentBuffer = ""
	private isInToolCallSection = false
	private isInToolCall = false
	private isInArguments = false
	private currentToolCall: {
		id: string
		name: string
		arguments: string
	} | null = null
	private pendingToolCalls: Array<{
		id: string
		name: string
		arguments: string
	}> = []

	// Special tokens used by Kimi K2
	private readonly TOOL_CALLS_BEGIN = "<|tool_calls_section_begin|>"
	private readonly TOOL_CALLS_END = "<|tool_calls_section_end|>"
	private readonly TOOL_CALL_BEGIN = "<|tool_call_begin|>"
	private readonly TOOL_CALL_END = "<|tool_call_end|>"
	private readonly TOOL_ARG_BEGIN = "<|tool_call_argument_begin|>"

	/**
	 * Process incoming content chunk and extract tool calls
	 * @param chunk - The content chunk to process
	 * @returns Object containing remaining content and extracted tool calls
	 */
	processChunk(chunk: string): {
		content: string
		toolCalls: Array<{ id: string; name: string; arguments: string }>
		isBuffering: boolean
	} {
		this.contentBuffer += chunk
		const extractedToolCalls: Array<{ id: string; name: string; arguments: string }> = []
		let processedContent = ""

		// Process the buffer
		let i = 0
		while (i < this.contentBuffer.length) {
			let tokenFound = false

			// Check if we might be at the start of a special token
			// We need to check if we have enough characters for the smallest token
			const remainingChars = this.contentBuffer.length - i

			// Check for special tokens only if we have enough characters
			if (
				!this.isInToolCallSection &&
				remainingChars >= this.TOOL_CALLS_BEGIN.length &&
				this.contentBuffer.substring(i).startsWith(this.TOOL_CALLS_BEGIN)
			) {
				// Start of tool calls section
				this.isInToolCallSection = true
				i += this.TOOL_CALLS_BEGIN.length
				tokenFound = true
			} else if (
				!this.isInToolCallSection &&
				remainingChars < this.TOOL_CALLS_BEGIN.length &&
				this.TOOL_CALLS_BEGIN.startsWith(this.contentBuffer.substring(i))
			) {
				// Might be the start of TOOL_CALLS_BEGIN but we don't have enough characters yet
				break // Buffer the rest for next chunk
			} else if (
				this.isInToolCallSection &&
				remainingChars >= this.TOOL_CALLS_END.length &&
				this.contentBuffer.substring(i).startsWith(this.TOOL_CALLS_END)
			) {
				// End of tool calls section
				this.isInToolCallSection = false
				// Flush any pending tool calls
				if (this.pendingToolCalls.length > 0) {
					extractedToolCalls.push(...this.pendingToolCalls)
					this.pendingToolCalls = []
				}
				i += this.TOOL_CALLS_END.length
				tokenFound = true
			} else if (
				this.isInToolCallSection &&
				remainingChars < this.TOOL_CALLS_END.length &&
				this.TOOL_CALLS_END.startsWith(this.contentBuffer.substring(i))
			) {
				// Might be the start of TOOL_CALLS_END but we don't have enough characters yet
				break // Buffer the rest for next chunk
			} else if (
				this.isInToolCallSection &&
				!this.isInToolCall &&
				remainingChars >= this.TOOL_CALL_BEGIN.length &&
				this.contentBuffer.substring(i).startsWith(this.TOOL_CALL_BEGIN)
			) {
				// Start of individual tool call
				this.isInToolCall = true
				this.currentToolCall = { id: "", name: "", arguments: "" }
				i += this.TOOL_CALL_BEGIN.length
				tokenFound = true
			} else if (
				this.isInToolCallSection &&
				!this.isInToolCall &&
				remainingChars < this.TOOL_CALL_BEGIN.length &&
				this.TOOL_CALL_BEGIN.startsWith(this.contentBuffer.substring(i))
			) {
				// Might be the start of TOOL_CALL_BEGIN but we don't have enough characters yet
				break // Buffer the rest for next chunk
			} else if (
				this.isInToolCall &&
				remainingChars >= this.TOOL_CALL_END.length &&
				this.contentBuffer.substring(i).startsWith(this.TOOL_CALL_END)
			) {
				// End of individual tool call
				this.isInToolCall = false
				this.isInArguments = false
				if (this.currentToolCall) {
					this.pendingToolCalls.push(this.currentToolCall)
					this.currentToolCall = null
				}
				i += this.TOOL_CALL_END.length
				tokenFound = true
			} else if (
				this.isInToolCall &&
				remainingChars < this.TOOL_CALL_END.length &&
				this.TOOL_CALL_END.startsWith(this.contentBuffer.substring(i))
			) {
				// Might be the start of TOOL_CALL_END but we don't have enough characters yet
				break // Buffer the rest for next chunk
			} else if (
				this.isInToolCall &&
				!this.isInArguments &&
				remainingChars >= this.TOOL_ARG_BEGIN.length &&
				this.contentBuffer.substring(i).startsWith(this.TOOL_ARG_BEGIN)
			) {
				// Start of arguments section
				this.isInArguments = true
				i += this.TOOL_ARG_BEGIN.length
				tokenFound = true
			} else if (
				this.isInToolCall &&
				!this.isInArguments &&
				remainingChars < this.TOOL_ARG_BEGIN.length &&
				this.TOOL_ARG_BEGIN.startsWith(this.contentBuffer.substring(i))
			) {
				// Might be the start of TOOL_ARG_BEGIN but we don't have enough characters yet
				break // Buffer the rest for next chunk
			}

			if (!tokenFound) {
				// Process content based on current state
				if (this.isInToolCall && this.currentToolCall) {
					if (!this.isInArguments) {
						// Parsing tool name and ID (format: functions.tool_name:call_id)
						const char = this.contentBuffer[i]
						if (char === "\n" || char === "\r") {
							// Skip newlines
							i++
							continue
						}

						// Buffer the tool name/id string
						const toolInfo = this.currentToolCall.name + char
						this.currentToolCall.name = toolInfo

						// Check if we've reached the end of tool name/id
						if (toolInfo.includes(":")) {
							// Parse the format: functions.tool_name:call_id
							const parts = toolInfo.match(/^functions\.([^:]+):(.+)$/)
							if (parts) {
								this.currentToolCall.name = parts[1]
								this.currentToolCall.id = `tool_${parts[2]}`
							}
						}
					} else {
						// Parsing arguments JSON
						this.currentToolCall.arguments += this.contentBuffer[i]
					}
				} else if (!this.isInToolCallSection) {
					// Check if this might be the start of a tool token when not in a section
					const possibleTokenStarts = [this.TOOL_CALLS_BEGIN]
					let mightBeToken = false

					for (const token of possibleTokenStarts) {
						if (token.startsWith(this.contentBuffer.substring(i))) {
							// This might be the start of a token
							mightBeToken = true
							break
						}
					}

					if (mightBeToken && remainingChars < this.TOOL_CALLS_BEGIN.length) {
						// Buffer this for next chunk
						break
					} else {
						// Regular content outside tool calls
						processedContent += this.contentBuffer[i]
					}
				}

				i++
			}
		}

		// Update the buffer to only contain unprocessed content
		this.contentBuffer = this.contentBuffer.substring(i)

		// If we're still in a tool call section, we need to buffer more content
		const isBuffering = this.isInToolCallSection || this.isInToolCall

		return {
			content: processedContent,
			toolCalls: extractedToolCalls,
			isBuffering,
		}
	}

	/**
	 * Force flush any buffered content and pending tool calls
	 * Used when the stream ends
	 */
	flush(): {
		content: string
		toolCalls: Array<{ id: string; name: string; arguments: string }>
	} {
		const toolCalls = [...this.pendingToolCalls]

		// If we have a current tool call in progress, add it
		if (this.currentToolCall) {
			toolCalls.push(this.currentToolCall)
		}

		// Reset state
		this.contentBuffer = ""
		this.isInToolCallSection = false
		this.isInToolCall = false
		this.isInArguments = false
		this.currentToolCall = null
		this.pendingToolCalls = []

		return {
			content: "",
			toolCalls,
		}
	}

	/**
	 * Check if the model is likely Kimi K2 based on model ID
	 */
	static isKimiK2Model(modelId: string): boolean {
		const lowerModelId = modelId.toLowerCase()
		return lowerModelId.includes("kimi") && (lowerModelId.includes("k2") || lowerModelId.includes("thinking"))
	}
}
