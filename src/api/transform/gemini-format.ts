import { Anthropic } from "@anthropic-ai/sdk"
import { Content, Part } from "@google/genai"

export function convertAnthropicContentToGemini(
	content: string | Anthropic.ContentBlockParam[],
	options?: { includeThoughtSignatures?: boolean },
): Part[] {
	const includeThoughtSignatures = options?.includeThoughtSignatures ?? true

	if (typeof content === "string") {
		return [{ text: content }]
	}

	return content.flatMap((block): Part | Part[] => {
		// Support custom blocks that are not part of the Anthropic SDK types by
		// inspecting the runtime shape via `as any`. This lets us carry provider-
		// specific metadata (like thought signatures from the Google GenAI SDK)
		// through the Anthropic-style abstraction.
		const anyBlock = block as any

		// Handle thoughtSignature blocks first, outside the typed switch,
		// to avoid widening the Anthropic.ContentBlockParam union.
		// Only forward these when the caller explicitly opts in (e.g. when an
		// effort-based thinkingLevel is set). For all other cases (including
		// budget-only configs), drop the block entirely so it never reaches the
		// default handler.
		if (anyBlock.type === "thoughtSignature") {
			if (includeThoughtSignatures && typeof anyBlock.thoughtSignature === "string") {
				return { thoughtSignature: anyBlock.thoughtSignature } as any
			}
			// Explicitly omit thoughtSignature when not including it.
			return []
		}

		switch (block.type) {
			case "text":
				return { text: block.text }
			case "image":
				if (block.source.type !== "base64") {
					throw new Error("Unsupported image source type")
				}

				return { inlineData: { data: block.source.data, mimeType: block.source.media_type } }
			case "tool_use":
				return {
					functionCall: {
						name: block.name,
						args: block.input as Record<string, unknown>,
					},
				}
			case "tool_result": {
				if (!block.content) {
					return []
				}

				// Extract tool name from tool_use_id (e.g., "calculator-123" -> "calculator")
				const toolName = block.tool_use_id.split("-")[0]

				if (typeof block.content === "string") {
					return {
						functionResponse: { name: toolName, response: { name: toolName, content: block.content } },
					}
				}

				if (!Array.isArray(block.content)) {
					return []
				}

				const textParts: string[] = []
				const imageParts: Part[] = []

				for (const item of block.content) {
					if (item.type === "text") {
						textParts.push(item.text)
					} else if (item.type === "image" && item.source.type === "base64") {
						const { data, media_type } = item.source
						imageParts.push({ inlineData: { data, mimeType: media_type } })
					}
				}

				// Create content text with a note about images if present
				const contentText =
					textParts.join("\n\n") + (imageParts.length > 0 ? "\n\n(See next part for image)" : "")

				// Return function response followed by any images
				return [
					{ functionResponse: { name: toolName, response: { name: toolName, content: contentText } } },
					...imageParts,
				]
			}
			default:
				// Currently unsupported: "thinking" | "redacted_thinking" | "document"
				throw new Error(`Unsupported content block type: ${block.type}`)
		}
	})
}

export function convertAnthropicMessageToGemini(
	message: Anthropic.Messages.MessageParam,
	options?: { includeThoughtSignatures?: boolean },
): Content {
	return {
		role: message.role === "assistant" ? "model" : "user",
		parts: convertAnthropicContentToGemini(message.content, options),
	}
}
