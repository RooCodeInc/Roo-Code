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
 *
 * This function conditionally clears reasoning_content based on whether a new turn is starting or
 * a tool call sequence is continuing.
 *
 * @param messages Array of Anthropic messages (may contain reasoning_content from previous turns)
 * @param clearReasoningContent If true, clears reasoning_content from assistant messages (default: true for backward compatibility).
 *                              Set to false to preserve reasoning_content during tool call sequences.
 * @returns Array of OpenAI messages where consecutive messages with the same role are combined,
 *          and reasoning_content is conditionally cleared based on clearReasoningContent parameter
 */
export function convertToR1Format(messages: AnthropicMessage[], clearReasoningContent: boolean = true): Message[] {
	// Conditionally clear reasoning_content from assistant messages before conversion
	// - If clearReasoningContent is true (new turn): clear reasoning_content
	// - If clearReasoningContent is false (tool call continuation): preserve reasoning_content
	const cleanedMessages = clearReasoningContent ? clearReasoningContentFromMessages(messages) : messages

	return cleanedMessages.reduce<Message[]>((merged, message) => {
		const lastMessage = merged[merged.length - 1]
		let messageContent: string | (ContentPartText | ContentPartImage)[] = ""
		let hasImages = false

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

			message.content.forEach((part) => {
				if (part.type === "text") {
					textParts.push(part.text)
				}
				if (part.type === "image") {
					hasImages = true
					imageParts.push({
						type: "image_url",
						image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
					})
				}
			})

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
