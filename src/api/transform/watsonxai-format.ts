import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

/**
 * Converts Anthropic message format to IBM watsonx.ai message format
 *
 * IBM watsonx.ai supports four message types:
 * - TextChatMessageUser: Messages from the user
 * - TextChatMessageAssistant: Messages from the assistant
 * - TextChatMessageSystem: System instructions
 * - TextChatMessageTool: Tool responses
 *
 * @param anthropicMessages - Messages in Anthropic format
 * @returns Messages in IBM watsonx.ai format
 */
export function convertToWatsonxAiMessages(
	anthropicMessages: Anthropic.Messages.MessageParam[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
	const watsonxAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []

	for (const anthropicMessage of anthropicMessages) {
		if (
			!anthropicMessage.content ||
			(Array.isArray(anthropicMessage.content) && anthropicMessage.content.length === 0)
		) {
			continue
		}

		switch (anthropicMessage.role) {
			case "user":
				// TextChatMessageUser
				if (typeof anthropicMessage.content === "string") {
					watsonxAiMessages.push({
						role: "user",
						content: anthropicMessage.content,
					})
				} else {
					processUserMessage(anthropicMessage, watsonxAiMessages)
				}
				break

			case "assistant":
				// TextChatMessageAssistant
				if (typeof anthropicMessage.content === "string") {
					watsonxAiMessages.push({
						role: "assistant",
						content: anthropicMessage.content,
					})
				} else {
					processAssistantMessage(anthropicMessage, watsonxAiMessages)
				}
				break

			case "system" as any:
				// TextChatMessageSystem
				if (typeof anthropicMessage.content === "string") {
					watsonxAiMessages.push({
						role: "system",
						content: anthropicMessage.content,
					})
				} else {
					const textContent = anthropicMessage.content
						.filter((block) => block.type === "text")
						.map((block) => (block as any).text)
						.join("\n")

					if (textContent) {
						watsonxAiMessages.push({
							role: "system",
							content: textContent,
						})
					}
				}
				break

			default:
				if (anthropicMessage.role === "tool") {
					// TextChatMessageTool
					const toolMessage = anthropicMessage as any
					const toolCallId = toolMessage.tool_call_id

					if (typeof toolCallId === "string") {
						const content =
							typeof anthropicMessage.content === "string"
								? anthropicMessage.content
								: anthropicMessage.content
										.filter((block) => block.type === "text")
										.map((block) => (block as any).text)
										.join("\n")

						watsonxAiMessages.push({
							role: "tool",
							tool_call_id: toolCallId,
							content: content,
						})
					}
				} else if (typeof anthropicMessage.content === "string") {
					watsonxAiMessages.push({
						role: anthropicMessage.role,
						content: anthropicMessage.content,
					})
				}
				break
		}
	}

	return watsonxAiMessages
}

function processUserMessage(
	anthropicMessage: Anthropic.Messages.MessageParam,
	watsonxAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
) {
	const { contentBlocks, toolResultBlocks } = categorizeUserContent(anthropicMessage.content as any[])
	processToolResultBlocks(toolResultBlocks, watsonxAiMessages)

	if (contentBlocks.length > 0) {
		const textBlocks = contentBlocks.filter((part) => part.type === "text")

		if (textBlocks.length === 1 && contentBlocks.length === 1) {
			watsonxAiMessages.push({
				role: "user",
				content: textBlocks[0].text,
			})
		} else {
			watsonxAiMessages.push({
				role: "user",
				content: contentBlocks.map((part) => {
					if (part.type === "image") {
						return {
							type: "image_url",
							image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
						}
					}
					return { type: "text", text: part.text }
				}),
			})
		}
	}
}

function processAssistantMessage(
	anthropicMessage: Anthropic.Messages.MessageParam,
	watsonxAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
) {
	const { contentBlocks, toolUseBlocks } = categorizeAssistantContent(anthropicMessage.content as any[])

	let content: string | undefined
	if (contentBlocks.length > 0) {
		content = contentBlocks.map((part) => (part.type === "text" ? part.text : "")).join("\n")
	}

	const toolCalls = convertToolUseBlocksToToolCalls(toolUseBlocks)

	if (content || toolCalls.length > 0) {
		watsonxAiMessages.push({
			role: "assistant",
			content: content || "",
			tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
		})
	}
}

function categorizeUserContent(content: any[]) {
	return content.reduce<{
		contentBlocks: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
		toolResultBlocks: Anthropic.ToolResultBlockParam[]
	}>(
		(acc, part) => {
			if (part.type === "tool_result") {
				acc.toolResultBlocks.push(part)
			} else if (part.type === "text" || part.type === "image") {
				acc.contentBlocks.push(part)
			}
			return acc
		},
		{ contentBlocks: [], toolResultBlocks: [] },
	)
}

function categorizeAssistantContent(content: any[]) {
	return content.reduce<{
		contentBlocks: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
		toolUseBlocks: Anthropic.ToolUseBlockParam[]
	}>(
		(acc, part) => {
			if (part.type === "tool_use") {
				acc.toolUseBlocks.push(part)
			} else if (part.type === "text" || part.type === "image") {
				acc.contentBlocks.push(part)
			}
			return acc
		},
		{ contentBlocks: [], toolUseBlocks: [] },
	)
}

/**
 * Process tool result blocks into IBM watsonx.ai TextChatMessageTool format
 *
 * @param toolResultBlocks - Tool result blocks from Anthropic
 * @param watsonxAiMessages - Array to add the formatted messages to
 */
function processToolResultBlocks(
	toolResultBlocks: Anthropic.ToolResultBlockParam[],
	watsonxAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
) {
	toolResultBlocks.forEach((toolResult) => {
		if (!toolResult.tool_use_id) {
			return
		}

		let content: string
		if (typeof toolResult.content === "string") {
			content = toolResult.content
		} else {
			content =
				toolResult.content
					?.map((part) => {
						if (part.type === "image") {
							return "(see following user message for image)"
						}
						return part.text
					})
					.join("\n") ?? ""
		}

		if (content.trim()) {
			watsonxAiMessages.push({
				role: "tool",
				tool_call_id: toolResult.tool_use_id,
				content: content,
			})
		}
	})
}

function convertToolUseBlocksToToolCalls(
	toolUseBlocks: Anthropic.ToolUseBlockParam[],
): OpenAI.Chat.ChatCompletionMessageToolCall[] {
	return toolUseBlocks.map((toolUse) => ({
		id: toolUse.id,
		type: "function",
		function: {
			name: toolUse.name,
			arguments: JSON.stringify(toolUse.input),
		},
	}))
}
