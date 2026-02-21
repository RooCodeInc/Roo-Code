import { Anthropic } from "@anthropic-ai/sdk"
import os from "os"
import * as path from "path"
import * as vscode from "vscode"

import { ApiMessage } from "../../core/task-persistence/apiMessages"

interface DebugExportMetadata {
	taskId: string
	timestamp: number
	taskNumber?: number
	workspace?: string
	mode?: string
	systemPrompt?: string
	modelId?: string
	contextWindow?: number
}

interface ConversationRequest {
	requestIndex: number
	timestamp: number
	userMessage: Anthropic.Messages.ContentBlockParam[]
	assistantResponse?: Anthropic.Messages.ContentBlockParam[]
	toolsUsed: string[]
	hadPreTask: boolean
	hadEnvironmentDetails: boolean
	wasStripped: boolean
	estimatedTokens?: {
		userMessageTokens: number
		assistantResponseTokens: number
		cumulativeTokens: number
	}
}

interface SummaryRequest {
	summaryIndex: number
	timestamp: number
	position: number // Position in raw message array
	messagesCondensed: {
		firstMessagesKept: number
		middleMessagesCondensed: number
		lastMessagesKept: number
	}
	summaryContent: string
	estimatedTokens?: {
		beforeCondensing: number
		afterCondensing: number
		reduction: number
		reductionPercent: number
	}
}

interface ContextUsageData {
	totalMessages: number
	estimatedCurrentTokens: number
	maxContextWindow?: number
	percentUsed?: number
}

interface MessageStatistics {
	totalMessages: number
	userMessages: number
	assistantMessages: number
	summaryMessages: number
	conversationExchanges: number
	toolUseCount: number
	toolResultCount: number
	toolUseSummary: Record<string, number>
	errorCount: number
}

/**
 * Estimates token count for a message (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(content: Anthropic.Messages.ContentBlockParam[]): number {
	let charCount = 0
	for (const block of content) {
		if (block.type === "text") {
			charCount += (block as Anthropic.Messages.TextBlockParam).text?.length || 0
		} else if (block.type === "tool_use") {
			const toolUse = block as Anthropic.Messages.ToolUseBlockParam
			charCount += JSON.stringify(toolUse.input || {}).length
		} else if (block.type === "tool_result") {
			const toolResult = block as Anthropic.Messages.ToolResultBlockParam
			if (typeof toolResult.content === "string") {
				charCount += toolResult.content.length
			} else if (Array.isArray(toolResult.content)) {
				for (const item of toolResult.content) {
					if (item.type === "text") {
						charCount += item.text?.length || 0
					}
				}
			}
		}
	}
	return Math.ceil(charCount / 4)
}

function computeStatistics(messages: ApiMessage[]): MessageStatistics {
	const stats: MessageStatistics = {
		totalMessages: messages.length,
		userMessages: 0,
		assistantMessages: 0,
		summaryMessages: 0,
		conversationExchanges: 0,
		toolUseCount: 0,
		toolResultCount: 0,
		toolUseSummary: {},
		errorCount: 0,
	}

	let consecutiveUserAssistant = 0

	for (const message of messages) {
		if (message.role === "user") {
			stats.userMessages++
			consecutiveUserAssistant++
		} else {
			stats.assistantMessages++
			if (consecutiveUserAssistant === 1) {
				stats.conversationExchanges++
			}
			consecutiveUserAssistant = 0
		}

		if ((message as ApiMessage).isSummary) {
			stats.summaryMessages++
		}

		if (Array.isArray(message.content)) {
			for (const block of message.content) {
				if (block.type === "tool_use") {
					stats.toolUseCount++
					const name = (block as Anthropic.Messages.ToolUseBlockParam).name
					stats.toolUseSummary[name] = (stats.toolUseSummary[name] || 0) + 1
				} else if (block.type === "tool_result") {
					stats.toolResultCount++
					if ((block as Anthropic.Messages.ToolResultBlockParam).is_error) {
						stats.errorCount++
					}
				}
			}
		}
	}

	return stats
}

/**
 * Extracts regular conversation exchanges (user-assistant pairs)
 * Excludes summary messages
 */
function extractConversationRequests(messages: ApiMessage[]): ConversationRequest[] {
	const requests: ConversationRequest[] = []
	let requestIndex = 0
	let cumulativeTokens = 0

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i]

		// Skip summary messages
		if (message.isSummary) {
			continue
		}

		// Look for user messages (these are the API requests)
		if (message.role === "user") {
			const content = Array.isArray(message.content)
				? message.content
				: [{ type: "text" as const, text: message.content }]

			// Check for pre-task and environment details
			let hadPreTask = false
			let hadEnvironmentDetails = false
			let wasStripped = false

			const userMessage: Anthropic.Messages.ContentBlockParam[] = content.map((block) => {
				if (block.type === "text") {
					const text = (block as Anthropic.Messages.TextBlockParam).text || ""
					if (text.includes("<pre-task>")) {
						hadPreTask = true
					}
					if (text.includes("<environment_details>")) {
						hadEnvironmentDetails = true
					}
					if (text.includes("[Tool executed successfully. Please continue with the next step.]")) {
						wasStripped = true
					}
				}
				return block
			})

			const userMessageTokens = estimateTokens(userMessage)
			cumulativeTokens += userMessageTokens

			// Find the corresponding assistant response
			let assistantResponse: Anthropic.Messages.ContentBlockParam[] | undefined
			let assistantResponseTokens = 0
			const toolsUsed: string[] = []

			// Look ahead for assistant response (skip summary messages)
			for (let j = i + 1; j < messages.length; j++) {
				const nextMsg = messages[j]
				if (nextMsg.isSummary) {
					continue // Skip summaries
				}
				if (nextMsg.role === "assistant") {
					const assistantContent = Array.isArray(nextMsg.content)
						? nextMsg.content
						: [{ type: "text" as const, text: nextMsg.content }]

					assistantResponse = assistantContent as Anthropic.Messages.ContentBlockParam[]
					assistantResponseTokens = estimateTokens(assistantResponse)
					cumulativeTokens += assistantResponseTokens

					// Extract tools used in the response (including interrupted ones)
					for (const block of assistantContent) {
						if (block.type === "tool_use") {
							const toolName = (block as Anthropic.Messages.ToolUseBlockParam).name
							toolsUsed.push(toolName)
						} else if (block.type === "text") {
							// Check for interrupted tool calls in text blocks
							const text = (block as Anthropic.Messages.TextBlockParam).text || ""

							// Pattern to match XML-style tool tags: <tool_name>...</tool_name> or <tool_name (interrupted)
							const toolTagPattern = /<(\w+)(?:\s|>)/g
							let match

							while ((match = toolTagPattern.exec(text)) !== null) {
								const potentialToolName = match[1]

								// Common tool names in your system
								const knownTools = [
									"write_to_file",
									"read_file",
									"apply_diff",
									"execute_command",
									"list_files",
									"search_files",
									"codebase_search",
									"update_todo_list",
									"fetch_instructions",
									"sf_deploy_metadata",
									"retrieve_sf_metadata",
									"ask_followup_question",
									"attempt_completion",
									"new_task",
									"switch_mode",
								]

								if (knownTools.includes(potentialToolName)) {
									// Check if tool was interrupted (incomplete closing tag or followed by "Response interrupted")
									const isInterrupted =
										text.includes("[Response interrupted") ||
										!text.includes(`</${potentialToolName}>`)

									if (isInterrupted && !toolsUsed.includes(`${potentialToolName} (interrupted)`)) {
										toolsUsed.push(`${potentialToolName} (interrupted)`)
									} else if (!isInterrupted && !toolsUsed.includes(potentialToolName)) {
										toolsUsed.push(potentialToolName)
									}
								}
							}
						}
					}
					break // Found the assistant response, stop looking
				} else if (nextMsg.role === "user") {
					break // Hit another user message, no assistant response found
				}
			}

			requests.push({
				requestIndex: requestIndex++,
				timestamp: (message as ApiMessage).ts || Date.now(),
				userMessage,
				assistantResponse,
				toolsUsed,
				hadPreTask,
				hadEnvironmentDetails,
				wasStripped,
				estimatedTokens: {
					userMessageTokens,
					assistantResponseTokens,
					cumulativeTokens,
				},
			})
		}
	}

	return requests
}

/**
 * Extracts summary/condensing requests from the conversation
 */
function extractSummaryRequests(messages: ApiMessage[]): SummaryRequest[] {
	const summaries: SummaryRequest[] = []
	let summaryIndex = 0

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i]

		// Identify summary messages
		if (message.isSummary || (message.role === "assistant" && Array.isArray(message.content))) {
			const content = Array.isArray(message.content) ? message.content : []
			const textBlock = content.find((b) => b.type === "text") as Anthropic.Messages.TextBlockParam | undefined

			if (textBlock?.text?.includes("[Context Summary]")) {
				const summaryContent = textBlock.text.replace("[Context Summary]", "").trim()

				// Note: We now condense ALL messages into a summary (no first/last kept)
				const totalMessagesCondensed = i > 0 ? messages.slice(0, i).filter((m) => !m.isSummary).length : 0

				summaries.push({
					summaryIndex: summaryIndex++,
					timestamp: (message as ApiMessage).ts || Date.now(),
					position: i,
					messagesCondensed: {
						firstMessagesKept: 0, // Changed: No longer keeping first messages
						middleMessagesCondensed: totalMessagesCondensed, // All messages are summarized
						lastMessagesKept: 0, // Changed: No longer keeping last messages
					},
					summaryContent,
					// Token estimation would require access to the original messages before condensing
					// This could be added if we store that information
				})
			}
		}
	}

	return summaries
}

/**
 * Calculates overall context usage for the conversation
 */
function calculateContextUsage(messages: ApiMessage[], contextWindow?: number): ContextUsageData {
	let estimatedTokens = 0

	for (const message of messages) {
		const content = Array.isArray(message.content)
			? message.content
			: [{ type: "text" as const, text: message.content }]
		estimatedTokens += estimateTokens(content)
	}

	const usage: ContextUsageData = {
		totalMessages: messages.length,
		estimatedCurrentTokens: estimatedTokens,
	}

	if (contextWindow) {
		usage.maxContextWindow = contextWindow
		usage.percentUsed = (estimatedTokens / contextWindow) * 100
	}

	return usage
}

/**
 * Exports the full task conversation history as a JSON file for debug/analysis.
 * Separates regular conversation from summary API calls and includes context usage data.
 */
export async function exportTaskDebugJson(
	apiConversationHistory: ApiMessage[],
	metadata: DebugExportMetadata,
): Promise<void> {
	const date = new Date(metadata.timestamp)
	const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase()
	const day = date.getDate()
	const year = date.getFullYear()
	let hours = date.getHours()
	const minutes = date.getMinutes().toString().padStart(2, "0")
	const seconds = date.getSeconds().toString().padStart(2, "0")
	const ampm = hours >= 12 ? "pm" : "am"
	hours = hours % 12
	hours = hours ? hours : 12

	const fileName = `siid_debug_${month}-${day}-${year}_${hours}-${minutes}-${seconds}-${ampm}.json`

	const statistics = computeStatistics(apiConversationHistory)
	const conversationRequests = extractConversationRequests(apiConversationHistory)
	const summaryRequests = extractSummaryRequests(apiConversationHistory)
	const contextUsage = calculateContextUsage(apiConversationHistory, metadata.contextWindow)

	const { systemPrompt, ...metadataWithoutPrompt } = metadata

	const exportData = {
		metadata: {
			...metadataWithoutPrompt,
			exportedAt: new Date().toISOString(),
			version: "2.0", // Version the export format for future compatibility
		},
		contextUsage: {
			...contextUsage,
			note: "Token estimates are approximate (1 token ≈ 4 characters). Actual counts may vary.",
		},
		statistics: {
			...statistics,
			summaryRequestCount: summaryRequests.length,
		},
		systemPrompt: systemPrompt || null,
		conversation: conversationRequests,
		summaryRequests: summaryRequests,
		rawApiConversationHistory: apiConversationHistory,
	}

	const saveUri = await vscode.window.showSaveDialog({
		filters: { JSON: ["json"] },
		defaultUri: vscode.Uri.file(path.join(os.homedir(), "Downloads", fileName)),
	})

	if (saveUri) {
		await vscode.workspace.fs.writeFile(saveUri, Buffer.from(JSON.stringify(exportData, null, 2)))
		vscode.window.showTextDocument(saveUri, { preview: true })
	}
}
