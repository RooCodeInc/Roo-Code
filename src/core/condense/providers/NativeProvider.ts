import Anthropic from "@anthropic-ai/sdk"

import { BaseCondensationProvider } from "../BaseProvider"
import { CondensationContext, CondensationOptions, CondensationResult } from "../types"
import { ApiMessage } from "../../task-persistence/apiMessages"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"
import { N_MESSAGES_TO_KEEP, getMessagesSinceLastSummary } from "../index"
import { t } from "../../../i18n"

/**
 * Default condensing prompt used when no custom prompt is provided
 */
const DEFAULT_CONDENSING_PROMPT = `\
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

/**
 * Native condensation provider
 * Replicates the original sliding-window condensation behavior
 * Uses Anthropic API to summarize conversation history
 */
export class NativeCondensationProvider extends BaseCondensationProvider {
	readonly id = "native"
	readonly name = "Native Condensation"
	readonly description = "Original condensation method using Anthropic API"

	/**
	 * Condense using original algorithm from condense/index.ts
	 */
	protected async condenseInternal(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<CondensationResult> {
		const { messages, systemPrompt, taskId, prevContextTokens } = context

		const response: CondensationResult = { messages, cost: 0, summary: "" }

		// Always preserve the first message (which may contain slash command content)
		const firstMessage = messages[0]

		// Get messages to summarize, including the first message and excluding the last N messages
		const messagesToSummarize = getMessagesSinceLastSummary(messages.slice(0, -N_MESSAGES_TO_KEEP))

		if (messagesToSummarize.length <= 1) {
			const error =
				messages.length <= N_MESSAGES_TO_KEEP + 1
					? t("common:errors.condense_not_enough_messages")
					: t("common:errors.condensed_recently")
			return { ...response, error }
		}

		const keepMessages = messages.slice(-N_MESSAGES_TO_KEEP)
		// Check if there's a recent summary in the messages we're keeping
		const recentSummaryExists = keepMessages.some((message) => message.isSummary)

		if (recentSummaryExists) {
			const error = t("common:errors.condensed_recently")
			return { ...response, error }
		}

		const finalRequestMessage: Anthropic.MessageParam = {
			role: "user",
			content: "Summarize the conversation so far, as described in the prompt instructions.",
		}

		// Select API handler (dedicated or main)
		const apiHandler = options.condensingApiHandler || options.apiHandler

		// Check if the chosen handler supports the required functionality
		if (!apiHandler || typeof apiHandler.createMessage !== "function") {
			throw new Error("Invalid API handler for condensing")
		}

		const requestMessages = maybeRemoveImageBlocks([...messagesToSummarize, finalRequestMessage], apiHandler).map(
			({ role, content }) => ({ role, content }),
		)

		// Use custom prompt if provided and non-empty, otherwise use the default
		const promptToUse = options.customCondensingPrompt?.trim()
			? options.customCondensingPrompt.trim()
			: DEFAULT_CONDENSING_PROMPT

		const stream = apiHandler.createMessage(promptToUse, requestMessages)

		let summary = ""
		let cost = 0
		let outputTokens = 0

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				summary += chunk.text
			} else if (chunk.type === "usage") {
				// Record final usage chunk only
				cost = chunk.totalCost ?? 0
				outputTokens = chunk.outputTokens ?? 0
			}
		}

		summary = summary.trim()

		if (summary.length === 0) {
			const error = t("common:errors.condense_failed")
			return { ...response, cost, error }
		}

		const summaryMessage: ApiMessage = {
			role: "assistant",
			content: summary,
			ts: keepMessages[0].ts,
			isSummary: true,
		}

		// Reconstruct messages: [first message, summary, last N messages]
		const newMessages = [firstMessage, summaryMessage, ...keepMessages]

		// Count the tokens in the context for the next API request
		// We only estimate the tokens in summaryMessage if outputTokens is 0, otherwise we use outputTokens
		const systemPromptMessage: ApiMessage = { role: "user", content: systemPrompt }

		const contextMessages = outputTokens
			? [systemPromptMessage, ...keepMessages]
			: [systemPromptMessage, summaryMessage, ...keepMessages]

		const contextBlocks = contextMessages.flatMap((message) =>
			typeof message.content === "string" ? [{ text: message.content, type: "text" as const }] : message.content,
		)

		const newContextTokens = outputTokens + (await apiHandler.countTokens(contextBlocks))
		if (newContextTokens >= prevContextTokens) {
			const error = t("common:errors.condense_context_grew")
			return { ...response, cost, error }
		}

		return {
			messages: newMessages,
			summary,
			cost,
			newContextTokens,
		}
	}

	/**
	 * Estimate cost based on message count
	 */
	async estimateCost(context: CondensationContext): Promise<number> {
		// Rough estimation: count all tokens in messages
		const totalTokens = context.messages.reduce((sum, msg) => {
			const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
			return sum + this.countTokens(content)
		}, 0)

		// Estimate: input = context + prompt overhead, output = ~20% of input
		const estimatedInput = totalTokens + 500 // +500 for prompt
		const estimatedOutput = Math.ceil(totalTokens * 0.2)

		// Cost calculation (Anthropic rates for Claude models)
		const inputCostPer1k = 0.003 // $3 per million / 1000
		const outputCostPer1k = 0.015 // $15 per million / 1000

		return (estimatedInput / 1000) * inputCostPer1k + (estimatedOutput / 1000) * outputCostPer1k
	}
}
