import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Normalize a message's `content` field into an array of content blocks.
 *
 * Anthropic's `MessageParam.content` can be either a plain string or an
 * array of typed content blocks. This helper standardises the value to
 * always be an array, wrapping a plain string in a single text block.
 */
export function normalizeContentBlocks(
	content: string | Anthropic.Messages.ContentBlockParam[],
): Anthropic.Messages.ContentBlockParam[] {
	return Array.isArray(content) ? content : [{ type: "text" as const, text: content ?? "" }]
}
