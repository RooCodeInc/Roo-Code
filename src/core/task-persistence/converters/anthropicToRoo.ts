/**
 * Converter from Anthropic-format `ApiMessage` to the new `RooMessage` format.
 *
 * This is the critical backward-compatibility piece that allows old conversation
 * histories stored in Anthropic format to be read and converted to the new format.
 *
 * The conversion logic mirrors {@link ../../api/transform/ai-sdk.ts | convertToAiSdkMessages}
 * but targets `RooMessage` types instead of AI SDK `ModelMessage`.
 */

import type { TextPart, ImagePart, ToolCallPart, ToolResultPart, ReasoningPart } from "../rooMessage"
import type { ApiMessage } from "../apiMessages"
import type {
	RooMessage,
	RooUserMessage,
	RooAssistantMessage,
	RooToolMessage,
	RooReasoningMessage,
	RooMessageMetadata,
} from "../rooMessage"

/**
 * Loose providerOptions shape used internally during message construction.
 * The AI SDK's `ProviderOptions` requires `Record<string, JSONObject>`, but our
 * intermediate data (e.g. reasoning_details) is typed more loosely. We cast to
 * this type during construction and let the AI SDK handle validation downstream.
 */
type LooseProviderOptions = Record<string, Record<string, unknown>>

/**
 * Extract Roo-specific metadata fields from an ApiMessage.
 * Only includes fields that are actually defined (avoids `undefined` keys).
 */
function extractMetadata(message: ApiMessage): RooMessageMetadata {
	const metadata: RooMessageMetadata = {}
	if (message.ts !== undefined) metadata.ts = message.ts
	if (message.condenseId !== undefined) metadata.condenseId = message.condenseId
	if (message.condenseParent !== undefined) metadata.condenseParent = message.condenseParent
	if (message.truncationId !== undefined) metadata.truncationId = message.truncationId
	if (message.truncationParent !== undefined) metadata.truncationParent = message.truncationParent
	if (message.isTruncationMarker !== undefined) metadata.isTruncationMarker = message.isTruncationMarker
	if (message.isSummary !== undefined) metadata.isSummary = message.isSummary
	return metadata
}

/**
 * Validate and filter reasoning_details entries for OpenRouter round-tripping.
 * Invalid entries are filtered out to prevent downstream parse failures.
 */
function filterValidReasoningDetails(details: Record<string, unknown>[]): Record<string, unknown>[] {
	return details.filter((detail) => {
		switch (detail.type) {
			case "reasoning.encrypted":
				return typeof detail.data === "string" && detail.data.length > 0
			case "reasoning.text":
				return typeof detail.text === "string"
			case "reasoning.summary":
				return typeof detail.summary === "string"
			default:
				return false
		}
	})
}

/**
 * Attach OpenRouter reasoning_details as providerOptions on an assistant message
 * if they are present and valid.
 */
function attachReasoningDetails(
	assistantMsg: RooAssistantMessage,
	rawDetails: Record<string, unknown>[] | undefined,
): void {
	if (!rawDetails || rawDetails.length === 0) return
	const valid = filterValidReasoningDetails(rawDetails)
	if (valid.length > 0) {
		const opts: LooseProviderOptions = {
			...((assistantMsg.providerOptions as LooseProviderOptions | undefined) ?? {}),
			openrouter: { reasoning_details: valid },
		}
		;(assistantMsg as { providerOptions?: LooseProviderOptions }).providerOptions = opts
	}
}

/**
 * Convert an array of Anthropic-format `ApiMessage` objects to `RooMessage` format.
 *
 * Conversion rules:
 * - User string content → `RooUserMessage` with `content: string`
 * - User array content → text/image parts stay in `RooUserMessage`, tool_result blocks
 *   are split into a separate `RooToolMessage`
 * - Assistant string content → `RooAssistantMessage` with `content: string`
 * - Assistant array content → text, tool-call, and reasoning parts in `RooAssistantMessage`
 * - Standalone reasoning messages → `RooReasoningMessage`
 * - Metadata fields (ts, condenseId, etc.) are preserved on all output messages
 *
 * @param messages - Array of ApiMessage (Anthropic format with metadata)
 * @returns Array of RooMessage objects
 */
export function convertAnthropicToRooMessages(messages: ApiMessage[]): RooMessage[] {
	const result: RooMessage[] = []

	// First pass: build a map of tool call IDs to tool names from assistant messages.
	// This is needed to resolve tool names for tool_result blocks in user messages.
	const toolCallIdToName = new Map<string, string>()
	for (const message of messages) {
		if (message.role === "assistant" && typeof message.content !== "string") {
			for (const part of message.content) {
				if (part.type === "tool_use") {
					toolCallIdToName.set(part.id, part.name)
				}
			}
		}
	}

	for (const message of messages) {
		const metadata = extractMetadata(message)

		// ── Standalone reasoning messages ──────────────────────────────────
		if (message.type === "reasoning" && message.encrypted_content) {
			const reasoningMsg: RooReasoningMessage = {
				type: "reasoning",
				encrypted_content: message.encrypted_content,
				...metadata,
			}
			if (message.id) reasoningMsg.id = message.id
			if (message.summary) reasoningMsg.summary = message.summary
			result.push(reasoningMsg)
			continue
		}

		// ── String content (both user and assistant) ──────────────────────
		if (typeof message.content === "string") {
			if (message.role === "user") {
				result.push({ role: "user", content: message.content, ...metadata } as RooUserMessage)
			} else if (message.role === "assistant") {
				const assistantMsg: RooAssistantMessage = {
					role: "assistant",
					content: message.content,
					...metadata,
				}
				attachReasoningDetails(assistantMsg, message.reasoning_details as Record<string, unknown>[] | undefined)
				result.push(assistantMsg)
			}
			continue
		}

		// ── Array content: User messages ──────────────────────────────────
		if (message.role === "user") {
			const parts: Array<TextPart | ImagePart> = []
			const toolResults: ToolResultPart[] = []

			for (const part of message.content) {
				if (part.type === "text") {
					parts.push({ type: "text", text: part.text })
				} else if (part.type === "image") {
					const source = part.source as {
						type: string
						media_type?: string
						data?: string
						url?: string
					}
					if (source.type === "base64" && source.media_type && source.data) {
						parts.push({
							type: "image",
							image: `data:${source.media_type};base64,${source.data}`,
							mediaType: source.media_type,
						})
					} else if (source.type === "url" && source.url) {
						parts.push({
							type: "image",
							image: source.url,
						})
					}
				} else if (part.type === "tool_result") {
					let content: string
					if (typeof part.content === "string") {
						content = part.content
					} else {
						content =
							part.content
								?.map((c) => {
									if (c.type === "text") return c.text
									if (c.type === "image") return "(image)"
									return ""
								})
								.join("\n") ?? ""
					}
					const toolName = toolCallIdToName.get(part.tool_use_id) ?? "unknown_tool"
					toolResults.push({
						type: "tool-result",
						toolCallId: part.tool_use_id,
						toolName,
						output: { type: "text", value: content || "(empty)" },
					})
				}
			}

			// Tool results go into a separate RooToolMessage (emitted before user content)
			if (toolResults.length > 0) {
				result.push({ role: "tool", content: toolResults, ...metadata } as RooToolMessage)
			}

			// Text/image parts stay in RooUserMessage
			if (parts.length > 0) {
				result.push({ role: "user", content: parts, ...metadata } as RooUserMessage)
			}
			continue
		}

		// ── Array content: Assistant messages ─────────────────────────────
		if (message.role === "assistant") {
			// Check for message-level reasoning_content (DeepSeek interleaved thinking).
			// When present, it takes precedence over content-block reasoning/thinking.
			const reasoningContent = (() => {
				const maybe = message.reasoning_content
				return typeof maybe === "string" && maybe.length > 0 ? maybe : undefined
			})()

			const content: Array<TextPart | ToolCallPart | ReasoningPart> = []

			// Extract thoughtSignature from content blocks (Gemini 3 thought signature).
			let thoughtSignature: string | undefined
			for (const part of message.content) {
				const partAny = part as unknown as { type?: string; thoughtSignature?: string }
				if (partAny.type === "thoughtSignature" && partAny.thoughtSignature) {
					thoughtSignature = partAny.thoughtSignature
				}
			}

			// If message-level reasoning_content exists, add it as the canonical reasoning part
			if (reasoningContent) {
				content.push({ type: "reasoning", text: reasoningContent })
			}

			let toolCallCount = 0
			for (const part of message.content) {
				if (part.type === "text") {
					content.push({ type: "text", text: part.text })
					continue
				}

				if (part.type === "tool_use") {
					const toolCall: ToolCallPart = {
						type: "tool-call",
						toolCallId: part.id,
						toolName: part.name,
						input: part.input,
					}
					// Attach thoughtSignature on the first tool call only (Gemini 3 rule)
					if (thoughtSignature && toolCallCount === 0) {
						toolCall.providerOptions = {
							google: { thoughtSignature },
							vertex: { thoughtSignature },
						} as ToolCallPart["providerOptions"]
					}
					toolCallCount++
					content.push(toolCall)
					continue
				}

				const partAny = part as unknown as Record<string, unknown>

				// Skip thoughtSignature blocks (already extracted above)
				if (partAny.type === "thoughtSignature") continue

				// Reasoning blocks (type: "reasoning" with text field)
				if (partAny.type === "reasoning") {
					if (reasoningContent) continue
					if (typeof partAny.text === "string" && (partAny.text as string).length > 0) {
						content.push({ type: "reasoning", text: partAny.text as string })
					}
					continue
				}

				// Thinking blocks (type: "thinking" with thinking and signature)
				if (partAny.type === "thinking") {
					if (reasoningContent) continue
					if (typeof partAny.thinking === "string" && (partAny.thinking as string).length > 0) {
						const reasoningPart: ReasoningPart = {
							type: "reasoning",
							text: partAny.thinking as string,
						}
						if (partAny.signature) {
							reasoningPart.providerOptions = {
								bedrock: { signature: partAny.signature as string },
								anthropic: { signature: partAny.signature as string },
							} as ReasoningPart["providerOptions"]
						}
						content.push(reasoningPart)
					}
					continue
				}
			}

			const assistantMsg: RooAssistantMessage = {
				role: "assistant",
				content: content.length > 0 ? content : "",
				...metadata,
			}

			attachReasoningDetails(assistantMsg, message.reasoning_details as Record<string, unknown>[] | undefined)

			result.push(assistantMsg)
		}
	}

	return result
}
