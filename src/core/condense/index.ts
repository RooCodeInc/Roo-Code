import Anthropic from "@anthropic-ai/sdk"

import { TelemetryService } from "@siid-code/telemetry"

import { t } from "../../i18n"
import { ApiHandler } from "../../api"
import { ApiMessage } from "../task-persistence/apiMessages"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"

export const N_MESSAGES_TO_KEEP = 3
export const MIN_CONDENSE_THRESHOLD = 5 // Minimum percentage of context window to trigger condensing
export const MAX_CONDENSE_THRESHOLD = 100 // Maximum percentage of context window to trigger condensing

const SUMMARY_PROMPT = `\
Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing with the conversation and supporting any continuing tasks.

Your summary should be structured as follows:
Context: The context to continue the conversation with. If applicable based on the current task, this should include:
  1. Previous Conversation: High level details about what was discussed throughout the entire conversation with the user. This should be written to allow someone to be able to follow the general overarching conversation flow.
  2. Current Work: Describe in detail what was being worked on prior to this request to summarize the conversation. Pay special attention to the more recent messages in the conversation.
  3. Key Technical Concepts: List all important technical concepts, technologies, coding conventions, and frameworks discussed, which might be relevant for continuing with this work.
  4. Relevant Files and Code: If applicable, enumerate specific files and code sections examined, modified, or created for the task continuation. Pay special attention to the most recent messages and changes.
  5. Problem Solving: Document problems solved thus far and any ongoing troubleshooting efforts.
  6. Pending Tasks and Next Steps: Outline all pending tasks that you have explicitly been asked to work on, as well as list the next steps you will take for all outstanding work, if applicable. Include code snippets where they add clarity. For any next steps, include direct quotes from the most recent conversation showing exactly what task you were working on and where you left off. This should be verbatim to ensure there's no information loss in context between tasks.

Example summary structure:
1. Previous Conversation:
  [Detailed description]
2. Current Work:
  [Detailed description]
3. Key Technical Concepts:
  - [Concept 1]
  - [Concept 2]
  - [...]
4. Relevant Files and Code:
  - [File Name 1]
    - [Summary of why this file is important]
    - [Summary of the changes made to this file, if any]
    - [Important Code Snippet]
  - [File Name 2]
    - [Important Code Snippet]
  - [...]
5. Problem Solving:
  [Detailed description]
6. Pending Tasks and Next Steps:
  - [Task 1 details & next steps]
  - [Task 2 details & next steps]
  - [...]

Output only the summary of the conversation so far, without any additional commentary or explanation.
`

export type SummarizeResponse = {
	messages: ApiMessage[] // The messages after summarization
	summary: string // The summary text; empty string for no summary
	cost: number // The cost of the summarization operation
	newContextTokens?: number // The number of tokens in the context for the next API request
	error?: string // Populated iff the operation fails: error message shown to the user on failure (see Task.ts)
}

/**
 * Summarizes the conversation messages using an LLM call
 *
 * @param {ApiMessage[]} messages - The conversation messages
 * @param {ApiHandler} apiHandler - The API handler to use for token counting.
 * @param {string} systemPrompt - The system prompt for API requests, which should be considered in the context token count
 * @param {string} taskId - The task ID for the conversation, used for telemetry
 * @param {boolean} isAutomaticTrigger - Whether the summarization is triggered automatically
 * @returns {SummarizeResponse} - The result of the summarization operation (see above)
 */
/**
 * Summarizes the conversation messages using an LLM call
 *
 * @param {ApiMessage[]} messages - The conversation messages
 * @param {ApiHandler} apiHandler - The API handler to use for token counting (fallback if condensingApiHandler not provided)
 * @param {string} systemPrompt - The system prompt for API requests (fallback if customCondensingPrompt not provided)
 * @param {string} taskId - The task ID for the conversation, used for telemetry
 * @param {number} prevContextTokens - The number of tokens currently in the context, used to ensure we don't grow the context
 * @param {boolean} isAutomaticTrigger - Whether the summarization is triggered automatically
 * @param {string} customCondensingPrompt - Optional custom prompt to use for condensing
 * @param {ApiHandler} condensingApiHandler - Optional specific API handler to use for condensing
 * @returns {SummarizeResponse} - The result of the summarization operation (see above)
 */
// Tools whose results should be replaced with a short status message
const TOOLS_TO_TRIM_RESULTS: string[] = [
	"list_files",
	"search_files",
	"codebase_search",
	"retrieve_sf_metadata",
	"execute_command",
	"read_file",
	"sf_deploy_metadata",
	"update_todo_list",
	"write_to_file",
	"apply_diff",
]

// Tools whose results should NOT be touched
// const TOOLS_TO_KEEP_RESULTS: string[] = [
// 	"fetch_instructions",
// 	"switch_mode",
// 	"new_task",
// ]

export async function summarizeConversation(
	messages: ApiMessage[],
	apiHandler: ApiHandler,
	systemPrompt: string,
	taskId: string,
	prevContextTokens: number,
	isAutomaticTrigger?: boolean,
	customCondensingPrompt?: string,
	condensingApiHandler?: ApiHandler,
): Promise<SummarizeResponse> {
	const startTime = Date.now()
	console.log(
		`[summarizeConversation] Starting full summarization. taskId: ${taskId}, messageCount: ${messages.length}, isAutomatic: ${isAutomaticTrigger}`,
	)

	try {
		// Use condensing handler if provided, otherwise use main handler
		const handler = condensingApiHandler ?? apiHandler
		const prompt = customCondensingPrompt ?? SUMMARY_PROMPT

		// If we have too few messages, no need to summarize
		if (messages.length <= N_MESSAGES_TO_KEEP * 2) {
			console.log(`[summarizeConversation] Too few messages (${messages.length}), skipping summarization`)
			return { messages, cost: 0, summary: "", newContextTokens: prevContextTokens }
		}

		// Split messages: keep first N and last N, summarize the middle
		const firstMessages = messages.slice(0, N_MESSAGES_TO_KEEP)
		const lastMessages = messages.slice(-N_MESSAGES_TO_KEEP)
		const middleMessages = messages.slice(N_MESSAGES_TO_KEEP, -N_MESSAGES_TO_KEEP)

		console.log(
			`[summarizeConversation] Message split: first=${firstMessages.length}, middle=${middleMessages.length}, last=${lastMessages.length}`,
		)

		// Remove images from middle messages to save tokens
		const cleanedMiddleMessages = maybeRemoveImageBlocks(middleMessages, handler)

		// Make LLM call to summarize the middle section
		const metadata = { taskId, mode: "summarize" }
		const stream = handler.createMessage(prompt, cleanedMiddleMessages, metadata)

		// Collect summary text and usage metrics
		let summaryText = ""
		let inputTokens = 0
		let outputTokens = 0
		let cacheWriteTokens = 0
		let cacheReadTokens = 0
		let totalCost: number | undefined

		console.log(`[summarizeConversation] Streaming summary from LLM...`)

		for await (const chunk of stream) {
			if (!chunk) continue

			switch (chunk.type) {
				case "text":
					summaryText += chunk.text
					break
				case "usage":
					inputTokens += chunk.inputTokens
					outputTokens += chunk.outputTokens
					cacheWriteTokens += chunk.cacheWriteTokens ?? 0
					cacheReadTokens += chunk.cacheReadTokens ?? 0
					totalCost = chunk.totalCost
					break
			}
		}

		console.log(
			`[summarizeConversation] Summary complete. Length: ${summaryText.length} chars, tokens: in=${inputTokens}, out=${outputTokens}`,
		)

		// If summary is empty or failed, return original messages
		if (!summaryText || summaryText.trim().length === 0) {
			console.log(`[summarizeConversation] Empty summary, returning original messages`)
			return {
				messages,
				cost: 0,
				summary: "",
				newContextTokens: prevContextTokens,
				error: "Summary generation returned empty result",
			}
		}

		// Calculate cost
		// Import at top of file: import { calculateApiCostAnthropic } from "../../shared/cost"
		const { calculateApiCostAnthropic } = await import("../../shared/cost")
		const cost =
			totalCost ??
			calculateApiCostAnthropic(
				handler.getModel().info,
				inputTokens,
				outputTokens,
				cacheWriteTokens,
				cacheReadTokens,
			)

		// Create summary message
		const summaryMessage: ApiMessage = {
			role: "assistant",
			content: [
				{
					type: "text",
					text: `[Context Summary]\n\n${summaryText}`,
				},
			],
		}

		// Build condensed conversation: first messages + summary + last messages
		const condensedMessages: ApiMessage[] = [...firstMessages, summaryMessage, ...lastMessages]

		// Count new token usage
		const contextBlocks = condensedMessages.flatMap((message) =>
			typeof message.content === "string" ? [{ text: message.content, type: "text" as const }] : message.content,
		)
		const newContextTokens = await handler.countTokens(contextBlocks)

		const duration = Date.now() - startTime
		const reduction = prevContextTokens - newContextTokens
		const reductionPercent = ((reduction / prevContextTokens) * 100).toFixed(1)

		console.log(
			`[summarizeConversation] Success! Duration: ${duration}ms, ` +
				`prevTokens: ${prevContextTokens}, newTokens: ${newContextTokens}, ` +
				`reduction: ${reduction} tokens (${reductionPercent}%), cost: $${cost.toFixed(4)}`,
		)

		// Track telemetry
		TelemetryService.instance.captureLlmCompletion(taskId, {
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
			cost,
		})

		return {
			messages: condensedMessages,
			summary: summaryText,
			cost,
			newContextTokens,
		}
	} catch (error) {
		const duration = Date.now() - startTime
		console.error(`[summarizeConversation] Error after ${duration}ms:`, error)

		// Return original messages on error, with error message
		return {
			messages,
			cost: 0,
			summary: "",
			newContextTokens: prevContextTokens,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}
