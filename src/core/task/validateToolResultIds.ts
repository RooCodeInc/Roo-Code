import { Anthropic } from "@anthropic-ai/sdk"
import { findLastIndex } from "../../shared/array"

/**
 * Custom error class for tool result ID mismatches.
 * Used for structured error tracking via external service.
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
 * Custom error class for missing tool results.
 * Used for structured error tracking via external service when tool_use blocks
 * don't have corresponding tool_result blocks.
 */
export class MissingToolResultError extends Error {
	constructor(
		message: string,
		public readonly missingToolUseIds: string[],
		public readonly existingToolResultIds: string[],
	) {
		super(message)
		this.name = "MissingToolResultError"
	}
}

/**
 * Validates and fixes tool_result IDs in a user message against the previous assistant message.
 *
 * This is a centralized validation that catches all tool_use/tool_result issues
 * before messages are added to the API conversation history. It handles scenarios like:
 * - Race conditions during streaming
 * - Message editing scenarios
 * - Resume/delegation scenarios
 * - Missing tool_result blocks for tool_use calls
 *
 * @param userMessage - The user message being added to history
 * @param apiConversationHistory - The conversation history to find the previous assistant message from
 * @returns The validated user message with corrected tool_use_ids and any missing tool_results added
 */
export function validateAndFixToolResultIds(
	userMessage: Anthropic.MessageParam,
	apiConversationHistory: Anthropic.MessageParam[],
): Anthropic.MessageParam {
	// Only process user messages with array content
	if (userMessage.role !== "user" || !Array.isArray(userMessage.content)) {
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

	// No tool_use blocks to match against - no validation needed
	if (toolUseBlocks.length === 0) {
		return userMessage
	}

	// Find tool_result blocks in the user message
	let toolResults = userMessage.content.filter(
		(block): block is Anthropic.ToolResultBlockParam => block.type === "tool_result",
	)

	// Deduplicate tool_result blocks to prevent API protocol violations (GitHub #10465)
	// This serves as a safety net for any potential race conditions that could generate
	// duplicate tool_results with the same tool_use_id. The root cause (approval feedback
	// creating duplicate results) has been fixed in presentAssistantMessage.ts, but this
	// deduplication remains as a defensive measure for unknown edge cases.
	const seenToolResultIds = new Set<string>()
	const deduplicatedContent = userMessage.content.filter((block) => {
		if (block.type !== "tool_result") {
			return true
		}
		if (seenToolResultIds.has(block.tool_use_id)) {
			return false // Duplicate - filter out
		}
		seenToolResultIds.add(block.tool_use_id)
		return true
	})

	userMessage = {
		...userMessage,
		content: deduplicatedContent,
	}

	toolResults = deduplicatedContent.filter(
		(block): block is Anthropic.ToolResultBlockParam => block.type === "tool_result",
	)

	// Build a set of valid tool_use IDs
	const validToolUseIds = new Set(toolUseBlocks.map((block) => block.id))

	// Build a set of existing tool_result IDs
	const existingToolResultIds = new Set(toolResults.map((r) => r.tool_use_id))

	// Check for missing tool_results (tool_use IDs that don't have corresponding tool_results)
	const missingToolUseIds = toolUseBlocks
		.filter((toolUse) => !existingToolResultIds.has(toolUse.id))
		.map((toolUse) => toolUse.id)

	// Check if any tool_result has an invalid ID
	const hasInvalidIds = toolResults.some((result) => !validToolUseIds.has(result.tool_use_id))

	// If no missing tool_results and no invalid IDs, no changes needed
	if (missingToolUseIds.length === 0 && !hasInvalidIds) {
		return userMessage
	}

	// We have issues - need to fix them
	const toolResultIdList = toolResults.map((r) => r.tool_use_id)
	const toolUseIdList = toolUseBlocks.map((b) => b.id)

	// Match tool_results to tool_uses by position and fix incorrect IDs
	const usedToolUseIds = new Set<string>()
	const contentArray = userMessage.content as Anthropic.Messages.ContentBlockParam[]

	const correctedContent = contentArray
		.map((block: Anthropic.Messages.ContentBlockParam) => {
			if (block.type !== "tool_result") {
				return block
			}

			// If the ID is already valid and not yet used, keep it
			if (validToolUseIds.has(block.tool_use_id) && !usedToolUseIds.has(block.tool_use_id)) {
				usedToolUseIds.add(block.tool_use_id)
				return block
			}

			// Find which tool_result index this block is by comparing references.
			// This correctly handles duplicate tool_use_ids - we find the actual block's
			// position among all tool_results, not the first block with a matching ID.
			const toolResultIndex = toolResults.indexOf(block as Anthropic.ToolResultBlockParam)

			// Try to match by position - only fix if there's a corresponding tool_use
			if (toolResultIndex !== -1 && toolResultIndex < toolUseBlocks.length) {
				const correctId = toolUseBlocks[toolResultIndex].id
				// Only use this ID if it hasn't been used yet
				if (!usedToolUseIds.has(correctId)) {
					usedToolUseIds.add(correctId)
					return {
						...block,
						tool_use_id: correctId,
					}
				}
			}

			// No corresponding tool_use for this tool_result, or the ID is already used
			return null
		})
		.filter((block): block is NonNullable<typeof block> => block !== null)

	// Add missing tool_result blocks for any tool_use that doesn't have one
	const coveredToolUseIds = new Set(
		correctedContent
			.filter(
				(b: Anthropic.Messages.ContentBlockParam): b is Anthropic.ToolResultBlockParam =>
					b.type === "tool_result",
			)
			.map((r: Anthropic.ToolResultBlockParam) => r.tool_use_id),
	)

	const stillMissingToolUseIds = toolUseBlocks.filter((toolUse) => !coveredToolUseIds.has(toolUse.id))

	// Build final content: add missing tool_results at the beginning if any
	const missingToolResults: Anthropic.ToolResultBlockParam[] = stillMissingToolUseIds.map((toolUse) => ({
		type: "tool_result" as const,
		tool_use_id: toolUse.id,
		content: "Tool execution was interrupted before completion.",
	}))

	// Insert missing tool_results at the beginning of the content array
	// This ensures they come before any text blocks that may summarize the results
	const finalContent = missingToolResults.length > 0 ? [...missingToolResults, ...correctedContent] : correctedContent

	return {
		...userMessage,
		content: finalContent,
	}
}

/**
 * Pre-send validation that ensures every tool_use block in the final message
 * array has a corresponding tool_result block in the immediately following
 * user message. This acts as a last-resort safety net right before the API
 * call, catching any mismatches introduced by post-processing steps like
 * getEffectiveApiHistory(), mergeConsecutiveApiMessages(), or
 * buildCleanConversationHistory().
 *
 * For any missing tool_result, a placeholder is injected so the API request
 * remains valid. Mismatches are reported to telemetry.
 *
 * @param messages - The final message array about to be sent to the API
 * @returns A new array with any missing tool_result placeholders injected
 */
export function validateMessageHistoryBeforeSend(
	messages: Anthropic.Messages.MessageParam[],
): Anthropic.Messages.MessageParam[] {
	// Work on a shallow copy so we don't mutate the caller's array.
	const result: Anthropic.Messages.MessageParam[] = []
	let modified = false

	for (let i = 0; i < messages.length; i++) {
		const current = messages[i]

		// We only care about assistant messages that contain tool_use blocks.
		if (current.role !== "assistant" || !Array.isArray(current.content)) {
			result.push(current)
			continue
		}

		const toolUseBlocks = (current.content as Anthropic.Messages.ContentBlockParam[]).filter(
			(block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
		)

		if (toolUseBlocks.length === 0) {
			result.push(current)
			continue
		}

		result.push(current)

		// Collect tool_use IDs that need matching tool_results.
		const toolUseIds = new Set(toolUseBlocks.map((b) => b.id))

		// Look at the next message - it should be a user message with tool_results.
		const next = messages[i + 1]

		// Gather existing tool_result IDs from the next message (if it's a user message).
		const existingToolResultIds = new Set<string>()
		let nextContent: Anthropic.Messages.ContentBlockParam[] = []

		if (next && next.role === "user" && Array.isArray(next.content)) {
			nextContent = next.content as Anthropic.Messages.ContentBlockParam[]
			for (const block of nextContent) {
				if (block.type === "tool_result") {
					existingToolResultIds.add((block as Anthropic.ToolResultBlockParam).tool_use_id)
				}
			}
		}

		// Determine which tool_use IDs are missing a tool_result.
		const missingIds = [...toolUseIds].filter((id) => !existingToolResultIds.has(id))

		if (missingIds.length === 0) {
			continue // All good for this pair.
		}

		// Report to telemetry.
		if (TelemetryService.hasInstance()) {
			TelemetryService.instance.captureException(
				new MissingToolResultError(
					`Pre-send validation: missing tool_result blocks for tool_use IDs: [${missingIds.join(", ")}]`,
					missingIds,
					[...existingToolResultIds],
				),
				{
					missingToolUseIds: missingIds,
					existingToolResultIds: [...existingToolResultIds],
					toolUseCount: toolUseBlocks.length,
					existingToolResultCount: existingToolResultIds.size,
					messageIndex: i,
				},
			)
		}

		modified = true

		// Build placeholder tool_result blocks for the missing IDs.
		const placeholders: Anthropic.ToolResultBlockParam[] = missingIds.map((id) => ({
			type: "tool_result" as const,
			tool_use_id: id,
			content: "Tool execution was interrupted before completion.",
		}))

		if (next && next.role === "user") {
			// Inject placeholders into the existing user message.
			const patchedNext: Anthropic.Messages.MessageParam = {
				...next,
				content: [...placeholders, ...nextContent],
			}
			result.push(patchedNext)
			i++ // Skip the next message since we already pushed the patched version.
		} else {
			// No following user message at all - insert a synthetic one.
			result.push({
				role: "user" as const,
				content: placeholders,
			})
			// Don't skip - the next message (if any) still needs to be processed.
		}
	}

	return modified ? result : messages
}
