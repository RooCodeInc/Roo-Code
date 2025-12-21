/**
 * @fileoverview Generator wrapper that automatically logs API requests and responses
 */

import { ApiLogger } from "./api-logger"
import type { ApiLogContext, ApiRequestMetadata, ApiUsageMetrics } from "./types"
import type { ApiStream, ApiStreamUsageChunk } from "../../transform/stream"

/**
 * Options for the withLogging wrapper
 */
export interface WithLoggingOptions {
	/** API call context (provider, model, operation) */
	context: Omit<ApiLogContext, "requestId">
	/** Sanitized request metadata */
	request: ApiRequestMetadata
}

/**
 * Wraps an ApiStream generator with automatic logging
 *
 * This function:
 * 1. Logs the request before iteration starts
 * 2. Tracks metrics during streaming (text length, tool calls, usage)
 * 3. Logs the response after streaming completes (or error if thrown)
 *
 * @param options Logging options including context and request metadata
 * @param generator Factory function that creates the ApiStream to wrap
 * @returns A new ApiStream that yields the same chunks with logging
 *
 * @example
 * ```typescript
 * yield* withLogging(
 *   {
 *     context: { provider: "openai", model: "gpt-4", operation: "createMessage" },
 *     request: { messageCount: 3, hasTools: true, stream: true },
 *   },
 *   () => this.createStreamInternal(systemPrompt, messages, metadata)
 * )
 * ```
 */
export async function* withLogging(options: WithLoggingOptions, generator: () => ApiStream): ApiStream {
	const requestId = ApiLogger.logRequest(options.context, options.request)

	// Track metrics during streaming
	let textLength = 0
	let reasoningLength = 0
	let toolCallCount = 0
	let usage: ApiStreamUsageChunk | undefined
	// Track seen tool_call_partial indices to avoid overcounting
	const seenToolCallPartialIndices = new Set<number>()

	try {
		for await (const chunk of generator()) {
			// Track metrics based on chunk type
			switch (chunk.type) {
				case "text":
					textLength += chunk.text.length
					break
				case "reasoning":
					reasoningLength += chunk.text.length
					break
				case "tool_call":
				case "tool_call_start":
					toolCallCount++
					break
				case "tool_call_partial":
					// Count each unique tool call only once using index
					if (!seenToolCallPartialIndices.has(chunk.index)) {
						seenToolCallPartialIndices.add(chunk.index)
						toolCallCount++
					}
					break
				case "usage":
					usage = chunk
					break
			}

			yield chunk
		}

		// Build usage metrics if we have them
		const usageMetrics: ApiUsageMetrics | undefined = usage
			? {
					inputTokens: usage.inputTokens,
					outputTokens: usage.outputTokens,
					cacheReadTokens: usage.cacheReadTokens,
					cacheWriteTokens: usage.cacheWriteTokens,
					reasoningTokens: usage.reasoningTokens,
					totalCost: usage.totalCost,
				}
			: undefined

		// Log successful completion
		ApiLogger.logResponse(requestId, options.context, {
			textLength,
			reasoningLength: reasoningLength || undefined,
			toolCallCount: toolCallCount || undefined,
			usage: usageMetrics,
		})
	} catch (error) {
		// Log the error
		ApiLogger.logError(requestId, options.context, {
			message: error instanceof Error ? error.message : String(error),
			code:
				(error as { status?: string | number; code?: string | number })?.status ||
				(error as { status?: string | number; code?: string | number })?.code,
		})

		// Re-throw to preserve error handling behavior
		throw error
	}
}
