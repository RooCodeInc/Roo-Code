import type { ApiStream, ApiStreamUsageChunk } from "./stream"

/**
 * Processes Responses API stream events and yields ApiStreamChunks.
 *
 * This is a shared utility for providers that use OpenAI's Responses API
 * (POST /v1/responses with stream: true). It handles the core event types:
 *
 * - Text deltas (response.output_text.delta)
 * - Reasoning deltas (response.reasoning_text.delta, response.reasoning_summary_text.delta)
 * - Tool/function calls (response.output_item.done with function_call type)
 * - Usage data (response.completed)
 *
 * Provider-specific concerns (WebSocket mode, SSE fallback, duplicate detection,
 * pending tool tracking) are intentionally left to individual providers.
 *
 * @param stream - AsyncIterable of Responses API stream events
 * @param normalizeUsage - Provider-specific function to normalize usage data into ApiStreamUsageChunk
 */
export async function* processResponsesApiStream(
	stream: AsyncIterable<any>,
	normalizeUsage: (usage: any) => ApiStreamUsageChunk | undefined,
): ApiStream {
	for await (const event of stream) {
		// Text content deltas
		if (event?.type === "response.output_text.delta" || event?.type === "response.text.delta") {
			if (event?.delta) {
				yield { type: "text", text: event.delta }
			}
			continue
		}

		// Reasoning deltas
		if (
			event?.type === "response.reasoning_text.delta" ||
			event?.type === "response.reasoning.delta" ||
			event?.type === "response.reasoning_summary_text.delta" ||
			event?.type === "response.reasoning_summary.delta"
		) {
			if (event?.delta) {
				yield { type: "reasoning", text: event.delta }
			}
			continue
		}

		// Output item events — handle completed function calls and fallback text
		if (event?.type === "response.output_item.done") {
			const item = event?.item
			if (item?.type === "function_call" || item?.type === "tool_call") {
				const callId = item.call_id || item.tool_call_id || item.id
				const name = item.name || item.function?.name
				const argsRaw = item.arguments || item.function?.arguments || item.input
				const args =
					typeof argsRaw === "string"
						? argsRaw
						: argsRaw && typeof argsRaw === "object"
							? JSON.stringify(argsRaw)
							: ""

				if (typeof callId === "string" && callId.length > 0 && typeof name === "string" && name.length > 0) {
					yield {
						type: "tool_call",
						id: callId,
						name,
						arguments: args,
					}
				}
			}
			continue
		}

		// Function call argument deltas (for streaming tool calls)
		if (
			event?.type === "response.function_call_arguments.delta" ||
			event?.type === "response.tool_call_arguments.delta"
		) {
			const callId = event.call_id || event.tool_call_id || event.id || event.item_id
			const name = event.name || event.function_name
			if (typeof callId === "string" && callId.length > 0) {
				yield {
					type: "tool_call_partial",
					index: event.index ?? 0,
					id: callId,
					name,
					arguments: typeof event.delta === "string" ? event.delta : "",
				}
			}
			continue
		}

		// Completion events — extract usage
		if (event?.type === "response.completed" || event?.type === "response.done") {
			const usage = event?.response?.usage || event?.usage
			const usageData = normalizeUsage(usage)
			if (usageData) {
				yield usageData
			}
			continue
		}
	}
}

/**
 * Creates a standard usage normalizer for providers with per-token pricing.
 * Extracts input/output tokens, cache tokens, reasoning tokens, and computes cost.
 *
 * @param calculateCost - Optional function to compute total cost from token counts
 */
export function createUsageNormalizer(
	calculateCost?: (inputTokens: number, outputTokens: number, cacheReadTokens: number) => number,
): (usage: any) => ApiStreamUsageChunk | undefined {
	return (usage: any): ApiStreamUsageChunk | undefined => {
		if (!usage) return undefined

		const inputDetails = usage.input_tokens_details ?? usage.prompt_tokens_details
		const cachedTokens = inputDetails?.cached_tokens ?? 0

		const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0
		const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0
		const cacheReadTokens = usage.cache_read_input_tokens ?? cachedTokens ?? 0
		const cacheWriteTokens = usage.cache_creation_input_tokens ?? usage.cache_write_tokens ?? 0

		const reasoningTokens =
			typeof usage.output_tokens_details?.reasoning_tokens === "number"
				? usage.output_tokens_details.reasoning_tokens
				: undefined

		const totalCost = calculateCost ? calculateCost(inputTokens, outputTokens, cacheReadTokens) : undefined

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheReadTokens,
			cacheWriteTokens,
			...(typeof reasoningTokens === "number" ? { reasoningTokens } : {}),
			...(typeof totalCost === "number" ? { totalCost } : {}),
		}
	}
}
