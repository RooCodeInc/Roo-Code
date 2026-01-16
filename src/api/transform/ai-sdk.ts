/**
 * AI SDK conversion utilities for transforming between Anthropic/OpenAI formats and Vercel AI SDK formats.
 * These utilities are designed to be reused across different AI SDK providers.
 */

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { tool as createTool, jsonSchema, type CoreMessage, type TextStreamPart } from "ai"
import type { ApiStreamChunk } from "./stream"

/**
 * Convert Anthropic messages to AI SDK CoreMessage format.
 * Handles text, images, tool uses, and tool results.
 *
 * @param messages - Array of Anthropic message parameters
 * @returns Array of AI SDK CoreMessage objects
 */
export function convertToAiSdkMessages(messages: Anthropic.Messages.MessageParam[]): CoreMessage[] {
	const coreMessages: CoreMessage[] = []

	// First pass: build a map of tool call IDs to tool names from assistant messages
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
		if (typeof message.content === "string") {
			coreMessages.push({
				role: message.role,
				content: message.content,
			})
		} else {
			if (message.role === "user") {
				const parts: Array<
					{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }
				> = []
				const toolResults: Array<{
					type: "tool-result"
					toolCallId: string
					toolName: string
					output: { type: "text"; value: string }
				}> = []

				for (const part of message.content) {
					if (part.type === "text") {
						parts.push({ type: "text", text: part.text })
					} else if (part.type === "image") {
						// Handle both base64 and URL source types
						const source = part.source as { type: string; media_type?: string; data?: string; url?: string }
						if (source.type === "base64" && source.media_type && source.data) {
							parts.push({
								type: "image",
								image: `data:${source.media_type};base64,${source.data}`,
								mimeType: source.media_type,
							})
						} else if (source.type === "url" && source.url) {
							parts.push({
								type: "image",
								image: source.url,
							})
						}
					} else if (part.type === "tool_result") {
						// Convert tool results to string content
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
						// Look up the tool name from the tool call ID
						const toolName = toolCallIdToName.get(part.tool_use_id) ?? "unknown_tool"
						toolResults.push({
							type: "tool-result",
							toolCallId: part.tool_use_id,
							toolName,
							output: { type: "text", value: content || "(empty)" },
						})
					}
				}

				// Tool results must be in a separate tool message
				if (toolResults.length > 0) {
					coreMessages.push({
						role: "tool",
						content: toolResults,
					} as CoreMessage)
				}

				// Add user message with remaining content
				if (parts.length > 0) {
					coreMessages.push({
						role: "user",
						content: parts,
					} as CoreMessage)
				}
			} else if (message.role === "assistant") {
				const textParts: string[] = []
				const toolCalls: Array<{
					type: "tool-call"
					toolCallId: string
					toolName: string
					args: unknown
				}> = []

				for (const part of message.content) {
					if (part.type === "text") {
						textParts.push(part.text)
					} else if (part.type === "tool_use") {
						toolCalls.push({
							type: "tool-call",
							toolCallId: part.id,
							toolName: part.name,
							args: part.input,
						})
					}
				}

				const content: Array<
					| { type: "text"; text: string }
					| { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
				> = []

				if (textParts.length > 0) {
					content.push({ type: "text", text: textParts.join("\n") })
				}
				content.push(...toolCalls)

				coreMessages.push({
					role: "assistant",
					content: content.length > 0 ? content : [{ type: "text", text: "" }],
				} as CoreMessage)
			}
		}
	}

	return coreMessages
}

/**
 * Convert OpenAI-style function tool definitions to AI SDK tool format.
 *
 * @param tools - Array of OpenAI tool definitions
 * @returns Record of AI SDK tools keyed by tool name, or undefined if no tools
 */
export function convertToolsForAiSdk(
	tools: OpenAI.Chat.ChatCompletionTool[] | undefined,
): Record<string, ReturnType<typeof createTool>> | undefined {
	if (!tools || tools.length === 0) {
		return undefined
	}

	const toolSet: Record<string, ReturnType<typeof createTool>> = {}

	for (const t of tools) {
		if (t.type === "function") {
			toolSet[t.function.name] = createTool({
				description: t.function.description,
				inputSchema: jsonSchema(t.function.parameters as any),
			})
		}
	}

	return toolSet
}

/**
 * Process a single AI SDK stream part and yield the appropriate ApiStreamChunk(s).
 * This generator handles all TextStreamPart types and converts them to the
 * ApiStreamChunk format used by the application.
 *
 * @param part - The AI SDK TextStreamPart to process
 * @yields ApiStreamChunk objects corresponding to the stream part
 */
export function* processAiSdkStreamPart(part: TextStreamPart<any>): Generator<ApiStreamChunk> {
	switch (part.type) {
		case "text-delta":
			yield { type: "text", text: part.text }
			break

		case "reasoning-delta":
			yield { type: "reasoning", text: part.text }
			break

		case "tool-input-start":
			yield {
				type: "tool_call_start",
				id: part.id,
				name: part.toolName,
			}
			break

		case "tool-input-delta":
			yield {
				type: "tool_call_delta",
				id: part.id,
				delta: part.delta,
			}
			break

		case "tool-input-end":
			yield {
				type: "tool_call_end",
				id: part.id,
			}
			break

		case "tool-call":
			// Complete tool call - emit for compatibility
			yield {
				type: "tool_call",
				id: part.toolCallId,
				name: part.toolName,
				arguments: typeof part.input === "string" ? part.input : JSON.stringify(part.input),
			}
			break

		case "source":
			// Handle both URL and document source types
			if ("url" in part) {
				yield {
					type: "grounding",
					sources: [
						{
							title: part.title || "Source",
							url: part.url,
							snippet: undefined,
						},
					],
				}
			}
			break

		case "error":
			yield {
				type: "error",
				error: "StreamError",
				message: part.error instanceof Error ? part.error.message : String(part.error),
			}
			break

		// Ignore lifecycle events that don't need to yield chunks
		case "text-start":
		case "text-end":
		case "reasoning-start":
		case "reasoning-end":
		case "start-step":
		case "finish-step":
		case "start":
		case "finish":
		case "abort":
		case "file":
		case "tool-result":
		case "tool-error":
		case "raw":
			// These events don't need to be yielded
			break
	}
}
