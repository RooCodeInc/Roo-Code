import { Anthropic } from "@anthropic-ai/sdk"

import { ClaudeCodeAcpHandler } from "../claude-code-acp"

describe("ClaudeCodeAcpHandler", () => {
	it("fits formatted conversation to a character budget", () => {
		const handler = new ClaudeCodeAcpHandler({} as any)

		const messages: Anthropic.Messages.MessageParam[] = []
		for (let i = 0; i < 50; i++) {
			messages.push({
				role: i % 2 === 0 ? "user" : "assistant",
				content: `message-${i}\n` + "x".repeat(2_000),
			})
		}
		// Ensure we can detect that the tail is preserved.
		messages.push({ role: "assistant", content: "LAST_MESSAGE" + "y".repeat(2_000) })

		const maxChars = 5_000
		const formatted = (handler as any).formatConversation(messages, maxChars) as string

		expect(formatted.length).toBeLessThanOrEqual(maxChars)
		expect(formatted).toContain("[... earlier conversation omitted due to length ...]")
		expect(formatted).toContain("LAST_MESSAGE")
	})

	it("truncates large tool results while preserving head and tail", () => {
		const handler = new ClaudeCodeAcpHandler({} as any)

		const huge = `HEAD\n${"a".repeat(9_000)}\nTAIL`
		const msg: Anthropic.Messages.MessageParam = {
			role: "user",
			content: [
				{
					type: "tool_result",
					tool_use_id: "tool_use_1",
					is_error: false,
					content: huge,
				} as any,
			],
		}

		const formatted = (handler as any).formatSingleMessage(msg, false) as string
		expect(formatted).toContain("HEAD")
		expect(formatted).toContain("TAIL")
		expect(formatted).toContain("...truncated")
	})
})
