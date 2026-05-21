import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Type for content block params that can appear in messages.
 * Using the broader ContentBlockParam type to handle all possible block types.
 */
export type UserContentBlock = Anthropic.Messages.ContentBlockParam

/**
 * Appends environment details to the last text block or tool_result block in user content.
 * This avoids creating a standalone trailing text block, which can break interleaved-thinking
 * models like DeepSeek reasoner that expect specific message shapes.
 *
 * Priority:
 * 1. If the last block is a text block, append to it
 * 2. If the last block is a tool_result, append to its content
 * 3. If no suitable block found, add as a new text block (fallback)
 *
 * @param content - Array of content blocks from a user message
 * @param environmentDetails - The environment details string to append
 * @returns New array with environment details appended to the appropriate block
 */
export function appendEnvironmentDetails(content: UserContentBlock[], environmentDetails: string): UserContentBlock[] {
	if (content.length === 0) {
		// No existing content, just return the environment details as a text block
		return [{ type: "text" as const, text: environmentDetails }]
	}

	// Create a shallow copy so we don't mutate the original array
	const result = [...content]

	// Find the last suitable block (text or tool_result)
	let lastSuitableIndex = -1
	for (let i = result.length - 1; i >= 0; i--) {
		const block = result[i]
		if (block.type === "text" || block.type === "tool_result") {
			lastSuitableIndex = i
			break
		}
	}

	if (lastSuitableIndex === -1) {
		// No text or tool_result block found (content only has images?), add new text block
		result.push({ type: "text" as const, text: environmentDetails })
		return result
	}

	const lastBlock = result[lastSuitableIndex]

	if (lastBlock.type === "text") {
		// Append to existing text block
		result[lastSuitableIndex] = {
			type: "text" as const,
			text: lastBlock.text + "\n\n" + environmentDetails,
		}
	} else if (lastBlock.type === "tool_result") {
		// Append to tool_result content
		result[lastSuitableIndex] = appendToToolResult(lastBlock, environmentDetails)
	}

	return result
}

/**
 * Appends text to a tool_result block's content.
 * Tool result content can be a string or an array of content blocks.
 */
function appendToToolResult(
	toolResult: Anthropic.Messages.ToolResultBlockParam,
	textToAppend: string,
): Anthropic.Messages.ToolResultBlockParam {
	const { content, ...rest } = toolResult

	if (content === undefined || content === null) {
		// No existing content, just set the text
		return {
			...rest,
			content: textToAppend,
		}
	}

	if (typeof content === "string") {
		// String content, just concatenate
		return {
			...rest,
			content: content + "\n\n" + textToAppend,
		}
	}

	if (Array.isArray(content)) {
		// Array content - find the last text block and append, or add new text block
		const contentCopy = [...content]
		let lastTextIndex = -1

		for (let i = contentCopy.length - 1; i >= 0; i--) {
			if (contentCopy[i].type === "text") {
				lastTextIndex = i
				break
			}
		}

		if (lastTextIndex >= 0) {
			// Append to last text block in array
			const lastTextBlock = contentCopy[lastTextIndex] as Anthropic.Messages.TextBlockParam
			contentCopy[lastTextIndex] = {
				type: "text" as const,
				text: lastTextBlock.text + "\n\n" + textToAppend,
			}
		} else {
			// No text block in array, add new one
			contentCopy.push({ type: "text" as const, text: textToAppend })
		}

		return {
			...rest,
			content: contentCopy,
		}
	}

	// Unknown content type, return with text appended as new content
	return {
		...rest,
		content: textToAppend,
	}
}

/**
 * Removes any existing environment_details blocks from the content array.
 * A block is considered an environment_details block if it's a text block
 * that starts with <environment_details> and ends with </environment_details>.
 *
 * @param content - Array of content blocks to filter
 * @returns New array with environment_details blocks removed
 */
export function removeEnvironmentDetailsBlocks(content: UserContentBlock[]): UserContentBlock[] {
	return content.filter((block) => {
		if (block.type === "text" && typeof block.text === "string") {
			const trimmed = block.text.trim()
			const isEnvironmentDetailsBlock =
				trimmed.startsWith("<environment_details>") && trimmed.endsWith("</environment_details>")
			return !isEnvironmentDetailsBlock
		}
		return true
	})
}

/**
 * Strips environment details from the last text block or tool_result in the content.
 * This handles the case where environment details were appended to an existing block
 * rather than added as a standalone block.
 *
 * @param content - Array of content blocks
 * @returns New array with environment details stripped from the last suitable block
 */
export function stripAppendedEnvironmentDetails(content: UserContentBlock[]): UserContentBlock[] {
	if (content.length === 0) {
		return content
	}

	// First, remove any standalone environment_details blocks
	let result = removeEnvironmentDetailsBlocks(content)

	if (result.length === 0) {
		return result
	}

	// Then, strip appended environment details from the last block
	const lastIndex = result.length - 1
	const lastBlock = result[lastIndex]

	if (lastBlock.type === "text") {
		const strippedText = stripEnvDetailsFromText(lastBlock.text)
		if (strippedText !== lastBlock.text) {
			result = [...result]
			result[lastIndex] = { type: "text" as const, text: strippedText }
		}
	} else if (lastBlock.type === "tool_result") {
		const strippedToolResult = stripEnvDetailsFromToolResult(lastBlock)
		if (strippedToolResult !== lastBlock) {
			result = [...result]
			result[lastIndex] = strippedToolResult
		}
	}

	return result
}

/**
 * Strips environment details from the end of a text string.
 */
function stripEnvDetailsFromText(text: string): string {
	// Match environment details at the end of the string, with optional preceding newlines
	const envDetailsPattern = /\n*<environment_details>[\s\S]*<\/environment_details>\s*$/
	return text.replace(envDetailsPattern, "")
}

/**
 * Strips environment details from a tool_result block's content.
 */
function stripEnvDetailsFromToolResult(
	toolResult: Anthropic.Messages.ToolResultBlockParam,
): Anthropic.Messages.ToolResultBlockParam {
	const { content, ...rest } = toolResult

	if (content === undefined || content === null) {
		return toolResult
	}

	if (typeof content === "string") {
		const strippedContent = stripEnvDetailsFromText(content)
		if (strippedContent === content) {
			return toolResult
		}
		return { ...rest, content: strippedContent }
	}

	if (Array.isArray(content)) {
		let changed = false
		const newContent = content.map((block) => {
			if (block.type === "text") {
				const strippedText = stripEnvDetailsFromText(block.text)
				if (strippedText !== block.text) {
					changed = true
					return { type: "text" as const, text: strippedText }
				}
			}
			return block
		})

		if (!changed) {
			return toolResult
		}

		return { ...rest, content: newContent }
	}

	return toolResult
}
