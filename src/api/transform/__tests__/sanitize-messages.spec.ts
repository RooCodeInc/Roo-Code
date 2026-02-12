import { sanitizeMessagesForProvider } from "../sanitize-messages"
import type { RooMessage } from "../../../core/task-persistence/rooMessage"

describe("sanitizeMessagesForProvider", () => {
	it("should preserve role and content on user messages", () => {
		const messages: RooMessage[] = [{ role: "user", content: [{ type: "text", text: "Hello" }] }]

		const result = sanitizeMessagesForProvider(messages)

		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({
			role: "user",
			content: [{ type: "text", text: "Hello" }],
		})
	})

	it("should preserve role, content, and providerOptions on assistant messages", () => {
		const messages: RooMessage[] = [
			{
				role: "assistant",
				content: [{ type: "text", text: "Hi" }],
				providerOptions: { openrouter: { reasoning_details: [{ type: "reasoning.text", text: "thinking" }] } },
			} as any,
		]

		const result = sanitizeMessagesForProvider(messages)

		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({
			role: "assistant",
			content: [{ type: "text", text: "Hi" }],
			providerOptions: { openrouter: { reasoning_details: [{ type: "reasoning.text", text: "thinking" }] } },
		})
	})

	it("should strip reasoning_details from messages", () => {
		const messages = [
			{
				role: "assistant",
				content: [{ type: "text", text: "Response" }],
				reasoning_details: [{ type: "reasoning.encrypted", data: "encrypted_data" }],
			},
		] as any as RooMessage[]

		const result = sanitizeMessagesForProvider(messages)

		expect(result).toHaveLength(1)
		expect(result[0]).not.toHaveProperty("reasoning_details")
		expect(result[0]).toEqual({
			role: "assistant",
			content: [{ type: "text", text: "Response" }],
		})
	})

	it("should strip reasoning_content from messages", () => {
		const messages = [
			{
				role: "assistant",
				content: [{ type: "text", text: "Response" }],
				reasoning_content: "some reasoning content",
			},
		] as any as RooMessage[]

		const result = sanitizeMessagesForProvider(messages)

		expect(result).toHaveLength(1)
		expect(result[0]).not.toHaveProperty("reasoning_content")
	})

	it("should strip metadata fields (ts, condenseId, etc.)", () => {
		const messages = [
			{
				role: "user",
				content: "Hello",
				ts: 1234567890,
				condenseId: "cond-1",
				condenseParent: "cond-0",
				truncationId: "trunc-1",
				truncationParent: "trunc-0",
				isTruncationMarker: true,
				isSummary: true,
			},
		] as any as RooMessage[]

		const result = sanitizeMessagesForProvider(messages)

		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({
			role: "user",
			content: "Hello",
		})
		expect(result[0]).not.toHaveProperty("ts")
		expect(result[0]).not.toHaveProperty("condenseId")
		expect(result[0]).not.toHaveProperty("condenseParent")
		expect(result[0]).not.toHaveProperty("truncationId")
		expect(result[0]).not.toHaveProperty("truncationParent")
		expect(result[0]).not.toHaveProperty("isTruncationMarker")
		expect(result[0]).not.toHaveProperty("isSummary")
	})

	it("should strip any unknown extra fields", () => {
		const messages = [
			{
				role: "assistant",
				content: [{ type: "text", text: "Hi" }],
				some_future_field: "should be stripped",
				another_unknown: 42,
			},
		] as any as RooMessage[]

		const result = sanitizeMessagesForProvider(messages)

		expect(result).toHaveLength(1)
		expect(result[0]).not.toHaveProperty("some_future_field")
		expect(result[0]).not.toHaveProperty("another_unknown")
	})

	it("should not include providerOptions key when undefined", () => {
		const messages: RooMessage[] = [{ role: "user", content: "Hello" }]

		const result = sanitizeMessagesForProvider(messages)

		expect(result).toHaveLength(1)
		expect(Object.keys(result[0])).toEqual(["role", "content"])
	})

	it("should handle mixed message types correctly", () => {
		const messages = [
			{
				role: "user",
				content: [{ type: "text", text: "Hello" }],
				ts: 100,
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "Hi" }],
				reasoning_details: [{ type: "thinking", thinking: "some reasoning" }],
				reasoning_content: "some reasoning content",
				ts: 200,
			},
			{
				role: "tool",
				content: [{ type: "tool-result", toolCallId: "call_1", toolName: "test", result: "ok" }],
				ts: 300,
			},
			{
				role: "user",
				content: [{ type: "text", text: "Follow up" }],
				ts: 400,
			},
		] as any as RooMessage[]

		const result = sanitizeMessagesForProvider(messages)

		expect(result).toHaveLength(4)

		for (const msg of result) {
			expect(msg).not.toHaveProperty("reasoning_details")
			expect(msg).not.toHaveProperty("reasoning_content")
			expect(msg).not.toHaveProperty("ts")
		}

		expect(result[0]).toEqual({
			role: "user",
			content: [{ type: "text", text: "Hello" }],
		})
		expect(result[1]).toEqual({
			role: "assistant",
			content: [{ type: "text", text: "Hi" }],
		})
	})
})
