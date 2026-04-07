import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Converts Anthropic-format messages to the OpenAI Responses API input format.
 *
 * Key differences from Chat Completions format:
 * - Content parts use { type: "input_text" } instead of { type: "text" }
 * - Images use { type: "input_image" } instead of { type: "image_url" }
 * - Tool results use { type: "function_call_output", call_id } instead of { role: "tool", tool_call_id }
 * - Tool uses become { type: "function_call", call_id, name, arguments } items
 * - System prompt goes via the `instructions` parameter, not as a message
 *
 * @param messages - Array of Anthropic MessageParam objects
 * @returns Array of Responses API input items
 */
export function convertToResponsesApiInput(messages: Anthropic.Messages.MessageParam[]): any[] {
	const input: any[] = []

	for (const message of messages) {
		if (typeof message.content === "string") {
			if (message.role === "assistant") {
				// Assistant messages use output_text in the Responses API format
				input.push({
					type: "message",
					role: "assistant",
					content: [{ type: "output_text", text: message.content }],
				})
			} else {
				input.push({
					role: message.role,
					content: [{ type: "input_text", text: message.content }],
				})
			}
			continue
		}

		if (message.role === "assistant") {
			for (const part of message.content) {
				switch (part.type) {
					case "text":
						input.push({
							type: "message",
							role: "assistant",
							content: [{ type: "output_text", text: part.text }],
						})
						break
					case "tool_use":
						input.push({
							type: "function_call",
							call_id: part.id,
							name: part.name,
							arguments: typeof part.input === "string" ? part.input : JSON.stringify(part.input ?? {}),
						})
						break
					case "thinking":
						// Include reasoning if it has content
						if ((part as any).thinking && (part as any).thinking.trim().length > 0) {
							input.push({
								type: "message",
								role: "assistant",
								content: [{ type: "output_text", text: `[Thinking] ${(part as any).thinking}` }],
							})
						}
						break
				}
			}
		} else {
			// User messages
			const contentParts: any[] = []
			for (const part of message.content) {
				switch (part.type) {
					case "text":
						contentParts.push({ type: "input_text", text: part.text })
						break
					case "image": {
						// Support both base64 and URL image sources
						const source = part.source as any
						const imageUrl =
							source.type === "url" && source.url
								? source.url
								: `data:${part.source.media_type};base64,${part.source.data}`
						contentParts.push({
							type: "input_image",
							detail: "auto",
							image_url: imageUrl,
						})
						break
					}
					case "tool_result": {
						// Flush any pending user content before the tool result
						if (contentParts.length > 0) {
							input.push({ role: "user", content: [...contentParts] })
							contentParts.length = 0
						}
						// Convert tool result content
						let output: string
						if (typeof part.content === "string") {
							output = part.content || "(empty)"
						} else if (Array.isArray(part.content)) {
							output =
								part.content
									.filter((c): c is Anthropic.TextBlockParam => c.type === "text")
									.map((c) => c.text)
									.join("\n") || "(empty)"
						} else {
							output = "(empty)"
						}
						input.push({
							type: "function_call_output",
							call_id: part.tool_use_id,
							output,
						})
						break
					}
				}
			}
			// Flush remaining user content
			if (contentParts.length > 0) {
				input.push({ role: "user", content: contentParts })
			}
		}
	}

	return input
}
