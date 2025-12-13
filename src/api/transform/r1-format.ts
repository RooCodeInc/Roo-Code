import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

type ContentPartText = OpenAI.Chat.ChatCompletionContentPartText
type ContentPartImage = OpenAI.Chat.ChatCompletionContentPartImage
type UserMessage = OpenAI.Chat.ChatCompletionUserMessageParam
type AssistantMessage = OpenAI.Chat.ChatCompletionAssistantMessageParam
type ToolMessage = OpenAI.Chat.ChatCompletionToolMessageParam
type Message = OpenAI.Chat.ChatCompletionMessageParam
type AnthropicMessage = Anthropic.Messages.MessageParam

/**
 * Converts Anthropic messages to OpenAI format while merging consecutive messages with the same role.
 * This is required for DeepSeek Reasoner which does not support successive messages with the same role.
 *
 * Also handles tool_use and tool_result blocks:
 * - tool_use blocks in assistant messages are converted to tool_calls
 * - tool_result blocks in user messages are converted to tool role messages
 *
 * @param messages Array of Anthropic messages
 * @returns Array of OpenAI messages where consecutive messages with the same role are combined
 */
export function convertToR1Format(messages: AnthropicMessage[]): Message[] {
	const result: Message[] = []

	for (const message of messages) {
		if (typeof message.content === "string") {
			// Simple string content - can be merged with previous same-role message
			appendOrMergeMessage(result, message.role, message.content)
		} else {
			// Array content - need to process each block
			if (message.role === "user") {
				processUserMessage(result, message.content)
			} else if (message.role === "assistant") {
				processAssistantMessage(result, message.content)
			}
		}
	}

	return result
}

/**
 * Process user message content blocks, handling tool_result blocks separately
 */
function processUserMessage(result: Message[], content: Anthropic.Messages.ContentBlockParam[]): void {
	const textParts: string[] = []
	const imageParts: ContentPartImage[] = []
	const toolResults: Anthropic.ToolResultBlockParam[] = []
	let hasImages = false

	// Separate tool results from other content
	for (const part of content) {
		if (part.type === "text") {
			textParts.push(part.text)
		} else if (part.type === "image") {
			hasImages = true
			imageParts.push({
				type: "image_url",
				image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
			})
		} else if (part.type === "tool_result") {
			toolResults.push(part)
		}
	}

	// First, add tool result messages (they must come right after assistant tool_calls)
	for (const toolResult of toolResults) {
		const toolContent = extractToolResultContent(toolResult)
		const toolMessage: ToolMessage = {
			role: "tool",
			tool_call_id: toolResult.tool_use_id,
			content: toolContent,
		}
		result.push(toolMessage)
	}

	// Then add non-tool content as user message
	if (textParts.length > 0 || imageParts.length > 0) {
		let messageContent: string | (ContentPartText | ContentPartImage)[]

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

		appendOrMergeMessage(result, "user", messageContent)
	}
}

/**
 * Process assistant message content blocks, handling tool_use blocks
 */
function processAssistantMessage(result: Message[], content: Anthropic.Messages.ContentBlockParam[]): void {
	const textParts: string[] = []
	const toolUses: Anthropic.ToolUseBlockParam[] = []

	// Separate tool uses from text content
	for (const part of content) {
		if (part.type === "text") {
			textParts.push(part.text)
		} else if (part.type === "tool_use") {
			toolUses.push(part)
		}
		// Images from assistant are ignored (not possible in practice)
	}

	const textContent = textParts.length > 0 ? textParts.join("\n") : undefined

	if (toolUses.length > 0) {
		// If there are tool uses, create a new assistant message with tool_calls
		// Tool calls cannot be merged with previous messages
		const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = toolUses.map((toolUse) => ({
			id: toolUse.id,
			type: "function" as const,
			function: {
				name: toolUse.name,
				arguments: JSON.stringify(toolUse.input),
			},
		}))

		const assistantMessage: AssistantMessage = {
			role: "assistant",
			content: textContent ?? null,
			tool_calls: toolCalls,
		}
		result.push(assistantMessage)
	} else if (textContent) {
		// No tool uses - can merge with previous assistant message
		appendOrMergeMessage(result, "assistant", textContent)
	}
}

/**
 * Extract content string from a tool result block
 */
function extractToolResultContent(toolResult: Anthropic.ToolResultBlockParam): string {
	if (typeof toolResult.content === "string") {
		return toolResult.content
	}

	if (Array.isArray(toolResult.content)) {
		return toolResult.content
			.map((part) => {
				if (part.type === "text") {
					return part.text
				}
				if (part.type === "image") {
					return "(image content)"
				}
				return ""
			})
			.filter(Boolean)
			.join("\n")
	}

	return ""
}

/**
 * Append a message to the result array, merging with the previous message if it has the same role
 * and neither is a tool message
 */
function appendOrMergeMessage(
	result: Message[],
	role: "user" | "assistant",
	content: string | (ContentPartText | ContentPartImage)[],
): void {
	const lastMessage = result[result.length - 1]

	// Can only merge if:
	// 1. Last message exists and has the same role
	// 2. Last message is not a tool message
	// 3. Last message doesn't have tool_calls (for assistant messages)
	if (
		lastMessage &&
		lastMessage.role === role &&
		!("tool_call_id" in lastMessage) &&
		!("tool_calls" in lastMessage && lastMessage.tool_calls)
	) {
		// Merge content
		if (typeof lastMessage.content === "string" && typeof content === "string") {
			lastMessage.content += `\n${content}`
		} else {
			// Convert both to array format and merge
			const lastContent = Array.isArray(lastMessage.content)
				? lastMessage.content
				: [{ type: "text" as const, text: lastMessage.content || "" }]

			const newContent = Array.isArray(content) ? content : [{ type: "text" as const, text: content }]

			if (role === "assistant") {
				const mergedContent = [...lastContent, ...newContent] as AssistantMessage["content"]
				lastMessage.content = mergedContent
			} else {
				const mergedContent = [...lastContent, ...newContent] as UserMessage["content"]
				lastMessage.content = mergedContent
			}
		}
	} else {
		// Add as new message
		if (role === "assistant") {
			const newMessage: AssistantMessage = {
				role: "assistant",
				content: content as AssistantMessage["content"],
			}
			result.push(newMessage)
		} else {
			const newMessage: UserMessage = {
				role: "user",
				content: content as UserMessage["content"],
			}
			result.push(newMessage)
		}
	}
}
