import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import type { ProviderMessageMetadata } from "../../shared/api"

export function convertToOpenAiMessages(
	anthropicMessages: Anthropic.Messages.MessageParam[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
	const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []

	for (const anthropicMessage of anthropicMessages) {
		if (typeof anthropicMessage.content === "string") {
			openAiMessages.push({ role: anthropicMessage.role, content: anthropicMessage.content })
		} else {
			// image_url.url is base64 encoded image data
			// ensure it contains the content-type of the image: data:image/png;base64,
			/*
        { role: "user", content: "" | { type: "text", text: string } | { type: "image_url", image_url: { url: string } } },
         // content required unless tool_calls is present
        { role: "assistant", content?: "" | null, tool_calls?: [{ id: "", function: { name: "", arguments: "" }, type: "function" }] },
        { role: "tool", tool_call_id: "", content: ""}
         */
			if (anthropicMessage.role === "user") {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolResultBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_result") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						} // user cannot send tool_use messages
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				// Process tool result messages FIRST since they must follow the tool use messages
				let toolResultImages: Anthropic.Messages.ImageBlockParam[] = []
				toolMessages.forEach((toolMessage) => {
					// The Anthropic SDK allows tool results to be a string or an array of text and image blocks, enabling rich and structured content. In contrast, the OpenAI SDK only supports tool results as a single string, so we map the Anthropic tool result parts into one concatenated string to maintain compatibility.
					let content: string

					if (typeof toolMessage.content === "string") {
						content = toolMessage.content
					} else {
						content =
							toolMessage.content
								?.map((part) => {
									if (part.type === "image") {
										toolResultImages.push(part)
										return "(see following user message for image)"
									}
									return part.text
								})
								.join("\n") ?? ""
					}
					openAiMessages.push({
						role: "tool",
						tool_call_id: toolMessage.tool_use_id,
						content: content,
					})
				})

				// If tool results contain images, send as a separate user message
				// I ran into an issue where if I gave feedback for one of many tool uses, the request would fail.
				// "Messages following `tool_use` blocks must begin with a matching number of `tool_result` blocks."
				// Therefore we need to send these images after the tool result messages
				// NOTE: it's actually okay to have multiple user messages in a row, the model will treat them as a continuation of the same input (this way works better than combining them into one message, since the tool result specifically mentions (see following user message for image)
				// UPDATE v2.0: we don't use tools anymore, but if we did it's important to note that the openrouter prompt caching mechanism requires one user message at a time, so we would need to add these images to the user content array instead.
				// if (toolResultImages.length > 0) {
				// 	openAiMessages.push({
				// 		role: "user",
				// 		content: toolResultImages.map((part) => ({
				// 			type: "image_url",
				// 			image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
				// 		})),
				// 	})
				// }

				// Process non-tool messages
				if (nonToolMessages.length > 0) {
					openAiMessages.push({
						role: "user",
						content: nonToolMessages.map((part) => {
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
			} else if (anthropicMessage.role === "assistant") {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolUseBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_use") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						} // assistant cannot send tool_result messages
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				// Process non-tool messages
				let content: string | undefined
				const reasoningDetails: ReasoningDetail[] = []
				if (nonToolMessages.length > 0) {
					nonToolMessages.forEach((part) => {
						// Check for legacy reasoning_details on text block
						if (part.type === "text" && "reasoning_details" in part) {
							const details = (part as any).reasoning_details
							if (Array.isArray(details)) {
								reasoningDetails.push(...details)
							} else {
								reasoningDetails.push(details)
							}
						}
						// Check for new providerMetadata on text block
						else if (part.type === "text" && (part as any).providerMetadata) {
							const metadata = (part as any).providerMetadata as ProviderMessageMetadata
							if (metadata?.openRouterReasoningDetails) {
								reasoningDetails.push(...metadata.openRouterReasoningDetails)
							}
						}
					})
					content = nonToolMessages
						.map((part) => {
							if (part.type === "image") {
								return "" // impossible as the assistant cannot send images
							}
							return part.text
						})
						.join("\n")
				}

				// Process tool use messages
				let tool_calls: OpenAI.Chat.ChatCompletionMessageToolCall[] = toolMessages.map((toolMessage) => ({
					id: toolMessage.id,
					type: "function",
					function: {
						name: toolMessage.name,
						// json string
						arguments: JSON.stringify(toolMessage.input),
					},
				}))

				const consolidatedReasoning =
					reasoningDetails.length > 0 ? consolidateReasoningDetails(reasoningDetails) : undefined

				const assistantMessage: OpenAI.Chat.ChatCompletionAssistantMessageParam & {
					reasoning_details?: ReasoningDetail[]
				} = {
					role: "assistant",
					content,
					// Cannot be an empty array. API expects an array with minimum length 1, and will respond with an error if it's empty
					tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
				}

				if (consolidatedReasoning && consolidatedReasoning.length > 0) {
					assistantMessage.reasoning_details = consolidatedReasoning
				}

				openAiMessages.push(assistantMessage)
			}
		}
	}

	return openAiMessages
}

// Type for OpenRouter's reasoning detail elements
// https://openrouter.ai/docs/use-cases/reasoning-tokens#streaming-response
type ReasoningDetail = {
	// https://openrouter.ai/docs/use-cases/reasoning-tokens#reasoning-detail-types
	type: string // "reasoning.summary" | "reasoning.encrypted" | "reasoning.text"
	text?: string
	summary?: string
	data?: string // Encrypted reasoning data
	signature?: string | null
	id?: string | null // Unique identifier for the reasoning detail
	/*
	 The format of the reasoning detail, with possible values:
	 	"unknown" - Format is not specified
		"openai-responses-v1" - OpenAI responses format version 1
		"anthropic-claude-v1" - Anthropic Claude format version 1 (default)
	 */
	format: string //"unknown" | "openai-responses-v1" | "anthropic-claude-v1" | "xai-responses-v1"
	index?: number // Sequential index of the reasoning detail
}

// Helper function to convert reasoning_details array to the format OpenRouter API expects
// Takes an array of reasoning detail objects and consolidates them by index
function consolidateReasoningDetails(reasoningDetails: ReasoningDetail[]): ReasoningDetail[] {
	if (!reasoningDetails || reasoningDetails.length === 0) {
		return []
	}

	// Group by index
	const groupedByIndex = new Map<number, ReasoningDetail[]>()

	for (const detail of reasoningDetails) {
		const index = detail.index ?? 0
		if (!groupedByIndex.has(index)) {
			groupedByIndex.set(index, [])
		}
		groupedByIndex.get(index)!.push(detail)
	}

	// Consolidate each group
	const consolidated: ReasoningDetail[] = []
	let outputIndex = 0

	for (const [_, details] of groupedByIndex.entries()) {
		// Concatenate all text parts
		let concatenatedText = ""
		let hasText = false
		let summary: string | undefined
		let signature: string | undefined
		let id: string | undefined
		let format = "unknown"
		let type = "reasoning.text"

		for (const detail of details) {
			if (detail.text !== undefined) {
				concatenatedText += detail.text
				hasText = true
			}
			if (detail.summary !== undefined) {
				summary = detail.summary
			}
			// Keep the signature from the last item that has one
			if (detail.signature) {
				signature = detail.signature
			}
			// Keep the id from the last item that has one
			if (detail.id) {
				id = detail.id
			}
			// Keep format and type from any item (they should all be the same)
			if (detail.format) {
				format = detail.format
			}
			if (detail.type) {
				type = detail.type
			}
		}

		// Create consolidated entry for text if any text parts were found
		// This avoids creating text entries for purely encrypted blocks or metadata-only updates that belong to encrypted blocks
		if (hasText || summary !== undefined) {
			const consolidatedEntry: ReasoningDetail = {
				type: type,
				text: hasText ? concatenatedText : undefined,
				summary: summary,
				signature: signature,
				id: id,
				format: format,
				index: outputIndex++,
			}
			consolidated.push(consolidatedEntry)
		}

		// For encrypted chunks (data), only keep the last one
		let lastDataEntry: ReasoningDetail | undefined
		for (const detail of details) {
			if (detail.data) {
				lastDataEntry = {
					type: detail.type,
					data: detail.data,
					signature: detail.signature,
					id: detail.id,
					format: detail.format,
					index: outputIndex++,
				}
			}
		}
		if (lastDataEntry) {
			consolidated.push(lastDataEntry)
		}
	}

	return consolidated
}
