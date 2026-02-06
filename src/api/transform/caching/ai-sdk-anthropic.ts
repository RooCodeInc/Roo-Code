import type { ModelMessage } from "ai"

const ANTHROPIC_CACHE_CONTROL = {
	anthropic: { cacheControl: { type: "ephemeral" } },
}

/**
 * Add Anthropic cache breakpoints to AI SDK ModelMessage array.
 * Adds `providerOptions.anthropic.cacheControl` to the last text content part
 * of the last 2 user messages, enabling prompt caching for Anthropic models
 * via the AI SDK.
 *
 * Note: System prompt caching is handled separately at the streamText call level
 * by passing the system prompt as an array with providerOptions.
 *
 * @param messages - Array of AI SDK ModelMessage objects
 * @returns New array with cache breakpoints added (does not mutate input)
 */
export function addAiSdkAnthropicCacheBreakpoints(messages: ModelMessage[]): ModelMessage[] {
	const userMsgIndices = messages.reduce(
		(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
		[] as number[],
	)

	const targetIndices = new Set(userMsgIndices.slice(-2))

	if (targetIndices.size === 0) {
		return messages
	}

	return messages.map((message, index) => {
		if (!targetIndices.has(index)) {
			return message
		}

		if (typeof message.content === "string") {
			return {
				...message,
				content: [
					{
						type: "text" as const,
						text: message.content,
						providerOptions: ANTHROPIC_CACHE_CONTROL,
					},
				],
			} as ModelMessage
		}

		if (Array.isArray(message.content)) {
			// Find the index of the last text part
			let lastTextIndex = -1
			for (let i = message.content.length - 1; i >= 0; i--) {
				if ((message.content[i] as { type: string }).type === "text") {
					lastTextIndex = i
					break
				}
			}

			if (lastTextIndex === -1) {
				// No text part found — add a placeholder
				return {
					...message,
					content: [
						...message.content,
						{
							type: "text" as const,
							text: "...",
							providerOptions: ANTHROPIC_CACHE_CONTROL,
						},
					],
				} as ModelMessage
			}

			return {
				...message,
				content: message.content.map((part, i) => {
					if (i === lastTextIndex) {
						return {
							...(part as Record<string, unknown>),
							providerOptions: ANTHROPIC_CACHE_CONTROL,
						}
					}
					return part
				}),
			} as ModelMessage
		}

		return message
	})
}
