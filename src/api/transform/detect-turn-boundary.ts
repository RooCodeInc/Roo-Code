import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Detects if a new user turn is starting based on message sequence analysis.
 *
 * According to API documentation for interleaved thinking:
 * - Within a turn (tool call sequences): reasoning_content MUST be preserved
 * - Between turns (new user question): reasoning_content from previous turns should be cleared
 *
 * Turn detection heuristics:
 * - Last message is user message:
 *   - If user has tool_result blocks → still in tool call sequence (return false, preserve reasoning_content)
 *   - If user has no tool_result blocks → new turn (return true, clear reasoning_content)
 * - Last message is assistant with tool_use blocks → continuation (return false, preserve reasoning_content)
 * - Last message is assistant without tool_use blocks → check previous message:
 *   - If previous is user with tool_result blocks → model stopped sending tool calls (return true, clear reasoning_content)
 *   - If previous is user without tool_result blocks → new turn (return true, clear reasoning_content)
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
 * // Model stopped sending tool calls: last message is assistant without tool_use, previous is user with tool results
 * isNewUserTurn([
 *   { role: "assistant", content: [{ type: "tool_use", ... }] },
 *   { role: "user", content: [{ type: "tool_result", ... }] },
 *   { role: "assistant", content: "Answer" }
 * ]) // returns true (clear reasoning_content - model stopped sending tool calls)
 * ```
 */
export function isNewUserTurn(messages: Anthropic.Messages.MessageParam[]): boolean {
	// Edge case: empty messages array → treat as new turn
	if (messages.length === 0) {
		return true
	}

	const lastMessage = messages[messages.length - 1]

	// Case 1: Last message is user message
	if (lastMessage.role === "user") {
		// Check if user message has tool_result blocks
		const hasToolResults =
			Array.isArray(lastMessage.content) &&
			lastMessage.content.some((part): part is Anthropic.ToolResultBlockParam => part.type === "tool_result")

		// If user message has tool_result blocks → still in tool call sequence (preserve reasoning_content)
		if (hasToolResults) {
			return false
		}

		// If user message has no tool_result blocks → new turn (clear reasoning_content)
		return true
	}

	// Case 2: Last message is assistant
	if (lastMessage.role === "assistant") {
		// Check if assistant message has tool_use blocks
		const hasToolUse =
			Array.isArray(lastMessage.content) &&
			lastMessage.content.some((part): part is Anthropic.ToolUseBlockParam => part.type === "tool_use")

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
					(part): part is Anthropic.ToolResultBlockParam => part.type === "tool_result",
				)

			// If previous user message has tool_result blocks AND assistant has no tool_use blocks
			// → Model has stopped sending tool calls, clear reasoning_content (return true)
			// If assistant still has tool_use blocks, we would have returned false earlier
			// So at this point, assistant has no tool_use blocks, meaning tool call sequence has ended
			if (hasToolResults) {
				// Model stopped sending tool calls → clear reasoning_content
				return true
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
