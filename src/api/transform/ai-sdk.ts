/**
 * AI SDK conversion utilities for transforming between Anthropic/OpenAI formats and Vercel AI SDK formats.
 * These utilities are designed to be reused across different AI SDK providers.
 */

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { tool as createTool, jsonSchema, type ModelMessage, type TextStreamPart } from "ai"
import type { AssistantModelMessage } from "ai"
import type { ApiStreamChunk, ApiStream } from "./stream"

/**
 * Options for converting Anthropic messages to AI SDK format.
 */
export interface ConvertToAiSdkMessagesOptions {
	/**
	 * Optional function to transform the converted messages.
	 * Useful for transformations like flattening message content for models that require string content.
	 */
	transform?: (messages: ModelMessage[]) => ModelMessage[]
}

/**
 * Convert Anthropic messages to AI SDK ModelMessage format.
 * Handles text, images, tool uses, and tool results.
 *
 * @param messages - Array of Anthropic message parameters
 * @param options - Optional conversion options including post-processing function
 * @returns Array of AI SDK ModelMessage objects
 */
export function convertToAiSdkMessages(
	messages: Anthropic.Messages.MessageParam[],
	options?: ConvertToAiSdkMessagesOptions,
): ModelMessage[] {
	const modelMessages: ModelMessage[] = []

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
			modelMessages.push({
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

				// AI SDK requires tool results in separate "tool" role messages
				// UserContent only supports: string | Array<TextPart | ImagePart | FilePart>
				// ToolContent (for role: "tool") supports: Array<ToolResultPart | ToolApprovalResponse>
				if (toolResults.length > 0) {
					modelMessages.push({
						role: "tool",
						content: toolResults,
					} as ModelMessage)
				}

				// Add user message with only text/image content (no tool results)
				if (parts.length > 0) {
					modelMessages.push({
						role: "user",
						content: parts,
					} as ModelMessage)
				}
			} else if (message.role === "assistant") {
				const textParts: string[] = []
				const reasoningParts: string[] = []
				const reasoningContent = (() => {
					const maybe = (message as unknown as { reasoning_content?: unknown }).reasoning_content
					return typeof maybe === "string" && maybe.length > 0 ? maybe : undefined
				})()
				const toolCalls: Array<{
					type: "tool-call"
					toolCallId: string
					toolName: string
					input: unknown
					providerOptions?: Record<string, Record<string, unknown>>
				}> = []

				// Capture thinking signature for Anthropic-protocol providers (Bedrock, Anthropic).
				// Task.ts stores thinking blocks as { type: "thinking", thinking: "...", signature: "..." }.
				// The signature must be passed back via providerOptions on reasoning parts.
				let thinkingSignature: string | undefined

				// Extract thoughtSignature from content blocks (Gemini 3 thought signature round-tripping).
				// Task.ts stores these as { type: "thoughtSignature", thoughtSignature: "..." } blocks.
				let thoughtSignature: string | undefined
				for (const part of message.content) {
					const partAny = part as unknown as { type?: string; thoughtSignature?: string }
					if (partAny.type === "thoughtSignature" && partAny.thoughtSignature) {
						thoughtSignature = partAny.thoughtSignature
					}
				}

				for (const part of message.content) {
					if (part.type === "text") {
						textParts.push(part.text)
						continue
					}

					if (part.type === "tool_use") {
						const toolCall: (typeof toolCalls)[number] = {
							type: "tool-call",
							toolCallId: part.id,
							toolName: part.name,
							input: part.input,
						}

						// Attach thoughtSignature as providerOptions on tool-call parts.
						// The AI SDK's @ai-sdk/google provider reads providerOptions.google.thoughtSignature
						// and attaches it to the Gemini functionCall part.
						// Per Gemini 3 rules: only the FIRST functionCall in a parallel batch gets the signature.
						if (thoughtSignature && toolCalls.length === 0) {
							toolCall.providerOptions = {
								google: { thoughtSignature },
								vertex: { thoughtSignature },
							}
						}

						toolCalls.push(toolCall)
						continue
					}

					// Some providers (DeepSeek, Gemini, etc.) require reasoning to be round-tripped.
					// Task stores reasoning as a content block (type: "reasoning") and Anthropic extended
					// thinking as (type: "thinking"). Convert both to AI SDK's reasoning part.
					if ((part as unknown as { type?: string }).type === "reasoning") {
						// If message-level reasoning_content is present, treat it as canonical and
						// avoid mixing it with content-block reasoning (which can cause duplication).
						if (reasoningContent) continue

						const text = (part as unknown as { text?: string }).text
						if (typeof text === "string" && text.length > 0) {
							reasoningParts.push(text)
						}
						continue
					}

					if ((part as unknown as { type?: string }).type === "thinking") {
						if (reasoningContent) continue

						const thinkingPart = part as unknown as { thinking?: string; signature?: string }
						if (typeof thinkingPart.thinking === "string" && thinkingPart.thinking.length > 0) {
							reasoningParts.push(thinkingPart.thinking)
						}
						// Capture the signature for round-tripping (Anthropic/Bedrock thinking).
						if (thinkingPart.signature) {
							thinkingSignature = thinkingPart.signature
						}
						continue
					}
				}

				const content: Array<
					| { type: "reasoning"; text: string; providerOptions?: Record<string, Record<string, unknown>> }
					| { type: "text"; text: string }
					| {
							type: "tool-call"
							toolCallId: string
							toolName: string
							input: unknown
							providerOptions?: Record<string, Record<string, unknown>>
					  }
				> = []

				if (reasoningContent) {
					content.push({ type: "reasoning", text: reasoningContent })
				} else if (reasoningParts.length > 0) {
					const reasoningPart: (typeof content)[number] = {
						type: "reasoning",
						text: reasoningParts.join(""),
					}
					// Attach thinking signature for Anthropic/Bedrock round-tripping.
					// The AI SDK's @ai-sdk/amazon-bedrock reads providerOptions.bedrock.signature
					// and attaches it to reasoningContent.reasoningText.signature in the Bedrock request.
					if (thinkingSignature) {
						reasoningPart.providerOptions = {
							bedrock: { signature: thinkingSignature },
							anthropic: { signature: thinkingSignature },
						}
					}
					content.push(reasoningPart)
				}

				if (textParts.length > 0) {
					content.push({ type: "text", text: textParts.join("\n") })
				}
				content.push(...toolCalls)

				// Carry reasoning_details through to providerOptions for OpenRouter round-tripping
				// (used by Gemini 3, xAI, etc. for encrypted reasoning chain continuity).
				// The @openrouter/ai-sdk-provider reads message-level providerOptions.openrouter.reasoning_details
				// and validates them against ReasoningDetailUnionSchema (a strict Zod union).
				// Invalid entries (e.g. type "reasoning.encrypted" without a `data` field) must be
				// filtered out here, otherwise the entire safeParse fails and NO reasoning_details
				// are included in the outgoing request.
				const rawReasoningDetails = (message as unknown as { reasoning_details?: Record<string, unknown>[] })
					.reasoning_details
				const validReasoningDetails = rawReasoningDetails?.filter((detail) => {
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

				const assistantMessage: Record<string, unknown> = {
					role: "assistant",
					content: content.length > 0 ? content : [{ type: "text", text: "" }],
				}

				if (validReasoningDetails && validReasoningDetails.length > 0) {
					assistantMessage.providerOptions = {
						openrouter: { reasoning_details: validReasoningDetails },
					}
				}

				modelMessages.push(assistantMessage as ModelMessage)
			}
		}
	}

	// Apply transform if provided
	if (options?.transform) {
		return options.transform(modelMessages)
	}

	return modelMessages
}

/**
 * Options for flattening AI SDK messages.
 */
export interface FlattenMessagesOptions {
	/**
	 * If true, flattens user messages with only text parts to string content.
	 * Default: true
	 */
	flattenUserMessages?: boolean
	/**
	 * If true, flattens assistant messages with only text (no tool calls) to string content.
	 * Default: true
	 */
	flattenAssistantMessages?: boolean
}

/**
 * Flatten AI SDK messages to use string content where possible.
 * Some models (like DeepSeek on SambaNova) require string content instead of array content.
 * This function converts messages that contain only text parts to use simple string content.
 *
 * @param messages - Array of AI SDK ModelMessage objects
 * @param options - Options for controlling which message types to flatten
 * @returns Array of AI SDK ModelMessage objects with flattened content where applicable
 */
export function flattenAiSdkMessagesToStringContent(
	messages: ModelMessage[],
	options: FlattenMessagesOptions = {},
): ModelMessage[] {
	const { flattenUserMessages = true, flattenAssistantMessages = true } = options

	return messages.map((message) => {
		// Skip if content is already a string
		if (typeof message.content === "string") {
			return message
		}

		// Handle user messages
		if (message.role === "user" && flattenUserMessages && Array.isArray(message.content)) {
			const parts = message.content as Array<{ type: string; text?: string }>
			// Only flatten if all parts are text
			const allText = parts.every((part) => part.type === "text")
			if (allText && parts.length > 0) {
				const textContent = parts.map((part) => part.text || "").join("\n")
				return {
					...message,
					content: textContent,
				}
			}
		}

		// Handle assistant messages
		if (message.role === "assistant" && flattenAssistantMessages && Array.isArray(message.content)) {
			const parts = message.content as Array<{ type: string; text?: string }>
			// Only flatten if all parts are text or reasoning (no tool calls)
			// Reasoning parts are included in text to avoid sending multipart content to string-only models
			const allTextOrReasoning = parts.every((part) => part.type === "text" || part.type === "reasoning")
			if (allTextOrReasoning && parts.length > 0) {
				// Extract only text parts for the flattened content (reasoning is stripped for string-only models)
				const textParts = parts.filter((part) => part.type === "text")
				const textContent = textParts.map((part) => part.text || "").join("\n")
				return {
					...message,
					content: textContent,
				}
			}
		}

		// Return unchanged for tool role and messages with non-text content
		return message
	})
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
 * Extended stream part type that includes additional fullStream event types
 * that are emitted at runtime but not included in the AI SDK TextStreamPart type definitions.
 */
type ExtendedStreamPart = TextStreamPart<any> | { type: "text"; text: string } | { type: "reasoning"; text: string }

/**
 * Process a single AI SDK stream part and yield the appropriate ApiStreamChunk(s).
 * This generator handles all TextStreamPart types and converts them to the
 * ApiStreamChunk format used by the application.
 *
 * @param part - The AI SDK TextStreamPart to process (including fullStream event types)
 * @yields ApiStreamChunk objects corresponding to the stream part
 */
export function* processAiSdkStreamPart(part: ExtendedStreamPart): Generator<ApiStreamChunk> {
	switch (part.type) {
		case "text":
		case "text-delta":
			yield { type: "text", text: (part as { text: string }).text }
			break

		case "reasoning":
		case "reasoning-delta": {
			const text = (part as { text: string }).text
			if (text !== "[REDACTED]") {
				yield { type: "reasoning", text }
			}
			break
		}

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

		// Ignore lifecycle events that don't need to yield chunks.
		// Note: tool-call is intentionally ignored because tool-input-start/delta/end already
		// provide complete tool call information. Emitting tool-call would cause duplicate
		// tools in the UI for AI SDK providers (e.g., DeepSeek, Moonshot).
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
		case "tool-call":
		case "raw":
			break
	}
}

/**
 * Consume an AI SDK stream result, processing stream parts and handling usage.
 * Centralizes the common stream consumption pattern shared across all AI SDK
 * providers, with built-in error recovery that preserves stream error messages
 * when usage resolution throws (e.g. AI SDK's NoOutputGeneratedError).
 *
 * @param result - The stream result object from AI SDK's `streamText()`.
 *   Must have `fullStream` and `usage` properties.
 * @param usageHandler - Optional async generator that handles usage processing.
 *   When provided, the handler is responsible for awaiting usage/providerMetadata
 *   and yielding usage chunks. When omitted, a default handler awaits
 *   `result.usage` and yields a basic usage chunk with inputTokens/outputTokens.
 * @yields ApiStreamChunk objects from the stream and usage processing
 */
export async function* consumeAiSdkStream(
	result: {
		fullStream: AsyncIterable<ExtendedStreamPart>
		usage: PromiseLike<{ inputTokens?: number; outputTokens?: number }>
		response?: PromiseLike<{ messages?: Array<{ role: string; content: unknown; providerOptions?: unknown }> }>
	},
	usageHandler?: () => AsyncGenerator<ApiStreamChunk>,
): ApiStream {
	let lastStreamError: string | undefined

	for await (const part of result.fullStream) {
		for (const chunk of processAiSdkStreamPart(part)) {
			if (chunk.type === "error") {
				lastStreamError = chunk.message
			}
			yield chunk
		}
	}

	try {
		if (usageHandler) {
			yield* usageHandler()
		} else {
			const usage = await result.usage
			if (usage) {
				yield {
					type: "usage" as const,
					inputTokens: usage.inputTokens || 0,
					outputTokens: usage.outputTokens || 0,
				}
			}
		}
	} catch (usageError) {
		if (lastStreamError) {
			throw new Error(lastStreamError)
		}
		throw usageError
	}

	// Yield the AI SDK's fully-formed assistant message for direct storage
	yield* yieldResponseMessage(result)
}

/**
 * Await `result.response` and yield the assistant message from `response.messages`.
 * Used by both `consumeAiSdkStream` and providers with manual `fullStream` iteration.
 */
export async function* yieldResponseMessage(result: {
	response?: PromiseLike<{ messages?: Array<{ role: string; content: unknown; providerOptions?: unknown }> }>
}): ApiStream {
	if (!result.response) return
	try {
		const response = await result.response
		if (response.messages && response.messages.length > 0) {
			const assistantMsg = response.messages.find((m) => m.role === "assistant")
			if (assistantMsg) {
				yield { type: "response_message", message: assistantMsg as AssistantModelMessage }
			}
		}
	} catch {
		// response resolution can fail if the stream errored — ignore silently
		// since the stream error is already surfaced via lastStreamError
	}
}

/**
 * Type for AI SDK tool choice format.
 */
export type AiSdkToolChoice = "auto" | "none" | "required" | { type: "tool"; toolName: string } | undefined

/**
 * Map OpenAI-style tool_choice to AI SDK toolChoice format.
 * This is a shared utility to avoid duplication across providers.
 *
 * @param toolChoice - OpenAI-style tool choice (string or object)
 * @returns AI SDK toolChoice format
 */
export function mapToolChoice(toolChoice: any): AiSdkToolChoice {
	if (!toolChoice) {
		return undefined
	}

	// Handle string values
	if (typeof toolChoice === "string") {
		switch (toolChoice) {
			case "auto":
				return "auto"
			case "none":
				return "none"
			case "required":
				return "required"
			default:
				return "auto"
		}
	}

	// Handle object values (OpenAI ChatCompletionNamedToolChoice format)
	if (typeof toolChoice === "object" && "type" in toolChoice) {
		if (toolChoice.type === "function" && "function" in toolChoice && toolChoice.function?.name) {
			return { type: "tool", toolName: toolChoice.function.name }
		}
	}

	return undefined
}

/**
 * Extract a human-readable error message from an API response body string.
 * Handles common JSON error formats returned by AI providers.
 *
 * @param responseBody - The raw HTTP response body string
 * @returns The extracted error message, or undefined if none found
 */
export function extractMessageFromResponseBody(responseBody: string): string | undefined {
	if (!responseBody || typeof responseBody !== "string") {
		return undefined
	}

	try {
		const parsed: unknown = JSON.parse(responseBody)

		if (typeof parsed !== "object" || parsed === null) {
			return undefined
		}

		const obj = parsed as Record<string, unknown>

		// Format: {"error": {"message": "...", "code": "..."}} or {"error": {"message": "..."}}
		if (typeof obj.error === "object" && obj.error !== null) {
			const errorObj = obj.error as Record<string, unknown>
			if (typeof errorObj.message === "string" && errorObj.message) {
				if (typeof errorObj.code === "string" && errorObj.code) {
					return `[${errorObj.code}] ${errorObj.message}`
				}
				if (typeof errorObj.code === "number") {
					return `[${errorObj.code}] ${errorObj.message}`
				}
				return errorObj.message
			}
		}

		// Format: {"error": "string message"}
		if (typeof obj.error === "string" && obj.error) {
			return obj.error
		}

		// Format: {"message": "..."}
		if (typeof obj.message === "string" && obj.message) {
			return obj.message
		}

		return undefined
	} catch {
		// JSON parse failed — responseBody is not valid JSON
		return undefined
	}
}

/**
 * Extract a user-friendly error message from AI SDK errors.
 * The AI SDK wraps errors in types like AI_RetryError and AI_APICallError
 * which need to be unwrapped to get the actual error message.
 *
 * @param error - The error to extract the message from
 * @returns A user-friendly error message
 */
export function extractAiSdkErrorMessage(error: unknown): string {
	if (!error) {
		return "Unknown error"
	}

	if (typeof error !== "object") {
		return String(error)
	}

	const errorObj = error as Record<string, unknown>

	// AI_RetryError has a lastError property with the actual error
	if (errorObj.name === "AI_RetryError") {
		const retryCount = Array.isArray(errorObj.errors) ? errorObj.errors.length : 0
		const lastError = errorObj.lastError

		// Try to extract message from lastError's responseBody first
		let lastErrorMessage: string | undefined
		if (
			typeof lastError === "object" &&
			lastError !== null &&
			"responseBody" in lastError &&
			typeof (lastError as Record<string, unknown>).responseBody === "string"
		) {
			lastErrorMessage = extractMessageFromResponseBody(
				(lastError as Record<string, unknown>).responseBody as string,
			)
		}

		if (!lastErrorMessage) {
			lastErrorMessage =
				typeof lastError === "object" && lastError !== null && "message" in lastError
					? String((lastError as Record<string, unknown>).message)
					: lastError
						? String(lastError)
						: "Unknown error"
		}

		// Extract status code if available
		const statusCode = getStatusCode(lastError) ?? getStatusCode(error)

		if (statusCode) {
			return `Failed after ${retryCount} attempts (${statusCode}): ${lastErrorMessage}`
		}
		return `Failed after ${retryCount} attempts: ${lastErrorMessage}`
	}

	// AI_APICallError has message, optional status, and responseBody
	if (errorObj.name === "AI_APICallError") {
		const statusCode = getStatusCode(error)

		// Try to extract a richer message from responseBody
		let message: string | undefined
		if ("responseBody" in errorObj && typeof errorObj.responseBody === "string") {
			message = extractMessageFromResponseBody(errorObj.responseBody)
		}

		if (!message) {
			message = typeof errorObj.message === "string" ? errorObj.message : "API call failed"
		}

		if (statusCode) {
			return `API Error (${statusCode}): ${message}`
		}
		return message
	}

	// AI_NoOutputGeneratedError wraps a cause that may be an APICallError
	if (errorObj.name === "AI_NoOutputGeneratedError" || errorObj.name === "NoOutputGeneratedError") {
		const cause = errorObj.cause
		if (typeof cause === "object" && cause !== null) {
			const causeObj = cause as Record<string, unknown>
			// If cause is an AI_APICallError, recursively extract its message
			if (causeObj.name === "AI_APICallError") {
				return extractAiSdkErrorMessage(cause)
			}
			// Try responseBody on the cause directly
			if ("responseBody" in causeObj && typeof causeObj.responseBody === "string") {
				const bodyMessage = extractMessageFromResponseBody(causeObj.responseBody)
				if (bodyMessage) {
					return bodyMessage
				}
			}
			// Fall through to cause's message
			if ("message" in causeObj && typeof causeObj.message === "string") {
				return causeObj.message
			}
		}
		// Fall back to the error's own message
		if (typeof errorObj.message === "string" && errorObj.message) {
			return errorObj.message
		}
		return "No output generated"
	}

	// Standard Error
	if (error instanceof Error) {
		return error.message
	}

	// Fallback for non-Error objects
	return String(error)
}

/**
 * Extract a numeric status code from an error-like object.
 */
function getStatusCode(obj: unknown): number | undefined {
	if (typeof obj !== "object" || obj === null) {
		return undefined
	}
	const record = obj as Record<string, unknown>
	if (typeof record.status === "number") {
		return record.status
	}
	if (typeof record.statusCode === "number") {
		return record.statusCode
	}
	return undefined
}

/**
 * Optional configuration for `handleAiSdkError()` to support telemetry
 * capture and custom (e.g. i18n) message formatting without adding
 * direct dependencies to the shared transform layer.
 */
export interface HandleAiSdkErrorOptions {
	/**
	 * Called with the extracted error message and the original error before
	 * throwing.  Use this to report to telemetry or structured logging.
	 *
	 * @example
	 * onError: (msg) => {
	 *   TelemetryService.instance.captureException(
	 *     new ApiProviderError(msg, providerName, modelId, "createMessage"),
	 *   )
	 * }
	 */
	onError?: (message: string, originalError: unknown) => void

	/**
	 * Custom message formatter.  When provided, the returned string is used
	 * as the thrown Error's message instead of the default
	 * `${providerName}: ${extractedMessage}` format.
	 *
	 * @example
	 * formatMessage: (msg) => t("common:errors.gemini.generate_stream", { error: msg })
	 */
	formatMessage?: (message: string) => string
}

/**
 * Handle AI SDK errors by extracting the message and preserving status codes.
 * Returns an Error object with proper status preserved for retry logic.
 *
 * @param error - The AI SDK error to handle
 * @param providerName - The name of the provider for context
 * @param options - Optional telemetry / i18n hooks (see {@link HandleAiSdkErrorOptions})
 * @returns An Error with preserved status code
 */
export function handleAiSdkError(error: unknown, providerName: string, options?: HandleAiSdkErrorOptions): Error {
	const message = extractAiSdkErrorMessage(error)

	// Fire telemetry / logging callback before constructing the thrown error
	options?.onError?.(message, error)

	const displayMessage = options?.formatMessage ? options.formatMessage(message) : `${providerName}: ${message}`
	const wrappedError = new Error(displayMessage)

	// Preserve status code for retry logic
	const anyError = error as any
	const statusCode =
		anyError?.lastError?.status ||
		anyError?.lastError?.statusCode ||
		anyError?.status ||
		anyError?.statusCode ||
		undefined

	if (statusCode) {
		;(wrappedError as any).status = statusCode
	}

	// Preserve the original error for debugging
	;(wrappedError as any).cause = error

	return wrappedError
}
