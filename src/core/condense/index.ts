import crypto from "crypto"

import { TelemetryService } from "@roo-code/telemetry"

import { t } from "../../i18n"
import { ApiHandler, ApiHandlerCreateMessageMetadata } from "../../api"
import {
	type RooMessage,
	type RooUserMessage,
	type RooToolMessage,
	type RooRoleMessage,
	isRooAssistantMessage,
	isRooToolMessage,
	isRooUserMessage,
	isRooRoleMessage,
	type ToolCallPart,
	type ToolResultPart,
	type TextPart,
	type AnyToolCallBlock,
	type AnyToolResultBlock,
	isAnyToolCallBlock,
	isAnyToolResultBlock,
	getToolCallId,
	getToolCallName,
	getToolCallInput,
	getToolResultCallId,
	getToolResultContent,
	getToolResultIsError,
} from "../task-persistence/rooMessage"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"
import { findLast } from "../../shared/array"
import { supportPrompt } from "../../shared/support-prompt"
import { RooIgnoreController } from "../ignore/RooIgnoreController"
import { generateFoldedFileContext } from "./foldedFileContext"

export type { FoldedFileContextResult, FoldedFileContextOptions } from "./foldedFileContext"

/**
 * Converts a tool-call / tool_use block to a text representation.
 * Accepts both AI SDK ToolCallPart (toolName, input) and legacy Anthropic format (name, input).
 */
export function toolUseToText(block: AnyToolCallBlock): string {
	const name = getToolCallName(block)
	const rawInput = getToolCallInput(block)
	let input: string
	if (typeof rawInput === "object" && rawInput !== null) {
		input = Object.entries(rawInput)
			.map(([key, value]) => {
				const formattedValue =
					typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value)
				return `${key}: ${formattedValue}`
			})
			.join("\n")
	} else {
		input = String(rawInput)
	}
	return `[Tool Use: ${name}]\n${input}`
}

/**
 * Converts a tool-result / tool_result block to a text representation.
 * Accepts both AI SDK ToolResultPart and legacy Anthropic format.
 */
export function toolResultToText(block: AnyToolResultBlock): string {
	const isError = getToolResultIsError(block)
	const errorSuffix = isError ? " (Error)" : ""
	// AI SDK uses `output`, legacy uses `content`
	const rawContent = getToolResultContent(block)
	if (typeof rawContent === "string") {
		return `[Tool Result${errorSuffix}]\n${rawContent}`
	} else if (Array.isArray(rawContent)) {
		const contentText = rawContent
			.map((contentBlock: { type: string; text?: string }) => {
				if (contentBlock.type === "text") {
					return contentBlock.text
				}
				if (contentBlock.type === "image") {
					return "[Image]"
				}
				return `[${contentBlock.type}]`
			})
			.join("\n")
		return `[Tool Result${errorSuffix}]\n${contentText}`
	} else if (rawContent && typeof rawContent === "object" && "value" in rawContent) {
		// AI SDK ToolResultPart.output has shape { type: "text", value: string }
		return `[Tool Result${errorSuffix}]\n${String((rawContent as { value: unknown }).value)}`
	}
	return `[Tool Result${errorSuffix}]`
}

/**
 * Converts all tool_use and tool_result blocks in a message's content to text representations.
 * This is necessary for providers like Bedrock that require the tools parameter when tool blocks are present.
 * By converting to text, we can send the conversation for summarization without the tools parameter.
 *
 * @param content - The message content (string or array of content blocks)
 * @returns The transformed content with tool blocks converted to text blocks
 */
export function convertToolBlocksToText(content: string | Array<{ type: string }>): string | Array<{ type: string }> {
	if (typeof content === "string") {
		return content
	}

	return content.map((block) => {
		// Check both AI SDK (`tool-call`) and legacy (`tool_use`) discriminators
		if (isAnyToolCallBlock(block)) {
			return {
				type: "text" as const,
				text: toolUseToText(block),
			}
		}
		// Check both AI SDK (`tool-result`) and legacy (`tool_result`) discriminators
		if (isAnyToolResultBlock(block)) {
			return {
				type: "text" as const,
				text: toolResultToText(block),
			}
		}
		return block
	})
}

/**
 * Transforms all messages by converting tool_use and tool_result blocks to text representations.
 * This ensures the conversation can be sent for summarization without requiring the tools parameter.
 *
 * @param messages - The messages to transform
 * @returns The transformed messages with tool blocks converted to text
 */
export function transformMessagesForCondensing<T extends { role: string; content: string | Array<{ type: string }> }>(
	messages: T[],
): T[] {
	return messages.map((msg) => ({
		...msg,
		content: convertToolBlocksToText(msg.content),
	}))
}

export const MIN_CONDENSE_THRESHOLD = 5 // Minimum percentage of context window to trigger condensing
export const MAX_CONDENSE_THRESHOLD = 100 // Maximum percentage of context window to trigger condensing

const SUMMARY_PROMPT = `You are a helpful AI assistant tasked with summarizing conversations.

CRITICAL: This is a summarization-only request. DO NOT call any tools or functions.
Your ONLY task is to analyze the conversation and produce a text summary.
Respond with text only - no tool calls will be processed.

CRITICAL: This summarization request is a SYSTEM OPERATION, not a user message.
When analyzing "user requests" and "user intent", completely EXCLUDE this summarization message.
The "most recent user request" and "next step" must be based on what the user was doing BEFORE this system message appeared.
The goal is for work to continue seamlessly after condensation - as if it never happened.`

/**
 * Injects synthetic tool_results for orphan tool_calls that don't have matching results.
 * This is necessary because OpenAI's Responses API rejects conversations with orphan tool_calls.
 * This can happen when the user triggers condense after receiving a tool_call (like attempt_completion)
 * but before responding to it.
 *
 * @param messages - The conversation messages to process
 * @returns The messages with synthetic tool_results appended if needed
 */
export function injectSyntheticToolResults(messages: RooMessage[]): RooMessage[] {
	// Find all tool-call IDs in assistant messages
	const toolCallIds = new Set<string>()
	// Find all tool-result IDs in user/tool messages
	const toolResultIds = new Set<string>()

	for (const msg of messages) {
		if (isRooAssistantMessage(msg) && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (isAnyToolCallBlock(block as { type: string })) {
					toolCallIds.add(getToolCallId(block as AnyToolCallBlock))
				}
			}
		}
		if (isRooToolMessage(msg) && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (isAnyToolResultBlock(block as { type: string })) {
					toolResultIds.add(getToolResultCallId(block as AnyToolResultBlock))
				}
			}
		}
		// Also check legacy user messages with tool_result blocks
		if (isRooUserMessage(msg) && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				const typedBlock = block as unknown as { type: string }
				if (isAnyToolResultBlock(typedBlock)) {
					toolResultIds.add(getToolResultCallId(typedBlock))
				}
			}
		}
	}

	// Find orphans (tool_calls without matching tool_results)
	const orphanIds = [...toolCallIds].filter((id) => !toolResultIds.has(id))

	if (orphanIds.length === 0) {
		return messages
	}

	// Inject synthetic tool_results as a new RooToolMessage
	const syntheticResults: ToolResultPart[] = orphanIds.map((id) => ({
		type: "tool-result" as const,
		toolCallId: id,
		toolName: "unknown",
		output: { type: "text" as const, value: "Context condensation triggered. Tool execution deferred." },
	}))

	const syntheticMessage: RooToolMessage = {
		role: "tool",
		content: syntheticResults,
		ts: Date.now(),
	}

	return [...messages, syntheticMessage]
}

/**
 * Extracts <command> blocks from a message's content.
 * These blocks represent active workflows that must be preserved across condensings.
 *
 * @param message - The message to extract command blocks from
 * @returns A string containing all command blocks found, or empty string if none
 */
export function extractCommandBlocks(message: RooMessage): string {
	if (!isRooRoleMessage(message)) {
		return ""
	}
	const content = message.content
	let text: string

	if (typeof content === "string") {
		text = content
	} else if (Array.isArray(content)) {
		// Concatenate all text blocks
		text = content
			.filter((block): block is TextPart => (block as { type: string }).type === "text")
			.map((block) => block.text)
			.join("\n")
	} else {
		return ""
	}

	// Match all <command> blocks including their content
	const commandRegex = /<command[^>]*>[\s\S]*?<\/command>/g
	const matches = text.match(commandRegex)

	if (!matches || matches.length === 0) {
		return ""
	}

	return matches.join("\n")
}

export type SummarizeResponse = {
	messages: RooMessage[] // The messages after summarization
	summary: string // The summary text; empty string for no summary
	cost: number // The cost of the summarization operation
	newContextTokens?: number // The number of tokens in the context for the next API request
	error?: string // Populated iff the operation fails: error message shown to the user on failure (see Task.ts)
	errorDetails?: string // Detailed error information including stack trace and API error info
	condenseId?: string // The unique ID of the created Summary message, for linking to condense_context clineMessage
}

export type SummarizeConversationOptions = {
	messages: RooMessage[]
	apiHandler: ApiHandler
	systemPrompt: string
	taskId: string
	isAutomaticTrigger?: boolean
	customCondensingPrompt?: string
	metadata?: ApiHandlerCreateMessageMetadata
	environmentDetails?: string
	filesReadByRoo?: string[]
	cwd?: string
	rooIgnoreController?: RooIgnoreController
}

/**
 * Summarizes the conversation messages using an LLM call.
 *
 * This implements the "fresh start" model where:
 * - The summary becomes a user message (not assistant)
 * - Post-condense, the model sees only the summary (true fresh start)
 * - All messages are still stored but tagged with condenseParent
 * - <command> blocks from the original task are preserved across condensings
 * - File context (folded code definitions) can be preserved for continuity
 *
 * Environment details handling:
 * - For AUTOMATIC condensing (isAutomaticTrigger=true): Environment details are included
 *   in the summary because the API request is already in progress and the next user
 *   message won't have fresh environment details injected.
 * - For MANUAL condensing (isAutomaticTrigger=false): Environment details are NOT included
 *   because fresh environment details will be injected on the very next turn via
 *   getEnvironmentDetails() in recursivelyMakeClineRequests().
 */
export async function summarizeConversation(options: SummarizeConversationOptions): Promise<SummarizeResponse> {
	const {
		messages,
		apiHandler,
		systemPrompt,
		taskId,
		isAutomaticTrigger,
		customCondensingPrompt,
		metadata,
		environmentDetails,
		filesReadByRoo,
		cwd,
		rooIgnoreController,
	} = options
	TelemetryService.instance.captureContextCondensed(
		taskId,
		isAutomaticTrigger ?? false,
		!!customCondensingPrompt?.trim(),
	)

	const response: SummarizeResponse = { messages, cost: 0, summary: "" }

	// Get messages to summarize (all messages since the last summary, if any)
	const messagesToSummarize = getMessagesSinceLastSummary(messages)

	if (messagesToSummarize.length <= 1) {
		const error =
			messages.length <= 1
				? t("common:errors.condense_not_enough_messages")
				: t("common:errors.condensed_recently")
		return { ...response, error }
	}

	// Check if there's a recent summary in the messages (edge case)
	const recentSummaryExists = messagesToSummarize.some((message) => message.isSummary)

	if (recentSummaryExists && messagesToSummarize.length <= 2) {
		const error = t("common:errors.condensed_recently")
		return { ...response, error }
	}

	// Use custom prompt if provided and non-empty, otherwise use the default CONDENSE prompt
	// This respects user's custom condensing prompt setting
	const condenseInstructions = customCondensingPrompt?.trim() || supportPrompt.default.CONDENSE

	const finalRequestMessage: RooUserMessage = {
		role: "user",
		content: condenseInstructions,
	}

	// Inject synthetic tool_results for orphan tool_calls to prevent API rejections
	// (e.g., when user triggers condense after receiving attempt_completion but before responding)
	const messagesWithToolResults = injectSyntheticToolResults(messagesToSummarize)

	// Transform tool_use and tool_result blocks to text representations.
	// This is necessary because some providers (like Bedrock via LiteLLM) require the `tools` parameter
	// when tool blocks are present. By converting them to text, we can send the conversation for
	// summarization without needing to pass the tools parameter.
	// Filter out reasoning messages (no role/content) before transforming for the API
	const messagesForApi = [...messagesWithToolResults, finalRequestMessage].filter(
		(msg): msg is Exclude<RooMessage, { type: "reasoning" }> => "role" in msg,
	)
	const messagesWithTextToolBlocks = transformMessagesForCondensing(
		maybeRemoveImageBlocks(messagesForApi, apiHandler) as Array<{
			role: string
			content: string | Array<{ type: string }>
		}>,
	)

	const requestMessages = messagesWithTextToolBlocks.map(({ role, content }) => ({ role, content }))

	// Note: this doesn't need to be a stream, consider using something like apiHandler.completePrompt
	const promptToUse = SUMMARY_PROMPT

	// Validate that the API handler supports message creation
	if (!apiHandler || typeof apiHandler.createMessage !== "function") {
		console.error("API handler is invalid for condensing. Cannot proceed.")
		const error = t("common:errors.condense_handler_invalid")
		return { ...response, error }
	}

	let summary = ""
	let cost = 0
	let outputTokens = 0

	try {
		const stream = apiHandler.createMessage(promptToUse, requestMessages as RooMessage[], metadata)

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				summary += chunk.text
			} else if (chunk.type === "usage") {
				// Record final usage chunk only
				cost = chunk.totalCost ?? 0
				outputTokens = chunk.outputTokens ?? 0
			}
		}
	} catch (error) {
		console.error("Error during condensing API call:", error)
		const errorMessage = error instanceof Error ? error.message : String(error)

		// Capture detailed error information for debugging
		let errorDetails = ""
		if (error instanceof Error) {
			errorDetails = `Error: ${error.message}`
			// Capture any additional API error properties
			const anyError = error as unknown as Record<string, unknown>
			if (anyError.status) {
				errorDetails += `\n\nHTTP Status: ${anyError.status}`
			}
			if (anyError.code) {
				errorDetails += `\nError Code: ${anyError.code}`
			}
			if (anyError.response) {
				try {
					errorDetails += `\n\nAPI Response:\n${JSON.stringify(anyError.response, null, 2)}`
				} catch {
					errorDetails += `\n\nAPI Response: [Unable to serialize]`
				}
			}
			if (anyError.body) {
				try {
					errorDetails += `\n\nResponse Body:\n${JSON.stringify(anyError.body, null, 2)}`
				} catch {
					errorDetails += `\n\nResponse Body: [Unable to serialize]`
				}
			}
		} else {
			errorDetails = String(error)
		}

		return {
			...response,
			cost,
			error: t("common:errors.condense_api_failed", { message: errorMessage }),
			errorDetails,
		}
	}

	summary = summary.trim()

	if (summary.length === 0) {
		const error = t("common:errors.condense_failed")
		return { ...response, cost, error }
	}

	// Extract command blocks from the first message (original task)
	// These represent active workflows that must persist across condensings
	const firstMessage = messages[0]
	const commandBlocks = firstMessage ? extractCommandBlocks(firstMessage) : ""

	// Build the summary content as separate text blocks
	const summaryContent: TextPart[] = [{ type: "text", text: `## Conversation Summary\n${summary}` }]

	// Add command blocks (active workflows) in their own system-reminder block if present
	if (commandBlocks) {
		summaryContent.push({
			type: "text",
			text: `<system-reminder>
## Active Workflows
The following directives must be maintained across all future condensings:
${commandBlocks}
</system-reminder>`,
		})
	}

	// Generate and add folded file context (smart code folding) if file paths are provided
	// Each file gets its own <system-reminder> block as a separate content block
	if (filesReadByRoo && filesReadByRoo.length > 0 && cwd) {
		try {
			const foldedResult = await generateFoldedFileContext(filesReadByRoo, {
				cwd,
				rooIgnoreController,
			})
			if (foldedResult.sections.length > 0) {
				for (const section of foldedResult.sections) {
					if (section.trim()) {
						summaryContent.push({
							type: "text",
							text: section,
						})
					}
				}
			}
		} catch (error) {
			console.error("[summarizeConversation] Failed to generate folded file context:", error)
			// Continue without folded context - non-critical failure
		}
	}

	// Add environment details as a separate text block if provided AND this is an automatic trigger.
	// For manual condensing, fresh environment details will be injected on the next turn.
	// For automatic condensing, the API request is already in progress so we need them in the summary.
	if (isAutomaticTrigger && environmentDetails?.trim()) {
		summaryContent.push({
			type: "text",
			text: environmentDetails,
		})
	}

	// Generate a unique condenseId for this summary
	const condenseId = crypto.randomUUID()

	// Use the last message's timestamp + 1 to ensure unique timestamp for summary.
	// The summary goes at the end of all messages.
	const lastMsgTs = messages[messages.length - 1]?.ts ?? Date.now()

	const summaryMessage: RooUserMessage = {
		role: "user", // Fresh start model: summary is a user message
		content: summaryContent,
		ts: lastMsgTs + 1, // Unique timestamp after last message
		isSummary: true,
		condenseId, // Unique ID for this summary, used to track which messages it replaces
	}

	// NON-DESTRUCTIVE CONDENSE:
	// Tag ALL existing messages with condenseParent so they are filtered out when
	// the effective history is computed. The summary message is the only message
	// that will be visible to the API after condensing (fresh start model).
	//
	// Storage structure after condense:
	// [msg1(parent=X), msg2(parent=X), ..., msgN(parent=X), summary(id=X)]
	//
	// Effective for API (filtered by getEffectiveApiHistory):
	// [summary]  ← Fresh start!

	// Tag ALL messages with condenseParent
	const newMessages = messages.map((msg) => {
		// If message already has a condenseParent, we leave it - nested condense is handled by filtering
		if (!msg.condenseParent) {
			return { ...msg, condenseParent: condenseId }
		}
		return msg
	})

	// Append the summary message at the end
	newMessages.push(summaryMessage)

	// Count the tokens in the context for the next API request
	// After condense, the context will contain: system prompt + summary + tool definitions
	const systemPromptMessage: RooUserMessage = { role: "user", content: systemPrompt }

	// Count actual summaryMessage content directly instead of using outputTokens as a proxy
	// This ensures we account for wrapper text (## Conversation Summary, <system-reminder>, <environment_details>)
	const contextBlocks = [systemPromptMessage, summaryMessage].flatMap((message) =>
		typeof message.content === "string" ? [{ text: message.content, type: "text" as const }] : message.content,
	)

	const messageTokens = await apiHandler.countTokens(contextBlocks as Parameters<typeof apiHandler.countTokens>[0])

	// Count tool definition tokens if tools are provided
	let toolTokens = 0
	if (metadata?.tools && metadata.tools.length > 0) {
		const toolsText = JSON.stringify(metadata.tools)
		toolTokens = await apiHandler.countTokens([{ text: toolsText, type: "text" }])
	}

	const newContextTokens = messageTokens + toolTokens
	return { messages: newMessages, summary, cost, newContextTokens, condenseId }
}

/**
 * Returns the list of all messages since the last summary message, including the summary.
 * Returns all messages if there is no summary.
 *
 * Note: Summary messages are always created with role: "user" (fresh-start model),
 * so the first message since the last summary is guaranteed to be a user message.
 */
export function getMessagesSinceLastSummary(messages: RooMessage[]): RooMessage[] {
	const lastSummaryIndexReverse = [...messages].reverse().findIndex((message) => message.isSummary)

	if (lastSummaryIndexReverse === -1) {
		return messages
	}

	const lastSummaryIndex = messages.length - lastSummaryIndexReverse - 1
	return messages.slice(lastSummaryIndex)
}

/**
 * Filters the API conversation history to get the "effective" messages to send to the API.
 *
 * Fresh Start Model:
 * - When a summary exists, return only messages from the summary onwards (fresh start)
 * - Messages with a condenseParent pointing to an existing summary are filtered out
 *
 * Messages with a truncationParent that points to an existing truncation marker are also filtered out,
 * as they have been hidden by sliding window truncation.
 *
 * This allows non-destructive condensing and truncation where messages are tagged but not deleted,
 * enabling accurate rewind operations while still sending condensed/truncated history to the API.
 *
 * @param messages - The full API conversation history including tagged messages
 * @returns The filtered history that should be sent to the API
 */
export function getEffectiveApiHistory(messages: RooMessage[]): RooMessage[] {
	// Find the most recent summary message
	const lastSummary = findLast(messages, (msg) => msg.isSummary === true)

	if (lastSummary) {
		// Fresh start model: return only messages from the summary onwards
		const summaryIndex = messages.indexOf(lastSummary)
		let messagesFromSummary = messages.slice(summaryIndex)

		// Collect all tool call IDs from assistant messages in the result.
		// This is needed to filter out orphan tool results that reference
		// tool call IDs from messages that were condensed away.
		const toolCallIds = new Set<string>()
		for (const msg of messagesFromSummary) {
			if (isRooAssistantMessage(msg) && Array.isArray(msg.content)) {
				for (const part of msg.content) {
					if (part.type === "tool-call") {
						toolCallIds.add((part as ToolCallPart).toolCallId)
					}
				}
			}
		}

		// Filter out orphan tool results from tool messages
		messagesFromSummary = messagesFromSummary
			.map((msg) => {
				if (isRooToolMessage(msg) && Array.isArray(msg.content)) {
					const filteredContent = msg.content.filter((part) => {
						if (part.type === "tool-result") {
							return toolCallIds.has((part as ToolResultPart).toolCallId)
						}
						return true
					})
					if (filteredContent.length === 0) {
						return null
					}
					if (filteredContent.length !== msg.content.length) {
						return { ...msg, content: filteredContent }
					}
				}
				// Also handle legacy user messages that may contain tool_result blocks
				if (isRooUserMessage(msg) && Array.isArray(msg.content)) {
					const filteredContent = msg.content.filter((block) => {
						const typedBlock = block as unknown as { type: string }
						if (isAnyToolResultBlock(typedBlock)) {
							return toolCallIds.has(getToolResultCallId(typedBlock))
						}
						return true
					})
					if (filteredContent.length === 0) {
						return null
					}
					if (filteredContent.length !== msg.content.length) {
						return { ...msg, content: filteredContent as typeof msg.content }
					}
				}
				return msg
			})
			.filter((msg): msg is RooMessage => msg !== null)

		// Still need to filter out any truncated messages within this range
		const existingTruncationIds = new Set<string>()
		for (const msg of messagesFromSummary) {
			if (msg.isTruncationMarker && msg.truncationId) {
				existingTruncationIds.add(msg.truncationId)
			}
		}

		return messagesFromSummary.filter((msg) => {
			if (msg.truncationParent && existingTruncationIds.has(msg.truncationParent)) {
				return false
			}
			return true
		})
	}

	// No summary - filter based on condenseParent and truncationParent as before
	// This handles the case of orphaned condenseParent tags (summary was deleted via rewind)

	const existingSummaryIds = new Set<string>()
	const existingTruncationIds = new Set<string>()

	for (const msg of messages) {
		if (msg.isSummary && msg.condenseId) {
			existingSummaryIds.add(msg.condenseId)
		}
		if (msg.isTruncationMarker && msg.truncationId) {
			existingTruncationIds.add(msg.truncationId)
		}
	}

	return messages.filter((msg) => {
		if (msg.condenseParent && existingSummaryIds.has(msg.condenseParent)) {
			return false
		}
		if (msg.truncationParent && existingTruncationIds.has(msg.truncationParent)) {
			return false
		}
		return true
	})
}

/**
 * Cleans up orphaned condenseParent and truncationParent references after a truncation operation (rewind/delete).
 * When a summary message or truncation marker is deleted, messages that were tagged with its ID
 * should have their parent reference cleared so they become active again.
 *
 * This function should be called after any operation that truncates the API history
 * to ensure messages are properly restored when their summary or truncation marker is deleted.
 *
 * @param messages - The API conversation history after truncation
 * @returns The cleaned history with orphaned condenseParent and truncationParent fields cleared
 */
export function cleanupAfterTruncation(messages: RooMessage[]): RooMessage[] {
	// Collect all condenseIds of summaries that still exist
	const existingSummaryIds = new Set<string>()
	// Collect all truncationIds of truncation markers that still exist
	const existingTruncationIds = new Set<string>()

	for (const msg of messages) {
		if (msg.isSummary && msg.condenseId) {
			existingSummaryIds.add(msg.condenseId)
		}
		if (msg.isTruncationMarker && msg.truncationId) {
			existingTruncationIds.add(msg.truncationId)
		}
	}

	// Clear orphaned parent references for messages whose summary or truncation marker was deleted
	return messages.map((msg) => {
		let needsUpdate = false

		// Check for orphaned condenseParent
		if (msg.condenseParent && !existingSummaryIds.has(msg.condenseParent)) {
			needsUpdate = true
		}

		// Check for orphaned truncationParent
		if (msg.truncationParent && !existingTruncationIds.has(msg.truncationParent)) {
			needsUpdate = true
		}

		if (needsUpdate) {
			// Create a new object without orphaned parent references
			const { condenseParent, truncationParent, ...rest } = msg
			const result = rest as RooMessage

			// Keep condenseParent if its summary still exists
			if (condenseParent && existingSummaryIds.has(condenseParent)) {
				result.condenseParent = condenseParent
			}

			// Keep truncationParent if its truncation marker still exists
			if (truncationParent && existingTruncationIds.has(truncationParent)) {
				result.truncationParent = truncationParent
			}

			return result
		}
		return msg
	})
}
