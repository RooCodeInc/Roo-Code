import { Anthropic } from "@anthropic-ai/sdk"

type ContentBlock = Anthropic.Messages.ContentBlockParam

/**
 * Result from extracting environment_details from Anthropic messages for MiniMax.
 */
export interface ExtractEnvironmentDetailsResult {
	/**
	 * The modified messages with text content after tool_results removed
	 */
	messages: Anthropic.Messages.MessageParam[]
	/**
	 * Text content extracted from user messages that followed tool_result blocks
	 * (like environment_details). This should be appended to the system prompt.
	 */
	extractedSystemContent: string[]
}

/**
 * Extracts text content that follows tool_result blocks in user messages and returns
 * it separately so it can be appended to the system prompt.
 *
 * This is specifically for MiniMax's thinking models where having user messages
 * with environment_details after tool results can disrupt reasoning continuity.
 * By moving this content to the system prompt, we preserve reasoning_content.
 *
 * Key behavior:
 * - User messages with ONLY tool_result blocks: keep as-is
 * - User messages with ONLY text/image: keep as-is
 * - User messages with tool_result blocks AND text blocks: extract the text blocks
 *   and return them separately to be appended to system prompt
 *
 * @param messages Array of Anthropic messages
 * @returns Object containing modified messages and extracted text for system prompt
 */
export function extractEnvironmentDetailsForMiniMax(
	messages: Anthropic.Messages.MessageParam[],
): ExtractEnvironmentDetailsResult {
	const result: Anthropic.Messages.MessageParam[] = []
	const extractedSystemContent: string[] = []

	for (const message of messages) {
		if (message.role === "user") {
			if (typeof message.content === "string") {
				// Simple string content - keep as-is
				result.push(message)
			} else if (Array.isArray(message.content)) {
				// Check if this message has both tool_result blocks and text blocks
				const toolResultBlocks: ContentBlock[] = []
				const textBlocks: Anthropic.Messages.TextBlockParam[] = []
				const imageBlocks: Anthropic.Messages.ImageBlockParam[] = []

				for (const block of message.content) {
					if (block.type === "tool_result") {
						toolResultBlocks.push(block)
					} else if (block.type === "text") {
						textBlocks.push(block)
					} else if (block.type === "image") {
						imageBlocks.push(block)
					}
				}

				// If we have tool_result blocks AND text blocks (like environment_details),
				// extract the text to be added to system prompt
				const hasToolResults = toolResultBlocks.length > 0
				const hasTextBlocks = textBlocks.length > 0
				const hasImageBlocks = imageBlocks.length > 0

				if (hasToolResults && hasTextBlocks && !hasImageBlocks) {
					// Extract text content to system prompt
					for (const textBlock of textBlocks) {
						extractedSystemContent.push(textBlock.text)
					}

					// Keep only the tool_result blocks in the user message
					if (toolResultBlocks.length > 0) {
						result.push({
							...message,
							content: toolResultBlocks as Anthropic.Messages.ContentBlockParam[],
						})
					}
				} else {
					// Keep the message as-is if:
					// - Only tool_result blocks (no text to extract)
					// - Only text/image blocks (no tool results, so not environment_details after tool use)
					// - Has images (can't move to system prompt)
					result.push(message)
				}
			} else {
				// Unknown format - keep as-is
				result.push(message)
			}
		} else {
			// Assistant messages - keep as-is
			result.push(message)
		}
	}

	return { messages: result, extractedSystemContent }
}
