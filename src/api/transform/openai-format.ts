import OpenAI from "openai"
import {
	type RooMessage,
	type RooRoleMessage,
	type AnyToolCallBlock,
	type AnyToolResultBlock,
	isRooRoleMessage,
	isAnyToolCallBlock,
	isAnyToolResultBlock,
	getToolCallId,
	getToolCallName,
	getToolCallInput,
	getToolResultCallId,
	getToolResultContent,
} from "../../core/task-persistence/rooMessage"

/**
 * Type for OpenRouter's reasoning detail elements.
 * @see https://openrouter.ai/docs/use-cases/reasoning-tokens#streaming-response
 */
export type ReasoningDetail = {
	/**
	 * Type of reasoning detail.
	 * @see https://openrouter.ai/docs/use-cases/reasoning-tokens#reasoning-detail-types
	 */
	type: string // "reasoning.summary" | "reasoning.encrypted" | "reasoning.text"
	text?: string
	summary?: string
	data?: string // Encrypted reasoning data
	signature?: string | null
	id?: string | null // Unique identifier for the reasoning detail
	/**
	 * Format of the reasoning detail:
	 * - "unknown" - Format is not specified
	 * - "openai-responses-v1" - OpenAI responses format version 1
	 * - "anthropic-claude-v1" - Anthropic Claude format version 1 (default)
	 * - "google-gemini-v1" - Google Gemini format version 1
	 * - "xai-responses-v1" - xAI responses format version 1
	 */
	format?: string
	index?: number // Sequential index of the reasoning detail
}

/**
 * Consolidates reasoning_details by grouping by index and type.
 * - Filters out corrupted encrypted blocks (missing `data` field)
 * - For text blocks: concatenates text, keeps last signature/id/format
 * - For encrypted blocks: keeps only the last one per index
 *
 * @param reasoningDetails - Array of reasoning detail objects
 * @returns Consolidated array of reasoning details
 * @see https://github.com/cline/cline/issues/8214
 */
export function consolidateReasoningDetails(reasoningDetails: ReasoningDetail[]): ReasoningDetail[] {
	if (!reasoningDetails || reasoningDetails.length === 0) {
		return []
	}

	// Group by index
	const groupedByIndex = new Map<number, ReasoningDetail[]>()

	for (const detail of reasoningDetails) {
		// Drop corrupted encrypted reasoning blocks that would otherwise trigger:
		// "Invalid input: expected string, received undefined" for reasoning_details.*.data
		// See: https://github.com/cline/cline/issues/8214
		if (detail.type === "reasoning.encrypted" && !detail.data) {
			continue
		}

		const index = detail.index ?? 0
		if (!groupedByIndex.has(index)) {
			groupedByIndex.set(index, [])
		}
		groupedByIndex.get(index)!.push(detail)
	}

	// Consolidate each group
	const consolidated: ReasoningDetail[] = []

	for (const [index, details] of groupedByIndex.entries()) {
		// Concatenate all text parts
		let concatenatedText = ""
		let concatenatedSummary = ""
		let signature: string | undefined
		let id: string | undefined
		let format = "unknown"
		let type = "reasoning.text"

		for (const detail of details) {
			if (detail.text) {
				concatenatedText += detail.text
			}
			if (detail.summary) {
				concatenatedSummary += detail.summary
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

		// Create consolidated entry for text
		if (concatenatedText) {
			const consolidatedEntry: ReasoningDetail = {
				type: type,
				text: concatenatedText,
				signature: signature ?? undefined,
				id: id ?? undefined,
				format: format,
				index: index,
			}
			consolidated.push(consolidatedEntry)
		}

		// Create consolidated entry for summary (used by some providers)
		if (concatenatedSummary && !concatenatedText) {
			const consolidatedEntry: ReasoningDetail = {
				type: type,
				summary: concatenatedSummary,
				signature: signature ?? undefined,
				id: id ?? undefined,
				format: format,
				index: index,
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
					signature: detail.signature ?? undefined,
					id: detail.id ?? undefined,
					format: detail.format,
					index: index,
				}
			}
		}
		if (lastDataEntry) {
			consolidated.push(lastDataEntry)
		}
	}

	return consolidated
}

/**
 * A RooRoleMessage that may carry `reasoning_details` from OpenAI/OpenRouter providers.
 * Used to type-narrow instead of `as any` when accessing reasoning metadata.
 */
type MessageWithReasoningDetails = RooRoleMessage & { reasoning_details?: ReasoningDetail[] }

/**
 * Sanitizes OpenAI messages for Gemini models by filtering reasoning_details
 * to only include entries that match the tool call IDs.
 *
 * Gemini models require thought signatures for tool calls. When switching providers
 * mid-conversation, historical tool calls may not include Gemini reasoning details,
 * which can poison the next request. This function:
 * 1. Filters reasoning_details to only include entries matching tool call IDs
 * 2. Drops tool_calls that lack any matching reasoning_details
 * 3. Removes corresponding tool result messages for dropped tool calls
 *
 * @param messages - Array of OpenAI chat completion messages
 * @param modelId - The model ID to check if sanitization is needed
 * @returns Sanitized array of messages (unchanged if not a Gemini model)
 * @see https://github.com/cline/cline/issues/8214
 */
export function sanitizeGeminiMessages(
	messages: OpenAI.Chat.ChatCompletionMessageParam[],
	modelId: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
	// Only sanitize for Gemini models
	if (!modelId.includes("gemini")) {
		return messages
	}

	const droppedToolCallIds = new Set<string>()
	const sanitized: OpenAI.Chat.ChatCompletionMessageParam[] = []

	for (const msg of messages) {
		if (msg.role === "assistant") {
			const anyMsg = msg as any
			const toolCalls = anyMsg.tool_calls as OpenAI.Chat.ChatCompletionMessageToolCall[] | undefined
			const reasoningDetails = anyMsg.reasoning_details as ReasoningDetail[] | undefined

			if (Array.isArray(toolCalls) && toolCalls.length > 0) {
				const hasReasoningDetails = Array.isArray(reasoningDetails) && reasoningDetails.length > 0

				if (!hasReasoningDetails) {
					// No reasoning_details at all - drop all tool calls
					for (const tc of toolCalls) {
						if (tc?.id) {
							droppedToolCallIds.add(tc.id)
						}
					}
					// Keep any textual content, but drop the tool_calls themselves
					if (anyMsg.content) {
						sanitized.push({ role: "assistant", content: anyMsg.content } as any)
					}
					continue
				}

				// Filter reasoning_details to only include entries matching tool call IDs
				// This prevents mismatched reasoning details from poisoning the request
				const validToolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = []
				const validReasoningDetails: ReasoningDetail[] = []

				for (const tc of toolCalls) {
					// Check if there's a reasoning_detail with matching id
					const matchingDetails = reasoningDetails.filter((d) => d.id === tc.id)

					if (matchingDetails.length > 0) {
						validToolCalls.push(tc)
						validReasoningDetails.push(...matchingDetails)
					} else {
						// No matching reasoning_detail - drop this tool call
						if (tc?.id) {
							droppedToolCallIds.add(tc.id)
						}
					}
				}

				// Also include reasoning_details that don't have an id (legacy format)
				const detailsWithoutId = reasoningDetails.filter((d) => !d.id)
				validReasoningDetails.push(...detailsWithoutId)

				// Build the sanitized message
				const sanitizedMsg: any = {
					role: "assistant",
					content: anyMsg.content ?? "",
				}

				if (validReasoningDetails.length > 0) {
					sanitizedMsg.reasoning_details = consolidateReasoningDetails(validReasoningDetails)
				}

				if (validToolCalls.length > 0) {
					sanitizedMsg.tool_calls = validToolCalls
				}

				sanitized.push(sanitizedMsg)
				continue
			}
		}

		if (msg.role === "tool") {
			const anyMsg = msg as any
			if (anyMsg.tool_call_id && droppedToolCallIds.has(anyMsg.tool_call_id)) {
				// Skip tool result for dropped tool call
				continue
			}
		}

		sanitized.push(msg)
	}

	return sanitized
}

/**
 * Options for converting messages to OpenAI format.
 */
export interface ConvertToOpenAiMessagesOptions {
	/**
	 * Optional function to normalize tool call IDs for providers with strict ID requirements.
	 * When provided, this function will be applied to all tool call IDs.
	 * This allows callers to declare provider-specific ID format requirements.
	 */
	normalizeToolCallId?: (id: string) => string
	/**
	 * If true, merge text content after tool results into the last tool message
	 * instead of creating a separate user message. This is critical for providers
	 * with reasoning/thinking models (like DeepSeek-reasoner, GLM-4.7, etc.) where
	 * a user message after tool results causes the model to drop all previous
	 * reasoning_content. Default is false for backward compatibility.
	 */
	mergeToolResultText?: boolean
}

/**
 * Converts RooMessage[] to OpenAI chat completion messages.
 * Handles both AI SDK format (tool-call/tool-result) and legacy Anthropic format
 * (tool_use/tool_result) for backward compatibility with persisted data.
 */
export function convertToOpenAiMessages(
	messages: RooMessage[],
	options?: ConvertToOpenAiMessagesOptions,
): OpenAI.Chat.ChatCompletionMessageParam[] {
	const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []

	const mapReasoningDetails = (details: unknown): any[] | undefined => {
		if (!Array.isArray(details)) {
			return undefined
		}

		return details.map((detail: any) => {
			// Strip `id` from openai-responses-v1 blocks because OpenAI's Responses API
			// requires `store: true` to persist reasoning blocks. Since we manage
			// conversation state client-side, we don't use `store: true`, and sending
			// back the `id` field causes a 404 error.
			if (detail?.format === "openai-responses-v1" && detail?.id) {
				const { id, ...rest } = detail
				return rest
			}
			return detail
		})
	}

	// Use provided normalization function or identity function
	const normalizeId = options?.normalizeToolCallId ?? ((id: string) => id)

	/** Get image data URL from either AI SDK or legacy format. */
	const getImageDataUrl = (part: {
		type: string
		image?: string
		mediaType?: string
		source?: { media_type?: string; data?: string }
	}): string => {
		// AI SDK format: { type: "image", image: base64, mediaType: mimeType }
		if (part.image && part.mediaType) {
			return `data:${part.mediaType};base64,${part.image}`
		}
		// Legacy Anthropic format: { type: "image", source: { media_type, data } }
		if (part.source?.media_type && part.source?.data) {
			return `data:${part.source.media_type};base64,${part.source.data}`
		}
		return ""
	}

	for (const message of messages) {
		// Skip RooReasoningMessage (no role property)
		if (!("role" in message)) {
			continue
		}

		if (typeof message.content === "string") {
			// String content: simple text message
			const messageWithDetails = message as MessageWithReasoningDetails
			const baseMessage: OpenAI.Chat.ChatCompletionMessageParam & { reasoning_details?: any[] } = {
				role: message.role as "user" | "assistant",
				content: message.content,
			}

			if (message.role === "assistant") {
				const mapped = mapReasoningDetails(messageWithDetails.reasoning_details)
				if (mapped) {
					baseMessage.reasoning_details = mapped
				}
			}

			openAiMessages.push(baseMessage)
		} else if (message.role === "tool") {
			// RooToolMessage: each tool-result → OpenAI tool message
			if (Array.isArray(message.content)) {
				for (const part of message.content) {
					if (isAnyToolResultBlock(part as { type: string })) {
						const resultBlock = part as AnyToolResultBlock
						const rawContent = getToolResultContent(resultBlock)
						let content: string
						if (typeof rawContent === "string") {
							content = rawContent
						} else if (rawContent && typeof rawContent === "object" && "value" in rawContent) {
							content = String((rawContent as { value: unknown }).value)
						} else {
							content = rawContent ? JSON.stringify(rawContent) : ""
						}
						openAiMessages.push({
							role: "tool",
							tool_call_id: normalizeId(getToolResultCallId(resultBlock)),
							content: content || "(empty)",
						})
					}
				}
			}
		} else if (message.role === "user") {
			// User message: separate tool results from text/image content
			// Persisted data may contain legacy Anthropic tool_result blocks alongside AI SDK parts,
			// so we widen the element type to handle all possible block shapes.
			const contentArray: Array<{ type: string }> = Array.isArray(message.content)
				? (message.content as unknown as Array<{ type: string }>)
				: []

			const nonToolMessages: Array<{ type: string; text?: unknown; [k: string]: unknown }> = []
			const toolMessages: AnyToolResultBlock[] = []

			for (const part of contentArray) {
				if (isAnyToolResultBlock(part)) {
					toolMessages.push(part)
				} else if (part.type === "text" || part.type === "image") {
					nonToolMessages.push(part as { type: string; text?: unknown; [k: string]: unknown })
				}
			}

			// Process tool result messages FIRST
			toolMessages.forEach((toolMessage) => {
				const rawContent = getToolResultContent(toolMessage)
				let content: string

				if (typeof rawContent === "string") {
					content = rawContent
				} else if (Array.isArray(rawContent)) {
					content =
						rawContent
							.map((part: { type: string; text?: string }) => {
								if (part.type === "image") {
									return "(see following user message for image)"
								}
								return part.text
							})
							.join("\n") ?? ""
				} else if (rawContent && typeof rawContent === "object" && "value" in rawContent) {
					content = String((rawContent as { value: unknown }).value)
				} else {
					content = rawContent ? JSON.stringify(rawContent) : ""
				}

				openAiMessages.push({
					role: "tool",
					tool_call_id: normalizeId(getToolResultCallId(toolMessage)),
					content: content || "(empty)",
				})
			})

			// Process non-tool messages
			// Filter out empty text blocks to prevent "must include at least one parts field" error
			const filteredNonToolMessages = nonToolMessages.filter(
				(part) => part.type === "image" || (part.type === "text" && part.text),
			)

			if (filteredNonToolMessages.length > 0) {
				const hasOnlyTextContent = filteredNonToolMessages.every((part) => part.type === "text")
				const hasToolMessages = toolMessages.length > 0
				const shouldMergeIntoToolMessage = options?.mergeToolResultText && hasToolMessages && hasOnlyTextContent

				if (shouldMergeIntoToolMessage) {
					const lastToolMessage = openAiMessages[
						openAiMessages.length - 1
					] as OpenAI.Chat.ChatCompletionToolMessageParam
					if (lastToolMessage?.role === "tool") {
						const additionalText = filteredNonToolMessages.map((part) => String(part.text ?? "")).join("\n")
						lastToolMessage.content = `${lastToolMessage.content}\n\n${additionalText}`
					}
				} else {
					openAiMessages.push({
						role: "user",
						content: filteredNonToolMessages.map((part) => {
							if (part.type === "image") {
								return {
									type: "image_url",
									image_url: {
										url: getImageDataUrl(
											part as {
												type: string
												image?: string
												mediaType?: string
												source?: { media_type?: string; data?: string }
											},
										),
									},
								}
							}
							return { type: "text", text: String(part.text ?? "") }
						}),
					})
				}
			}
		} else if (message.role === "assistant") {
			// Assistant message: separate tool calls from text content
			// Persisted data may contain legacy Anthropic tool_use blocks, so we widen
			// the element type to accommodate both AI SDK and legacy block shapes.
			const contentArray: Array<{ type: string }> = Array.isArray(message.content)
				? (message.content as unknown as Array<{ type: string }>)
				: []

			const nonToolMessages: Array<{ type: string; text?: unknown }> = []
			const toolCallMessages: AnyToolCallBlock[] = []

			for (const part of contentArray) {
				if (isAnyToolCallBlock(part)) {
					toolCallMessages.push(part)
				} else if (part.type === "text" || part.type === "image") {
					nonToolMessages.push(part as { type: string; text?: unknown })
				}
			}

			// Process non-tool messages
			let content: string | undefined
			if (nonToolMessages.length > 0) {
				content = nonToolMessages
					.map((part) => {
						if (part.type === "image") {
							return ""
						}
						return part.text as string
					})
					.join("\n")
			}

			// Process tool call messages
			let tool_calls: OpenAI.Chat.ChatCompletionMessageToolCall[] = toolCallMessages.map((tc) => ({
				id: normalizeId(getToolCallId(tc)),
				type: "function" as const,
				function: {
					name: getToolCallName(tc),
					arguments: JSON.stringify(getToolCallInput(tc)),
				},
			}))

			const messageWithDetails = message as MessageWithReasoningDetails

			const baseMessage: OpenAI.Chat.ChatCompletionAssistantMessageParam & {
				reasoning_details?: any[]
			} = {
				role: "assistant",
				content: content ?? "",
			}

			const mapped = mapReasoningDetails(messageWithDetails.reasoning_details)
			if (mapped) {
				baseMessage.reasoning_details = mapped
			}

			if (tool_calls.length > 0) {
				baseMessage.tool_calls = tool_calls
			}

			openAiMessages.push(baseMessage)
		}
	}

	return openAiMessages
}
