import type { ModelMessage } from "ai"
import { flattenModelMessagesToStringContent } from "../messageUtils"

describe("flattenModelMessagesToStringContent", () => {
	test("flattens user messages with all text parts to string", () => {
		const messages: ModelMessage[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Part 1" },
					{ type: "text", text: "Part 2" },
				],
			} as ModelMessage,
		]
		const result = flattenModelMessagesToStringContent(messages)
		expect(result[0].content).toBe("Part 1\nPart 2")
	})

	test("does not flatten user messages with non-text parts", () => {
		const messages: ModelMessage[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Some text" },
					{ type: "image", image: "data:image/png;base64,abc=" },
				],
			} as ModelMessage,
		]
		const result = flattenModelMessagesToStringContent(messages)
		expect(Array.isArray(result[0].content)).toBe(true)
	})

	test("flattens assistant messages with text-only parts", () => {
		const messages: ModelMessage[] = [
			{
				role: "assistant",
				content: [
					{ type: "text", text: "Response part 1" },
					{ type: "text", text: "Response part 2" },
				],
			} as ModelMessage,
		]
		const result = flattenModelMessagesToStringContent(messages)
		expect(result[0].content).toBe("Response part 1\nResponse part 2")
	})

	test("flattens assistant messages with text + reasoning (strips reasoning)", () => {
		const messages: ModelMessage[] = [
			{
				role: "assistant",
				content: [
					{ type: "reasoning", text: "Thinking..." },
					{ type: "text", text: "The answer" },
				],
			} as ModelMessage,
		]
		const result = flattenModelMessagesToStringContent(messages)
		expect(result[0].content).toBe("The answer")
	})

	test("does not flatten assistant messages with tool calls", () => {
		const messages: ModelMessage[] = [
			{
				role: "assistant",
				content: [
					{ type: "text", text: "Let me help" },
					{ type: "tool-call", toolCallId: "c1", toolName: "read_file", input: {} },
				],
			} as ModelMessage,
		]
		const result = flattenModelMessagesToStringContent(messages)
		expect(Array.isArray(result[0].content)).toBe(true)
	})

	test("skips already-string content", () => {
		const messages: ModelMessage[] = [{ role: "user", content: "Already a string" }]
		const result = flattenModelMessagesToStringContent(messages)
		expect(result[0].content).toBe("Already a string")
	})

	test("respects flattenUserMessages=false", () => {
		const messages: ModelMessage[] = [
			{
				role: "user",
				content: [{ type: "text", text: "Part 1" }],
			} as ModelMessage,
		]
		const result = flattenModelMessagesToStringContent(messages, { flattenUserMessages: false })
		expect(Array.isArray(result[0].content)).toBe(true)
	})

	test("respects flattenAssistantMessages=false", () => {
		const messages: ModelMessage[] = [
			{
				role: "assistant",
				content: [{ type: "text", text: "Part 1" }],
			} as ModelMessage,
		]
		const result = flattenModelMessagesToStringContent(messages, { flattenAssistantMessages: false })
		expect(Array.isArray(result[0].content)).toBe(true)
	})

	test("does not modify tool messages", () => {
		const messages: ModelMessage[] = [
			{
				role: "tool",
				content: [
					{ type: "tool-result", toolCallId: "c1", toolName: "test", output: { type: "text", value: "ok" } },
				],
			} as ModelMessage,
		]
		const result = flattenModelMessagesToStringContent(messages)
		expect(Array.isArray(result[0].content)).toBe(true)
	})
})
