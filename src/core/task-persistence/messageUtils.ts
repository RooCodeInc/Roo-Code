/**
 * Utility functions for transforming `ModelMessage` arrays.
 *
 * These operate on `ModelMessage[]`, which means they also accept `RooMessage[]`
 * thanks to TypeScript's structural typing (RooMessage extends ModelMessage with metadata).
 */

import type { ModelMessage } from "ai"

/**
 * Options for flattening ModelMessage content arrays to plain strings.
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
 * Flatten `ModelMessage` content arrays to plain string content where possible.
 *
 * Used by providers (e.g., DeepSeek on SambaNova) that require string content
 * instead of array content. Only flattens messages whose content parts are all
 * text (or text + reasoning for assistant messages).
 *
 * @param messages - Array of ModelMessage objects
 * @param options - Controls which message roles to flatten
 * @returns New array of ModelMessage objects with flattened content where applicable
 */
export function flattenModelMessagesToStringContent(
	messages: ModelMessage[],
	options: FlattenMessagesOptions = {},
): ModelMessage[] {
	const { flattenUserMessages = true, flattenAssistantMessages = true } = options

	return messages.map((message) => {
		if (typeof message.content === "string") {
			return message
		}

		if (message.role === "user" && flattenUserMessages && Array.isArray(message.content)) {
			const parts = message.content as Array<{ type: string; text?: string }>
			const allText = parts.every((part) => part.type === "text")
			if (allText && parts.length > 0) {
				const textContent = parts.map((part) => part.text || "").join("\n")
				return { ...message, content: textContent }
			}
		}

		if (message.role === "assistant" && flattenAssistantMessages && Array.isArray(message.content)) {
			const parts = message.content as Array<{ type: string; text?: string }>
			const allTextOrReasoning = parts.every((part) => part.type === "text" || part.type === "reasoning")
			if (allTextOrReasoning && parts.length > 0) {
				const textParts = parts.filter((part) => part.type === "text")
				const textContent = textParts.map((part) => part.text || "").join("\n")
				return { ...message, content: textContent }
			}
		}

		return message
	})
}
