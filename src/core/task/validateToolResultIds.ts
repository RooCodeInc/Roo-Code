import { Anthropic } from "@anthropic-ai/sdk"
import { TelemetryService } from "@roo-code/telemetry"
import { findLastIndex } from "../../shared/array"
import { getToolResultLikeId, getToolUseLikeId, isToolResultLikeBlock, isToolUseLikeBlock } from "./toolBlockFormat"

type AnyContentBlock = Anthropic.Messages.ContentBlockParam | (Record<string, unknown> & { type: string })

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
 * Custom error class for missing tool results.
 * Used for structured error tracking via PostHog when tool_use blocks
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
	const userContent = userMessage.content as AnyContentBlock[]

	// Only process user messages with array content
	if (userMessage.role !== "user" || !Array.isArray(userContent)) {
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

	const toolUseBlocks = (assistantContent as AnyContentBlock[]).filter(isToolUseLikeBlock)

	// No tool_use blocks to match against - no validation needed
	if (toolUseBlocks.length === 0) {
		return userMessage
	}

	// Find tool_result blocks in the user message
	let toolResults = userContent.filter(isToolResultLikeBlock)

	// Deduplicate tool_result blocks to prevent API protocol violations (GitHub #10465)
	// This serves as a safety net for any potential race conditions that could generate
	// duplicate tool_results with the same tool_use_id. The root cause (approval feedback
	// creating duplicate results) has been fixed in presentAssistantMessage.ts, but this
	// deduplication remains as a defensive measure for unknown edge cases.
	const seenToolResultIds = new Set<string>()
	const deduplicatedContent = userContent.filter((block) => {
		if (!isToolResultLikeBlock(block)) {
			return true
		}
		const id = getToolResultLikeId(block)
		if (!id) {
			return false
		}
		if (seenToolResultIds.has(id)) {
			return false // Duplicate - filter out
		}
		seenToolResultIds.add(id)
		return true
	})

	userMessage = {
		...userMessage,
		content: deduplicatedContent as Anthropic.Messages.ContentBlockParam[],
	}

	toolResults = deduplicatedContent.filter(isToolResultLikeBlock)

	// Build a set of valid tool_use IDs
	const validToolUseIds = new Set(
		toolUseBlocks.map((block) => getToolUseLikeId(block)).filter((id): id is string => Boolean(id)),
	)

	// Build a set of existing tool_result IDs
	const existingToolResultIds = new Set(
		toolResults.map((result) => getToolResultLikeId(result)).filter((id): id is string => Boolean(id)),
	)

	// Check for missing tool_results (tool_use IDs that don't have corresponding tool_results)
	const missingToolUseIds = toolUseBlocks
		.map((block) => getToolUseLikeId(block))
		.filter((id): id is string => Boolean(id))
		.filter((id) => !existingToolResultIds.has(id))

	// Check if any tool_result has an invalid ID
	const hasInvalidIds = toolResults.some((result) => {
		const id = getToolResultLikeId(result)
		return !id || !validToolUseIds.has(id)
	})

	// If no missing tool_results and no invalid IDs, no changes needed
	if (missingToolUseIds.length === 0 && !hasInvalidIds) {
		return userMessage
	}

	// We have issues - need to fix them
	const toolResultIdList = toolResults
		.map((result) => getToolResultLikeId(result))
		.filter((id): id is string => Boolean(id))
	const toolUseIdList = toolUseBlocks
		.map((toolUse) => getToolUseLikeId(toolUse))
		.filter((id): id is string => Boolean(id))

	// Report missing tool_results to PostHog error tracking
	if (missingToolUseIds.length > 0 && TelemetryService.hasInstance()) {
		TelemetryService.instance.captureException(
			new MissingToolResultError(
				`Detected missing tool_result blocks. Missing tool_use IDs: [${missingToolUseIds.join(", ")}], existing tool_result IDs: [${toolResultIdList.join(", ")}]`,
				missingToolUseIds,
				toolResultIdList,
			),
			{
				missingToolUseIds,
				existingToolResultIds: toolResultIdList,
				toolUseCount: toolUseBlocks.length,
				toolResultCount: toolResults.length,
			},
		)
	}

	// Report ID mismatches to PostHog error tracking
	if (hasInvalidIds && TelemetryService.hasInstance()) {
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

	// Match tool_results to tool_uses by position and fix incorrect IDs
	const usedToolUseIds = new Set<string>()
	const contentArray = userMessage.content as AnyContentBlock[]

	const correctedContent = contentArray
		.map((block: AnyContentBlock) => {
			if (!isToolResultLikeBlock(block)) {
				return block
			}
			const currentId = getToolResultLikeId(block)

			// If the ID is already valid and not yet used, keep it
			if (currentId && validToolUseIds.has(currentId) && !usedToolUseIds.has(currentId)) {
				usedToolUseIds.add(currentId)
				return block
			}

			// Find which tool_result index this block is by comparing references.
			// This correctly handles duplicate tool_use_ids - we find the actual block's
			// position among all tool_results, not the first block with a matching ID.
			const toolResultIndex = toolResults.indexOf(block)

			// Try to match by position - only fix if there's a corresponding tool_use
			if (toolResultIndex !== -1 && toolResultIndex < toolUseBlocks.length) {
				const correctId = getToolUseLikeId(toolUseBlocks[toolResultIndex])
				if (!correctId) {
					return null
				}
				// Only use this ID if it hasn't been used yet
				if (!usedToolUseIds.has(correctId)) {
					usedToolUseIds.add(correctId)
					if (block.type === "tool_result") {
						return {
							...block,
							tool_use_id: correctId,
						}
					}
					return {
						...block,
						toolCallId: correctId,
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
			.filter(isToolResultLikeBlock)
			.map((result) => getToolResultLikeId(result))
			.filter((id): id is string => Boolean(id)),
	)

	const stillMissingToolUseIds = toolUseBlocks
		.map((toolUse) => getToolUseLikeId(toolUse))
		.filter((id): id is string => Boolean(id))
		.filter((id) => !coveredToolUseIds.has(id))

	// Build final content: add missing tool_results at the beginning if any
	const prefersAiSdkToolResultFormat =
		toolResults.some((result) => result.type === "tool-result") ||
		toolUseBlocks.some((toolUse) => toolUse.type === "tool-call")
	const missingToolResults = stillMissingToolUseIds.map((toolUseId) =>
		prefersAiSdkToolResultFormat
			? ({
					type: "tool-result" as const,
					toolCallId: toolUseId,
					output: "Tool execution was interrupted before completion.",
				} satisfies AnyContentBlock)
			: ({
					type: "tool_result" as const,
					tool_use_id: toolUseId,
					content: "Tool execution was interrupted before completion.",
				} satisfies AnyContentBlock),
	)

	// Insert missing tool_results at the beginning of the content array
	// This ensures they come before any text blocks that may summarize the results
	const finalContent = missingToolResults.length > 0 ? [...missingToolResults, ...correctedContent] : correctedContent

	return {
		...userMessage,
		content: finalContent as Anthropic.Messages.ContentBlockParam[],
	}
}
