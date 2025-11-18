import { Anthropic } from "@anthropic-ai/sdk"
import { Content, Part } from "@google/genai"

type ThoughtSignatureContentBlock = {
	type: "thoughtSignature"
	thoughtSignature?: string
}

type ExtendedContentBlockParam = Anthropic.ContentBlockParam | ThoughtSignatureContentBlock
type ExtendedAnthropicContent = string | ExtendedContentBlockParam[]

function isThoughtSignatureContentBlock(block: ExtendedContentBlockParam): block is ThoughtSignatureContentBlock {
	return block.type === "thoughtSignature"
}

export function convertAnthropicContentToGemini(
	content: ExtendedAnthropicContent,
	options?: { includeThoughtSignatures?: boolean },
): Part[] {
	const includeThoughtSignatures = options?.includeThoughtSignatures ?? true

	if (typeof content === "string") {
		return [{ text: content }]
	}

	return content.flatMap((block): Part | Part[] => {
		// Handle thoughtSignature blocks first so that the main switch can continue
		// to operate on the standard Anthropic content union. This preserves strong
		// typing for known block types while still allowing provider-specific
		// extensions when needed.
		if (isThoughtSignatureContentBlock(block)) {
			if (includeThoughtSignatures && typeof block.thoughtSignature === "string") {
				// The Google GenAI SDK currently exposes thoughtSignature as an
				// extension field on Part; model it structurally without widening
				// the upstream type.
				return { thoughtSignature: block.thoughtSignature } as Part
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
