import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Detects if a new user turn is starting based on message sequence analysis.
 *
 * According to API documentation for interleaved thinking:
 * - Within a turn (tool call sequences): reasoning_content MUST be preserved
 * - Between turns (new user question): reasoning_content from previous turns should be cleared
 *
 * Turn detection heuristics:
 * - Last message is user message → new turn (return true)
 * - Last message is assistant with tool_use blocks → continuation (return false)
 * - Last message is assistant without tool_use blocks → check previous message:
 *   - If previous is user with tool_result blocks → continuation (return false)
 *   - If previous is user without tool_result blocks → new turn (return true)
 *
 * @param messages Array of Anthropic messages in conversation order
 * @returns true if starting a new user turn (should clear reasoning_content),
 *          false if continuing tool call sequence (should preserve reasoning_content)
 *
 * @example
 * ```typescript
 * // New turn: last message is user
 * isNewUserTurn([
 *   { role: "assistant", content: "Previous answer" },
 *   { role: "user", content: "New question" }
 * ]) // returns true
 *
 * // Continuation: last message is assistant with tool calls
 * isNewUserTurn([
 *   { role: "user", content: "Question" },
 *   { role: "assistant", content: [{ type: "tool_use", ... }] }
 * ]) // returns false
 *
 * // Continuation: last message is assistant, previous is user with tool results
 * isNewUserTurn([
 *   { role: "assistant", content: [{ type: "tool_use", ... }] },
 *   { role: "user", content: [{ type: "tool_result", ... }] },
 *   { role: "assistant", content: "Answer" }
 * ]) // returns false
 * ```
 */
export function isNewUserTurn(messages: Anthropic.Messages.MessageParam[]): boolean {
	// Edge case: empty messages array → treat as new turn
	if (messages.length === 0) {
		return true
	}

	const lastMessage = messages[messages.length - 1]

	// Case 1: Last message is user message → new turn
	if (lastMessage.role === "user") {
		return true
	}

	// Case 2: Last message is assistant
	if (lastMessage.role === "assistant") {
		// Check if assistant message has tool_use blocks
		const hasToolUse =
			Array.isArray(lastMessage.content) &&
			lastMessage.content.some(
				(part: Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam) =>
					part.type === "tool_use",
			)

		// If assistant has tool_use blocks → continuation (tool call sequence)
		if (hasToolUse) {
			return false
		}

		// If assistant has no tool_use blocks, check previous message
		if (messages.length === 1) {
			// Only one message (assistant) → treat as new turn
			// (This shouldn't happen in normal flow, but handle gracefully)
			return true
		}

		const previousMessage = messages[messages.length - 2]

		// If previous message is user, check if it has tool_result blocks
		if (previousMessage.role === "user") {
			const hasToolResults =
				Array.isArray(previousMessage.content) &&
				previousMessage.content.some(
					(part: Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolResultBlockParam) =>
						part.type === "tool_result",
				)

			// If previous user message has tool_result blocks → continuation
			// (This means we're in a tool call sequence)
			if (hasToolResults) {
				return false
			}

			// If previous user message has no tool_result blocks → new turn
			// (Assistant finished answering, user is asking new question)
			return true
		}

		// If previous message is assistant → continuation
		// (Multiple assistant messages in sequence, likely tool call continuation)
		return false
	}

	// Edge case: unknown role → treat as new turn (conservative approach)
	return true
}
