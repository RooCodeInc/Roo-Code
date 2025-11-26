import { Anthropic } from "@anthropic-ai/sdk"

/**
 * List of content block types that are NOT valid for Anthropic API.
 * These are internal Roo Code types or types from other providers (e.g., Gemini's thoughtSignature).
 * Valid Anthropic types are: text, image, tool_use, tool_result, thinking, redacted_thinking, document
 */
export const INVALID_ANTHROPIC_BLOCK_TYPES = new Set([
	"reasoning", // Internal Roo Code reasoning format
	"thoughtSignature", // Gemini's encrypted reasoning signature
])

/**
 * Filters out non-Anthropic content blocks from messages before sending to Anthropic/Vertex API.
 * This handles:
 * - Internal "reasoning" blocks (Roo Code's internal representation)
 * - Gemini's "thoughtSignature" blocks (encrypted reasoning continuity tokens)
 *
 * Anthropic API only accepts: text, image, tool_use, tool_result, thinking, redacted_thinking, document
 */
export function filterNonAnthropicBlocks(
	messages: Anthropic.Messages.MessageParam[],
): Anthropic.Messages.MessageParam[] {
	return messages
		.map((message) => {
			if (typeof message.content === "string") {
				return message
			}

			const filteredContent = message.content.filter((block) => {
				const blockType = (block as { type: string }).type
				// Filter out any block types that Anthropic doesn't recognize
				return !INVALID_ANTHROPIC_BLOCK_TYPES.has(blockType)
			})

			// If all content was filtered out, return undefined to filter the message later
			if (filteredContent.length === 0) {
				return undefined
			}

			return {
				...message,
				content: filteredContent,
			}
		})
		.filter((message): message is Anthropic.Messages.MessageParam => message !== undefined)
}
