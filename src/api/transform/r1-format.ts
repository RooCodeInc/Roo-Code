import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { clearReasoningContentFromMessages } from "./clear-reasoning-content"

type ContentPartText = OpenAI.Chat.ChatCompletionContentPartText
type ContentPartImage = OpenAI.Chat.ChatCompletionContentPartImage
type UserMessage = OpenAI.Chat.ChatCompletionUserMessageParam
type AssistantMessage = OpenAI.Chat.ChatCompletionAssistantMessageParam
type Message = OpenAI.Chat.ChatCompletionMessageParam
type AnthropicMessage = Anthropic.Messages.MessageParam

/**
 * Converts Anthropic messages to OpenAI format while merging consecutive messages with the same role.
 * This is required for models using R1 format (e.g., interleaved thinking models) which do not support successive messages with the same role.
 *
 * According to API documentation for interleaved thinking:
 * - `reasoning_content` from previous turns should NOT be included when sending messages for new turns
 * - `reasoning_content` MUST be preserved during tool call sequences within the same turn
 * - `tool_calls` MUST be preserved from assistant messages (converted from `tool_use` blocks)
 * - `tool_result` blocks from user messages MUST be converted to `tool` role messages
 *
 * This function conditionally clears reasoning_content based on whether a new turn is starting or
 * a tool call sequence is continuing, preserves tool_calls by converting tool_use blocks, and
 * converts tool_result blocks to tool role messages.
 *
 * @param messages Array of Anthropic messages (may contain reasoning_content, tool_use, and tool_result blocks)
 * @param clearReasoningContent If true, clears reasoning_content from assistant messages (default: true for backward compatibility).
 *                              Set to false to preserve reasoning_content during tool call sequences.
 * @returns Array of OpenAI messages where consecutive messages with the same role are combined,
 *          reasoning_content is conditionally cleared, tool_calls are preserved, and tool_result blocks are converted to tool messages
 */
export function convertToR1Format(messages: AnthropicMessage[], clearReasoningContent: boolean = true): Message[] {
	// Conditionally clear reasoning_content from assistant messages before conversion
	// - If clearReasoningContent is true (new turn): clear reasoning_content
	// - If clearReasoningContent is false (tool call continuation): preserve reasoning_content
	const cleanedMessages = clearReasoningContent ? clearReasoningContentFromMessages(messages) : messages

	return cleanedMessages.reduce<Message[]>((merged, message) => {
		const lastMessage = merged[merged.length - 1]

		// Handle user messages with tool_result blocks - convert them to tool role messages
		if (message.role === "user" && Array.isArray(message.content)) {
			const { nonToolMessages, toolMessages } = message.content.reduce<{
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

			// Process tool result messages FIRST - they must follow tool_calls messages
			// Convert each tool_result to a separate tool role message
			toolMessages.forEach((toolMessage) => {
				let content: string
				if (typeof toolMessage.content === "string") {
					content = toolMessage.content
				} else {
					// Convert array of content blocks to string (similar to openai-format.ts)
					content =
						toolMessage.content
							?.map((part) => {
								if (part.type === "image") {
									return "(see following user message for image)"
								}
								return part.text
							})
							.join("\n") ?? ""
				}
				merged.push({
					role: "tool",
					tool_call_id: toolMessage.tool_use_id,
					content: content,
				})
			})

			// Process remaining non-tool content as user message (if any)
			if (nonToolMessages.length > 0) {
				let messageContent: string | (ContentPartText | ContentPartImage)[] = ""
				let hasImages = false

				nonToolMessages.forEach((part) => {
					if (part.type === "text") {
						// Will be handled below
					} else if (part.type === "image") {
						hasImages = true
					}
				})

				const textParts = nonToolMessages
					.filter((p) => p.type === "text")
					.map((p) => (p as Anthropic.TextBlockParam).text)
				const imageParts: ContentPartImage[] = nonToolMessages
					.filter((p) => p.type === "image")
					.map((part) => ({
						type: "image_url" as const,
						image_url: {
							url: `data:${(part as Anthropic.Messages.ImageBlockParam).source.media_type};base64,${
								(part as Anthropic.Messages.ImageBlockParam).source.data
							}`,
						},
					}))

				if (hasImages) {
					const parts: (ContentPartText | ContentPartImage)[] = []
					if (textParts.length > 0) {
						parts.push({ type: "text", text: textParts.join("\n") })
					}
					parts.push(...imageParts)
					messageContent = parts
				} else {
					messageContent = textParts.join("\n")
				}

				// Merge with last message if it's also a user message
				if (lastMessage?.role === "user") {
					if (typeof lastMessage.content === "string" && typeof messageContent === "string") {
						lastMessage.content += `\n${messageContent}`
					} else {
						const lastContent = Array.isArray(lastMessage.content)
							? lastMessage.content
							: [{ type: "text" as const, text: lastMessage.content || "" }]

						const newContent = Array.isArray(messageContent)
							? messageContent
							: [{ type: "text" as const, text: messageContent }]

						lastMessage.content = [...lastContent, ...newContent] as UserMessage["content"]
					}
				} else {
					// Add as new user message
					merged.push({
						role: "user",
						content: messageContent as UserMessage["content"],
					})
				}
			}
			// If no non-tool content, we've already added tool messages, so we're done
			return merged
		}

		// Handle assistant messages
		let messageContent: string | (ContentPartText | ContentPartImage)[] = ""
		let hasImages = false
		let toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] | undefined = undefined

		// Extract reasoning_content if present (for assistant messages during tool call sequences)
		const messageWithReasoning = message as any
		const reasoningContent =
			message.role === "assistant" && "reasoning_content" in messageWithReasoning
				? messageWithReasoning.reasoning_content
				: undefined

		// Convert content to appropriate format
		if (Array.isArray(message.content)) {
			const textParts: string[] = []
			const imageParts: ContentPartImage[] = []
			const toolUseBlocks: Anthropic.Messages.ToolUseBlockParam[] = []

			message.content.forEach((part) => {
				if (part.type === "text") {
					textParts.push(part.text)
				} else if (part.type === "image") {
					hasImages = true
					imageParts.push({
						type: "image_url",
						image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
					})
				} else if (part.type === "tool_use") {
					// Extract tool_use blocks for assistant messages
					toolUseBlocks.push(part)
				}
			})

			// Convert tool_use blocks to OpenAI tool_calls format (for assistant messages)
			if (message.role === "assistant" && toolUseBlocks.length > 0) {
				toolCalls = toolUseBlocks.map((toolUse) => ({
					id: toolUse.id,
					type: "function" as const,
					function: {
						name: toolUse.name,
						arguments: JSON.stringify(toolUse.input),
					},
				}))
			}

			if (hasImages) {
				const parts: (ContentPartText | ContentPartImage)[] = []
				if (textParts.length > 0) {
					parts.push({ type: "text", text: textParts.join("\n") })
				}
				parts.push(...imageParts)
				messageContent = parts
			} else {
				messageContent = textParts.join("\n")
			}
		} else {
			messageContent = message.content
		}

		// If last message has same role, merge the content
		if (lastMessage?.role === message.role) {
			if (typeof lastMessage.content === "string" && typeof messageContent === "string") {
				lastMessage.content += `\n${messageContent}`
			}
			// If either has image content, convert both to array format
			else {
				const lastContent = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text" as const, text: lastMessage.content || "" }]

				const newContent = Array.isArray(messageContent)
					? messageContent
					: [{ type: "text" as const, text: messageContent }]

				if (message.role === "assistant") {
					const mergedContent = [...lastContent, ...newContent] as AssistantMessage["content"]
					lastMessage.content = mergedContent
					// Preserve reasoning_content if present (for tool call sequences)
					// Note: When merging, we keep the reasoning_content from the last message
					// This is correct because in tool call sequences, we want the most recent reasoning
					if (reasoningContent !== undefined) {
						;(lastMessage as any).reasoning_content = reasoningContent
					}
					// Preserve tool_calls if present (merge with existing tool_calls if any)
					if (toolCalls && toolCalls.length > 0) {
						const existingToolCalls = (lastMessage as any).tool_calls || []
						;(lastMessage as any).tool_calls = [...existingToolCalls, ...toolCalls]
					}
				} else {
					const mergedContent = [...lastContent, ...newContent] as UserMessage["content"]
					lastMessage.content = mergedContent
				}
			}
		} else {
			// Add as new message with the correct type based on role
			if (message.role === "assistant") {
				const newMessage: AssistantMessage = {
					role: "assistant",
					content: messageContent as AssistantMessage["content"],
				}
				// Preserve reasoning_content if present (for tool call sequences)
				if (reasoningContent !== undefined) {
					;(newMessage as any).reasoning_content = reasoningContent
				}
				// Preserve tool_calls if present
				if (toolCalls && toolCalls.length > 0) {
					;(newMessage as any).tool_calls = toolCalls
				}
				merged.push(newMessage)
			} else {
				const newMessage: UserMessage = {
					role: "user",
					content: messageContent as UserMessage["content"],
				}
				merged.push(newMessage)
			}
		}

		return merged
	}, [])
}
