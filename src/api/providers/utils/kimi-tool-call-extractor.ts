/**
 * Extracts tool calls from Kimi K2 Thinking model's reasoning_content field.
 *
 * Kimi K2 Thinking model embeds tool calls in reasoning_content using special tags:
 * - <|tool_calls_section_begin|> ... <|tool_calls_section_end|> wraps all tool calls
 * - <|tool_call_begin|> ... <|tool_call_end|> wraps each individual tool call
 * - <|tool_call_argument_begin|> marks the start of arguments JSON
 *
 * Note: The model may output these markers with or without the <| |> delimiters,
 * so patterns are designed to handle both formats.
 *
 * Format example:
 * <|tool_calls_section_begin|>
 * <|tool_call_begin|>functions.read_file:0<|tool_call_argument_begin|>{"files":[{"path":"test.txt"}]}<|tool_call_end|>
 * <|tool_calls_section_end|>
 *
 * @see https://huggingface.co/moonshotai/Kimi-K2-Thinking/blob/main/docs/tool_call_guidance.md
 */

/**
 * Represents an extracted tool call from Kimi K2 Thinking model's reasoning_content.
 */
export interface KimiToolCall {
	id: string
	type: "function"
	function: {
		name: string
		arguments: string
	}
}

/**
 * Result of extracting tool calls and cleaning reasoning content.
 */
export interface KimiToolCallExtractionResult {
	toolCalls: KimiToolCall[]
	cleanedReasoningContent: string
}

/**
 * Checks if the content contains Kimi K2 Thinking model's embedded tool call markers.
 * Note: The model may output markers with or without <| |> delimiters, so we check
 * for the core marker text only.
 */
export function hasKimiEmbeddedToolCalls(content: string): boolean {
	return content.includes("tool_calls_section_begin")
}

/**
 * Extracts tool calls from Kimi K2 Thinking model's reasoning_content.
 *
 * @param content - The reasoning_content or combined content to extract tool calls from
 * @returns An object containing the extracted tool calls and the cleaned reasoning content
 */
export function extractKimiToolCalls(content: string): KimiToolCallExtractionResult {
	if (!hasKimiEmbeddedToolCalls(content)) {
		return {
			toolCalls: [],
			cleanedReasoningContent: content,
		}
	}

	const toolCalls: KimiToolCall[] = []

	// Pattern to match tool call sections
	// Note: Handles both <|marker|> and marker formats (delimiters are optional)
	const sectionPattern = /(?:<\|)?tool_calls_section_begin(?:\|>)?(.*?)(?:<\|)?tool_calls_section_end(?:\|>)?/gs
	const toolCallSections = content.match(sectionPattern)

	if (!toolCallSections || toolCallSections.length === 0) {
		return {
			toolCalls: [],
			cleanedReasoningContent: content,
		}
	}

	// Pattern to extract individual tool calls
	// Format: <|tool_call_begin|>functions.tool_name:index<|tool_call_argument_begin|>JSON_ARGS<|tool_call_end|>
	// Note: Handles both <|marker|> and marker formats (delimiters are optional)
	const funcCallPattern =
		/(?:<\|)?tool_call_begin(?:\|>)?\s*([\w.]+:\d+)\s*(?:<\|)?tool_call_argument_begin(?:\|>)?\s*(.*?)\s*(?:<\|)?tool_call_end(?:\|>)?/gs

	for (const section of toolCallSections) {
		let match
		// Reset lastIndex for each section to ensure all matches are found
		funcCallPattern.lastIndex = 0

		while ((match = funcCallPattern.exec(section)) !== null) {
			const [, functionId, functionArgs] = match

			// functionId format: functions.tool_name:index (e.g., "functions.read_file:0")
			// We need to extract just the tool name
			let functionName = functionId

			// Handle "functions.tool_name:index" format
			if (functionId.includes(".")) {
				const parts = functionId.split(".")
				// Get the part after the last dot, then remove the :index suffix
				const nameWithIndex = parts[parts.length - 1]
				functionName = nameWithIndex.split(":")[0]
			} else if (functionId.includes(":")) {
				// Handle "tool_name:index" format (without functions. prefix)
				functionName = functionId.split(":")[0]
			}

			toolCalls.push({
				id: `kimi-${functionId}`,
				type: "function",
				function: {
					name: functionName,
					arguments: functionArgs.trim(),
				},
			})
		}
	}

	// Clean the reasoning content by removing tool call sections
	const cleanedReasoningContent = content.replace(sectionPattern, "").trim()

	return {
		toolCalls,
		cleanedReasoningContent,
	}
}

/**
 * Checks if a model ID corresponds to a Kimi K2 Thinking model that uses embedded tool calls.
 * This includes various forms of the model name that users might use.
 */
export function isKimiThinkingModel(modelId: string): boolean {
	const normalizedModelId = modelId.toLowerCase()

	// Match various forms of kimi-k2-thinking model name
	return (
		normalizedModelId.includes("kimi-k2-thinking") ||
		normalizedModelId.includes("kimi_k2_thinking") ||
		normalizedModelId.includes("kimik2thinking")
	)
}
