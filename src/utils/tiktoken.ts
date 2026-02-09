import { Tiktoken } from "tiktoken/lite"
import o200kBase from "tiktoken/encoders/o200k_base"

import type { NeutralContentBlock, NeutralToolUseBlock, NeutralToolResultBlock } from "../core/task-persistence"

const TOKEN_FUDGE_FACTOR = 1.5

let encoder: Tiktoken | null = null

/**
 * Serializes a tool_use block to text for token counting.
 * Approximates how the API sees the tool call.
 */
function serializeToolUse(block: NeutralToolUseBlock): string {
	const parts = [`Tool: ${block.toolName}`]
	if (block.input !== undefined) {
		try {
			parts.push(`Arguments: ${JSON.stringify(block.input)}`)
		} catch {
			parts.push(`Arguments: [serialization error]`)
		}
	}
	return parts.join("\n")
}

/**
 * Serializes a tool_result block to text for token counting.
 * Handles both string content and array content.
 */
function serializeToolResult(block: NeutralToolResultBlock): string {
	const parts = [`Tool Result (${block.toolCallId})`]

	const isError = block.output?.type === "error-text" || block.output?.type === "error-json"
	if (isError) {
		parts.push(`[Error]`)
	}

	const output = block.output
	if (output?.type === "text" || output?.type === "error-text") {
		parts.push(output.value)
	} else if (output?.type === "content") {
		// Handle array of content blocks recursively
		for (const item of output.value as Array<any>) {
			if (item.type === "text") {
				parts.push(item.text || "")
			} else if (item.type === "image") {
				parts.push("[Image content]")
			} else {
				parts.push(`[Unsupported content block: ${String((item as { type?: unknown }).type)}]`)
			}
		}
	} else if (output?.type === "json" || output?.type === "error-json") {
		parts.push(JSON.stringify(output.value))
	}

	return parts.join("\n")
}

export async function tiktoken(content: NeutralContentBlock[]): Promise<number> {
	if (content.length === 0) {
		return 0
	}

	let totalTokens = 0

	// Lazily create and cache the encoder if it doesn't exist.
	if (!encoder) {
		encoder = new Tiktoken(o200kBase.bpe_ranks, o200kBase.special_tokens, o200kBase.pat_str)
	}

	// Process each content block using the cached encoder.
	for (const block of content) {
		if (block.type === "text") {
			const text = block.text || ""

			if (text.length > 0) {
				const tokens = encoder.encode(text, undefined, [])
				totalTokens += tokens.length
			}
		} else if (block.type === "image") {
			// For images, calculate based on data size.
			const imageData = block.image

			if (imageData && typeof imageData === "string") {
				totalTokens += Math.ceil(Math.sqrt(imageData.length))
			} else {
				totalTokens += 300 // Conservative estimate for unknown images
			}
		} else if (block.type === "tool-call") {
			// Serialize tool-call block to text and count tokens
			const serialized = serializeToolUse(block as NeutralToolUseBlock)
			if (serialized.length > 0) {
				const tokens = encoder.encode(serialized, undefined, [])
				totalTokens += tokens.length
			}
		} else if (block.type === "tool-result") {
			// Serialize tool-result block to text and count tokens
			const serialized = serializeToolResult(block as NeutralToolResultBlock)
			if (serialized.length > 0) {
				const tokens = encoder.encode(serialized, undefined, [])
				totalTokens += tokens.length
			}
		}
	}

	// Add a fudge factor to account for the fact that tiktoken is not always
	// accurate.
	return Math.ceil(totalTokens * TOKEN_FUDGE_FACTOR)
}
