import { Anthropic } from "@anthropic-ai/sdk"
import { TelemetryService } from "@roo-code/telemetry"
import { findLastIndex } from "../../shared/array"

/**
 * Custom error class for tool result ID mismatches.
 * Used for structured error tracking via PostHog.
 */
export class ToolResultIdMismatchError extends Error {
	constructor(
		message: string,
		public readonly toolResultIds: string[],
		public readonly toolUseIds: string[],
	) {
		super(message)
		this.name = "ToolResultIdMismatchError"
	}
}

/**
 * Validates and fixes tool_result IDs in a user message against the previous assistant message.
 *
 * This is a centralized validation that catches all tool_use/tool_result ID mismatches
 * before messages are added to the API conversation history. It handles scenarios like:
 * - Race conditions during streaming
 * - Message editing scenarios
 * - Resume/delegation scenarios
 *
 * @param userMessage - The user message being added to history
 * @param apiConversationHistory - The conversation history to find the previous assistant message from
 * @returns The validated user message with corrected tool_use_ids
 */
export function validateAndFixToolResultIds(
	userMessage: Anthropic.MessageParam,
	apiConversationHistory: Anthropic.MessageParam[],
): Anthropic.MessageParam {
	// Only process user messages with array content
	if (userMessage.role !== "user" || !Array.isArray(userMessage.content)) {
		return userMessage
	}

	// Find tool_result blocks in the user message
	const toolResults = userMessage.content.filter(
		(block): block is Anthropic.ToolResultBlockParam => block.type === "tool_result",
	)

	// No tool results to validate
	if (toolResults.length === 0) {
		return userMessage
	}

	// Find the previous assistant message from conversation history
	const prevAssistantIdx = findLastIndex(apiConversationHistory, (msg) => msg.role === "assistant")
	if (prevAssistantIdx === -1) {
		return userMessage
	}

	const previousAssistantMessage = apiConversationHistory[prevAssistantIdx]

	// Get tool_use blocks from the assistant message
	const assistantContent = previousAssistantMessage.content
	if (!Array.isArray(assistantContent)) {
		return userMessage
	}

	const toolUseBlocks = assistantContent.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")

	// No tool_use blocks to match against
	if (toolUseBlocks.length === 0) {
		return userMessage
	}

	// Build a set of valid tool_use IDs
	const validToolUseIds = new Set(toolUseBlocks.map((block) => block.id))

	// Check if any tool_result has an invalid ID
	const hasInvalidIds = toolResults.some((result) => !validToolUseIds.has(result.tool_use_id))

	if (!hasInvalidIds) {
		// All IDs are valid, no changes needed
		return userMessage
	}

	// We have mismatches - need to fix them
	const toolResultIdList = toolResults.map((r) => r.tool_use_id)
	const toolUseIdList = toolUseBlocks.map((b) => b.id)

	// Report the mismatch to PostHog error tracking
	if (TelemetryService.hasInstance()) {
		TelemetryService.instance.captureException(
			new ToolResultIdMismatchError(
				`Detected tool_result ID mismatch. tool_result IDs: [${toolResultIdList.join(", ")}], tool_use IDs: [${toolUseIdList.join(", ")}]`,
				toolResultIdList,
				toolUseIdList,
			),
			{
				toolResultIds: toolResultIdList,
				toolUseIds: toolUseIdList,
				toolResultCount: toolResults.length,
				toolUseCount: toolUseBlocks.length,
			},
		)
	}

	// Create a mapping of tool_result IDs to corrected IDs
	// Strategy: Match by position (first tool_result -> first tool_use, etc.)
	// This handles most cases where the mismatch is due to ID confusion
	const correctedContent = userMessage.content.map((block) => {
		if (block.type !== "tool_result") {
			return block
		}

		// If the ID is already valid, keep it
		if (validToolUseIds.has(block.tool_use_id)) {
			return block
		}

		// Find which tool_result index this block is by comparing references.
		// This correctly handles duplicate tool_use_ids - we find the actual block's
		// position among all tool_results, not the first block with a matching ID.
		const toolResultIndex = toolResults.indexOf(block as Anthropic.ToolResultBlockParam)

		// Try to match by position - only fix if there's a corresponding tool_use
		if (toolResultIndex !== -1 && toolResultIndex < toolUseBlocks.length) {
			const correctId = toolUseBlocks[toolResultIndex].id
			return {
				...block,
				tool_use_id: correctId,
			}
		}

		// No corresponding tool_use for this tool_result - leave it unchanged
		// This can happen when there are more tool_results than tool_uses
		return block
	})

	return {
		...userMessage,
		content: correctedContent,
	}
}
