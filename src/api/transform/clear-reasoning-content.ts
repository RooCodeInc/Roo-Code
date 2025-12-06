import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Clears `reasoning_content` from assistant messages in a conversation history.
 *
 * According to API documentation for interleaved thinking, `reasoning_content` from previous turns
 * should NOT be concatenated into the context for new turns - only the final `content`
 * (answer) should be preserved in conversation history.
 *
 * This function provides defense-in-depth clearing of reasoning_content before
 * sending messages to the API for new conversation turns.
 *
 * **When to use:**
 * - Before sending messages to API when starting a NEW turn (new user message)
 * - NOT during tool call sequences within the same turn (reasoning_content should be preserved)
 *
 * @param messages Array of Anthropic messages (may contain reasoning_content)
 * @returns Array of messages with reasoning_content removed from assistant messages
 *
 * @example
 * ```typescript
 * const cleanedMessages = clearReasoningContentFromMessages(conversationHistory)
 * const convertedMessages = convertToR1Format(cleanedMessages)
 * ```
 */
export function clearReasoningContentFromMessages(
	messages: Anthropic.Messages.MessageParam[],
): Anthropic.Messages.MessageParam[] {
	return messages.map((message) => {
		// Only process assistant messages
		if (message.role !== "assistant") {
			return message
		}

		// Check if message has reasoning_content (might exist as an extra property)
		const messageWithReasoning = message as any
		if (!("reasoning_content" in messageWithReasoning)) {
			// No reasoning_content, return as-is
			return message
		}

		// Remove reasoning_content while preserving all other properties
		const { reasoning_content, ...rest } = messageWithReasoning

		// Return cleaned message (preserves content, tool_calls, etc.)
		return rest as Anthropic.Messages.MessageParam
	})
}
