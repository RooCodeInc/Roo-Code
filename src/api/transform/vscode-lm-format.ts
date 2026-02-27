import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"

/**
 * Safely converts a value into a plain object.
 */
function asObjectSafe(value: any): object {
	// Handle null/undefined
	if (!value) {
		return {}
	}

	try {
		// Handle strings that might be JSON
		if (typeof value === "string") {
			return JSON.parse(value)
		}

		// Handle pre-existing objects
		if (typeof value === "object") {
			return { ...value }
		}

		return {}
	} catch (error) {
		console.warn("Roo Code <Language Model API>: Failed to parse object:", error)
		return {}
	}
}

export function convertToVsCodeLmMessages(
	anthropicMessages: Anthropic.Messages.MessageParam[],
): vscode.LanguageModelChatMessage[] {
	const vsCodeLmMessages: vscode.LanguageModelChatMessage[] = []

	for (const anthropicMessage of anthropicMessages) {
		// Handle simple string messages
		if (typeof anthropicMessage.content === "string") {
			vsCodeLmMessages.push(
				anthropicMessage.role === "assistant"
					? vscode.LanguageModelChatMessage.Assistant(anthropicMessage.content)
					: vscode.LanguageModelChatMessage.User(anthropicMessage.content),
			)
			continue
		}

		// Handle complex message structures
		switch (anthropicMessage.role) {
			case "user": {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolResultBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_result") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						}
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				// Process tool messages first then non-tool messages
				const contentParts = [
					// Convert tool messages to ToolResultParts
					...toolMessages.map((toolMessage) => {
						// Process tool result content into TextParts
						const toolContentParts: vscode.LanguageModelTextPart[] =
							typeof toolMessage.content === "string"
								? [new vscode.LanguageModelTextPart(toolMessage.content)]
								: (toolMessage.content?.map((part) => {
										if (part.type === "image") {
											return new vscode.LanguageModelTextPart(
												`[Image (${part.source?.type || "Unknown source-type"}): ${part.source?.media_type || "unknown media-type"} not supported by VSCode LM API]`,
											)
										}
										return new vscode.LanguageModelTextPart(part.text)
									}) ?? [new vscode.LanguageModelTextPart("")])

						return new vscode.LanguageModelToolResultPart(toolMessage.tool_use_id, toolContentParts)
					}),

					// Convert non-tool messages to TextParts after tool messages
					...nonToolMessages.map((part) => {
						if (part.type === "image") {
							return new vscode.LanguageModelTextPart(
								`[Image (${part.source?.type || "Unknown source-type"}): ${part.source?.media_type || "unknown media-type"} not supported by VSCode LM API]`,
							)
						}
						return new vscode.LanguageModelTextPart(part.text)
					}),
				]

				// Add single user message with all content parts
				vsCodeLmMessages.push(vscode.LanguageModelChatMessage.User(contentParts))
				break
			}

			case "assistant": {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolUseBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_use") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						}
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				// Process non-tool messages first, then tool messages
				// Tool calls must come at the end so they are properly followed by user message with tool results
				const contentParts = [
					// Convert non-tool messages to TextParts first
					...nonToolMessages.map((part) => {
						if (part.type === "image") {
							return new vscode.LanguageModelTextPart("[Image generation not supported by VSCode LM API]")
						}
						return new vscode.LanguageModelTextPart(part.text)
					}),

					// Convert tool messages to ToolCallParts after text
					...toolMessages.map(
						(toolMessage) =>
							new vscode.LanguageModelToolCallPart(
								toolMessage.id,
								toolMessage.name,
								asObjectSafe(toolMessage.input),
							),
					),
				]

				// Add the assistant message to the list of messages
				vsCodeLmMessages.push(vscode.LanguageModelChatMessage.Assistant(contentParts))
				break
			}
		}
	}

	return vsCodeLmMessages
}

export function convertToAnthropicRole(vsCodeLmMessageRole: vscode.LanguageModelChatMessageRole): string | null {
	switch (vsCodeLmMessageRole) {
		case vscode.LanguageModelChatMessageRole.Assistant:
			return "assistant"
		case vscode.LanguageModelChatMessageRole.User:
			return "user"
		default:
			return null
	}
}

/**
 * Extracts the text content from a VS Code Language Model chat message.
 * @param message A VS Code Language Model chat message.
 * @returns The extracted text content.
 */
export function extractTextCountFromMessage(message: vscode.LanguageModelChatMessage): string {
	let text = ""
	if (Array.isArray(message.content)) {
		for (const item of message.content) {
			if (item instanceof vscode.LanguageModelTextPart) {
				text += item.value
			}
			if (item instanceof vscode.LanguageModelToolResultPart) {
				text += item.callId
				for (const part of item.content) {
					if (part instanceof vscode.LanguageModelTextPart) {
						text += part.value
					}
				}
			}
			if (item instanceof vscode.LanguageModelToolCallPart) {
				text += item.name
				text += item.callId
				if (item.input && Object.keys(item.input).length > 0) {
					try {
						text += JSON.stringify(item.input)
					} catch (error) {
						console.error("Roo Code <Language Model API>: Failed to stringify tool call input:", error)
					}
				}
			}
		}
	} else if (typeof message.content === "string") {
		text += message.content
	}
	return text
}

/**
 * Helper function to extract tool call IDs from a message's content.
 * Returns an array of call IDs from LanguageModelToolCallPart instances.
 */
function getToolCallIds(message: vscode.LanguageModelChatMessage): string[] {
	const callIds: string[] = []
	if (Array.isArray(message.content)) {
		for (const part of message.content) {
			if (part instanceof vscode.LanguageModelToolCallPart) {
				callIds.push(part.callId)
			}
		}
	}
	return callIds
}

/**
 * Helper function to extract tool result IDs from a message's content.
 * Returns an array of call IDs from LanguageModelToolResultPart instances.
 */
function getToolResultIds(message: vscode.LanguageModelChatMessage): string[] {
	const callIds: string[] = []
	if (Array.isArray(message.content)) {
		for (const part of message.content) {
			if (part instanceof vscode.LanguageModelToolResultPart) {
				callIds.push(part.callId)
			}
		}
	}
	return callIds
}

/**
 * Validates and repairs the tool call/result sequence in VSCode LM messages.
 *
 * The VSCode Language Model API requires that:
 * - When an Assistant message contains LanguageModelToolCallPart(s)
 * - The immediately next message MUST be a User message with LanguageModelToolResultPart(s)
 *   with matching callIds
 *
 * This function:
 * 1. Identifies assistant messages with tool calls
 * 2. Checks that the next message is a user message with matching tool results
 * 3. If mismatches are found:
 *    - Missing tool results: Adds placeholder ToolResultParts to the user message
 *    - Orphaned tool results (no preceding tool call): Removes them
 *    - No following user message: Creates one with the necessary tool results
 *
 * @param messages - Array of VSCode LanguageModelChatMessage to validate and repair
 * @returns The validated and repaired array of messages
 */
export function validateAndRepairToolSequence(
	messages: vscode.LanguageModelChatMessage[],
): vscode.LanguageModelChatMessage[] {
	if (!messages || messages.length === 0) {
		return messages
	}

	const repairedMessages: vscode.LanguageModelChatMessage[] = []

	for (let i = 0; i < messages.length; i++) {
		const currentMessage = messages[i]
		const isAssistant = currentMessage.role === vscode.LanguageModelChatMessageRole.Assistant
		const toolCallIds = getToolCallIds(currentMessage)

		// If this is an assistant message with tool calls
		if (isAssistant && toolCallIds.length > 0) {
			repairedMessages.push(currentMessage)

			const nextMessage = messages[i + 1]
			const isNextUser = nextMessage?.role === vscode.LanguageModelChatMessageRole.User

			if (isNextUser) {
				// Check if the next user message has matching tool results
				const toolResultIds = getToolResultIds(nextMessage)
				const missingResultIds = toolCallIds.filter((id) => !toolResultIds.includes(id))

				if (missingResultIds.length > 0) {
					// Need to add placeholder tool results for missing IDs
					// Filter existing content to only include valid user message parts (TextPart and ToolResultPart)
					const existingContent: (vscode.LanguageModelTextPart | vscode.LanguageModelToolResultPart)[] = []
					if (Array.isArray(nextMessage.content)) {
						for (const part of nextMessage.content) {
							if (
								part instanceof vscode.LanguageModelTextPart ||
								part instanceof vscode.LanguageModelToolResultPart
							) {
								existingContent.push(part)
							}
						}
					}

					// Add placeholder results at the beginning (tool results come first)
					const placeholderResults = missingResultIds.map(
						(callId) =>
							new vscode.LanguageModelToolResultPart(callId, [
								new vscode.LanguageModelTextPart("[Tool result not available]"),
							]),
					)

					// Create new user message with placeholders prepended
					const repairedUserMessage = vscode.LanguageModelChatMessage.User([
						...placeholderResults,
						...existingContent,
					])
					repairedMessages.push(repairedUserMessage)
					i++ // Skip the next message since we've processed it

					console.warn(
						`Roo Code <Language Model API>: Added ${missingResultIds.length} placeholder tool result(s) for missing call IDs: ${missingResultIds.join(", ")}`,
					)
				} else {
					// All tool results are present, keep the message as-is
					repairedMessages.push(nextMessage)
					i++ // Skip the next message since we've processed it
				}
			} else {
				// No user message follows - create one with placeholder tool results
				const placeholderResults = toolCallIds.map(
					(callId) =>
						new vscode.LanguageModelToolResultPart(callId, [
							new vscode.LanguageModelTextPart("[Tool result not available]"),
						]),
				)
				const newUserMessage = vscode.LanguageModelChatMessage.User(placeholderResults)
				repairedMessages.push(newUserMessage)

				console.warn(
					`Roo Code <Language Model API>: Created user message with ${toolCallIds.length} placeholder tool result(s) for call IDs: ${toolCallIds.join(", ")}`,
				)
			}
		} else {
			// For non-tool-call messages, just add them directly
			repairedMessages.push(currentMessage)
		}
	}

	return repairedMessages
}
