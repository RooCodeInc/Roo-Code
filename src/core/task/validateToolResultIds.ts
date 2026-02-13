import { TelemetryService } from "@roo-code/telemetry"
import { findLastIndex } from "../../shared/array"
import type {
	RooMessage,
	RooRoleMessage,
	ToolCallPart,
	ToolResultPart,
	AnyToolCallBlock,
	AnyToolResultBlock,
} from "../task-persistence/rooMessage"
import {
	isRooRoleMessage,
	isAnyToolCallBlock,
	isAnyToolResultBlock,
	getToolCallId as sharedGetToolCallId,
	getToolCallName,
	getToolResultCallId as sharedGetToolResultCallId,
	setToolResultCallId as sharedSetToolResultCallId,
} from "../task-persistence/rooMessage"

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
 * Used for structured error tracking via PostHog when tool-call blocks
 * don't have corresponding tool-result blocks.
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

/** Local aliases for shared dual-format helpers. */
const isToolCallBlock = isAnyToolCallBlock
const isToolResultBlock = isAnyToolResultBlock
const getToolCallId = sharedGetToolCallId
const getToolResultCallId = sharedGetToolResultCallId
const setToolResultCallId = sharedSetToolResultCallId

/**
 * Validates and fixes tool result IDs in a user/tool message against the previous assistant message.
 *
 * This is a centralized validation that catches all tool-call/tool-result issues
 * before messages are added to the API conversation history. It handles scenarios like:
 * - Race conditions during streaming
 * - Message editing scenarios
 * - Resume/delegation scenarios
 * - Missing tool-result blocks for tool-call calls
 *
 * @param userMessage - The user or tool message being added to history
 * @param apiConversationHistory - The conversation history to find the previous assistant message from
 * @returns The validated message with corrected tool call IDs and any missing tool results added
 */
export function validateAndFixToolResultIds(userMessage: RooMessage, apiConversationHistory: RooMessage[]): RooMessage {
	// Only process messages with array content that have a role
	if (!isRooRoleMessage(userMessage) || !Array.isArray(userMessage.content)) {
		return userMessage
	}

	// Find the previous assistant message from conversation history
	const prevAssistantIdx = findLastIndex(apiConversationHistory, (msg) => "role" in msg && msg.role === "assistant")
	if (prevAssistantIdx === -1) {
		return userMessage
	}

	const previousAssistantMessage = apiConversationHistory[prevAssistantIdx]

	// Get tool-call blocks from the assistant message
	if (!isRooRoleMessage(previousAssistantMessage)) {
		return userMessage
	}
	const assistantContent = previousAssistantMessage.content
	if (!Array.isArray(assistantContent)) {
		return userMessage
	}

	const toolCallBlocks = (assistantContent as Array<{ type: string }>).filter(isToolCallBlock)

	// No tool-call blocks to match against - no validation needed
	if (toolCallBlocks.length === 0) {
		return userMessage
	}

	// Find tool-result blocks in the user/tool message
	const contentArray = userMessage.content as Array<{ type: string }>
	let toolResults = contentArray.filter(isToolResultBlock)

	// Deduplicate tool-result blocks to prevent API protocol violations (GitHub #10465)
	const seenToolResultIds = new Set<string>()
	const deduplicatedContent = contentArray.filter((block) => {
		if (!isToolResultBlock(block)) {
			return true
		}
		const callId = getToolResultCallId(block)
		if (seenToolResultIds.has(callId)) {
			return false // Duplicate - filter out
		}
		seenToolResultIds.add(callId)
		return true
	})

	userMessage = {
		...userMessage,
		content: deduplicatedContent,
	} as RooMessage

	toolResults = deduplicatedContent.filter(isToolResultBlock)

	// Build a set of valid tool-call IDs
	const validToolCallIds = new Set(toolCallBlocks.map(getToolCallId))

	// Build a set of existing tool-result IDs
	const existingToolResultIds = new Set(toolResults.map(getToolResultCallId))

	// Check for missing tool-results (tool-call IDs that don't have corresponding tool-results)
	const missingToolCallIds = toolCallBlocks
		.filter((tc) => !existingToolResultIds.has(getToolCallId(tc)))
		.map(getToolCallId)

	// Check if any tool-result has an invalid ID
	const hasInvalidIds = toolResults.some((result) => !validToolCallIds.has(getToolResultCallId(result)))

	// If no missing tool-results and no invalid IDs, no changes needed
	if (missingToolCallIds.length === 0 && !hasInvalidIds) {
		return userMessage
	}

	// We have issues - need to fix them
	const toolResultIdList = toolResults.map(getToolResultCallId)
	const toolCallIdList = toolCallBlocks.map(getToolCallId)

	// Report missing tool-results to PostHog error tracking
	if (missingToolCallIds.length > 0 && TelemetryService.hasInstance()) {
		TelemetryService.instance.captureException(
			new MissingToolResultError(
				`Detected missing tool_result blocks. Missing tool_use IDs: [${missingToolCallIds.join(", ")}], existing tool_result IDs: [${toolResultIdList.join(", ")}]`,
				missingToolCallIds,
				toolResultIdList,
			),
			{
				missingToolUseIds: missingToolCallIds,
				existingToolResultIds: toolResultIdList,
				toolUseCount: toolCallBlocks.length,
				toolResultCount: toolResults.length,
			},
		)
	}

	// Report ID mismatches to PostHog error tracking
	if (hasInvalidIds && TelemetryService.hasInstance()) {
		TelemetryService.instance.captureException(
			new ToolResultIdMismatchError(
				`Detected tool_result ID mismatch. tool_result IDs: [${toolResultIdList.join(", ")}], tool_use IDs: [${toolCallIdList.join(", ")}]`,
				toolResultIdList,
				toolCallIdList,
			),
			{
				toolResultIds: toolResultIdList,
				toolUseIds: toolCallIdList,
				toolResultCount: toolResults.length,
				toolUseCount: toolCallBlocks.length,
			},
		)
	}

	// Match tool-results to tool-calls by position and fix incorrect IDs
	const usedToolCallIds = new Set<string>()
	// userMessage was reassigned above with deduplicatedContent, so we know it has array content
	const correctedContentArray = (userMessage as RooRoleMessage).content as Array<{ type: string }>

	const correctedContent = correctedContentArray
		.map((block) => {
			if (!isToolResultBlock(block)) {
				return block
			}

			const callId = getToolResultCallId(block)

			// If the ID is already valid and not yet used, keep it
			if (validToolCallIds.has(callId) && !usedToolCallIds.has(callId)) {
				usedToolCallIds.add(callId)
				return block
			}

			// Find which tool-result index this block is by comparing references.
			const toolResultIndex = toolResults.indexOf(block)

			// Try to match by position - only fix if there's a corresponding tool-call
			if (toolResultIndex !== -1 && toolResultIndex < toolCallBlocks.length) {
				const correctId = getToolCallId(toolCallBlocks[toolResultIndex])
				// Only use this ID if it hasn't been used yet
				if (!usedToolCallIds.has(correctId)) {
					usedToolCallIds.add(correctId)
					return setToolResultCallId(block, correctId)
				}
			}

			// No corresponding tool-call for this tool-result, or the ID is already used
			return null
		})
		.filter((block): block is NonNullable<typeof block> => block !== null)

	// Add missing tool-result blocks for any tool-call that doesn't have one
	const coveredToolCallIds = new Set(correctedContent.filter(isToolResultBlock).map(getToolResultCallId))

	const stillMissingToolCalls = toolCallBlocks.filter((tc) => !coveredToolCallIds.has(getToolCallId(tc)))

	// Build final content: add missing tool-results at the beginning if any
	// Create as AI SDK ToolResultPart format
	const missingToolResults: ToolResultPart[] = stillMissingToolCalls.map((tc) => ({
		type: "tool-result" as const,
		toolCallId: getToolCallId(tc),
		toolName: getToolCallName(tc),
		output: { type: "text" as const, value: "Tool execution was interrupted before completion." },
	}))

	// Insert missing tool-results at the beginning of the content array
	const finalContent = missingToolResults.length > 0 ? [...missingToolResults, ...correctedContent] : correctedContent

	return {
		...userMessage,
		content: finalContent,
	} as RooMessage
}
