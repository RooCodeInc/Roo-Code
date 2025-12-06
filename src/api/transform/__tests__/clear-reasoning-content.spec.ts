// npx vitest run api/transform/__tests__/clear-reasoning-content.spec.ts

import { clearReasoningContentFromMessages } from "../clear-reasoning-content"
import { Anthropic } from "@anthropic-ai/sdk"

describe("clearReasoningContentFromMessages", () => {
	it("should clear reasoning_content from single assistant message", () => {
		const input: any[] = [
			{ role: "user", content: "Hello" },
			{
				role: "assistant",
				content: "Hi there",
				reasoning_content: "Let me think about this...",
			},
		]

		const result = clearReasoningContentFromMessages(input)

		expect(result).toEqual([
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there" },
		])
		expect(result[1]).not.toHaveProperty("reasoning_content")
	})

	it("should clear reasoning_content from multiple assistant messages", () => {
		const input: any[] = [
			{ role: "user", content: "Question 1" },
			{
				role: "assistant",
				content: "Answer 1",
				reasoning_content: "Reasoning 1",
			},
			{ role: "user", content: "Question 2" },
			{
				role: "assistant",
				content: "Answer 2",
				reasoning_content: "Reasoning 2",
			},
		]

		const result = clearReasoningContentFromMessages(input)

		expect(result).toEqual([
			{ role: "user", content: "Question 1" },
			{ role: "assistant", content: "Answer 1" },
			{ role: "user", content: "Question 2" },
			{ role: "assistant", content: "Answer 2" },
		])
		expect(result[1]).not.toHaveProperty("reasoning_content")
		expect(result[3]).not.toHaveProperty("reasoning_content")
	})

	it("should preserve reasoning_content in user messages (should not be affected)", () => {
		const input: any[] = [
			{
				role: "user",
				content: "Hello",
				reasoning_content: "User reasoning (should be preserved)",
			},
			{
				role: "assistant",
				content: "Hi",
				reasoning_content: "Assistant reasoning (should be cleared)",
			},
		]

		const result = clearReasoningContentFromMessages(input)

		// User messages are not modified
		expect(result[0]).toEqual(input[0])
		expect(result[0]).toHaveProperty("reasoning_content")

		// Assistant messages have reasoning_content cleared
		expect(result[1]).not.toHaveProperty("reasoning_content")
	})

	it("should preserve tool_calls in assistant messages", () => {
		const input: any[] = [
			{
				role: "assistant",
				content: "I'll use a tool",
				reasoning_content: "Let me think...",
				tool_calls: [
					{
						id: "call_123",
						type: "function",
						function: { name: "test_tool", arguments: "{}" },
					},
				],
			},
		]

		const result = clearReasoningContentFromMessages(input)

		expect(result[0]).toEqual({
			role: "assistant",
			content: "I'll use a tool",
			tool_calls: [
				{
					id: "call_123",
					type: "function",
					function: { name: "test_tool", arguments: "{}" },
				},
			],
		})
		expect(result[0]).not.toHaveProperty("reasoning_content")
		expect(result[0]).toHaveProperty("tool_calls")
	})

	it("should preserve content in assistant messages", () => {
		const input: any[] = [
			{
				role: "assistant",
				content: "This is the final answer",
				reasoning_content: "This is the reasoning",
			},
		]

		const result = clearReasoningContentFromMessages(input)

		expect(result[0]).toEqual({
			role: "assistant",
			content: "This is the final answer",
		})
		expect(result[0].content).toBe("This is the final answer")
	})

	it("should handle messages with both reasoning_content and content", () => {
		const input: any[] = [
			{
				role: "assistant",
				content: "Final answer",
				reasoning_content: "Reasoning process",
			},
		]

		const result = clearReasoningContentFromMessages(input)

		expect(result[0]).toEqual({
			role: "assistant",
			content: "Final answer",
		})
		expect(result[0]).not.toHaveProperty("reasoning_content")
		expect(result[0].content).toBe("Final answer")
	})

	it("should handle empty messages array", () => {
		const input: Anthropic.Messages.MessageParam[] = []

		const result = clearReasoningContentFromMessages(input)

		expect(result).toEqual([])
	})

	it("should handle messages with array content format", () => {
		const input: any[] = [
			{
				role: "assistant",
				content: [{ type: "text", text: "Answer" }],
				reasoning_content: "Reasoning",
			},
		]

		const result = clearReasoningContentFromMessages(input)

		expect(result[0]).toEqual({
			role: "assistant",
			content: [{ type: "text", text: "Answer" }],
		})
		expect(result[0]).not.toHaveProperty("reasoning_content")
	})

	it("should handle messages with tool results", () => {
		const input: any[] = [
			{
				role: "tool",
				content: "Tool result",
				tool_call_id: "call_123",
			},
			{
				role: "assistant",
				content: "Thanks for the tool result",
				reasoning_content: "Reasoning after tool",
			},
		]

		const result = clearReasoningContentFromMessages(input)

		// Tool messages are not modified
		expect(result[0]).toEqual(input[0])

		// Assistant messages have reasoning_content cleared
		expect(result[1]).toEqual({
			role: "assistant",
			content: "Thanks for the tool result",
		})
		expect(result[1]).not.toHaveProperty("reasoning_content")
	})

	it("should handle messages with only reasoning_content (no content)", () => {
		const input: any[] = [
			{
				role: "assistant",
				content: "",
				reasoning_content: "Only reasoning, no content",
			},
		]

		const result = clearReasoningContentFromMessages(input)

		expect(result[0]).toEqual({
			role: "assistant",
			content: "",
		})
		expect(result[0]).not.toHaveProperty("reasoning_content")
	})

	it("should handle messages with only content (no reasoning_content)", () => {
		const input: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: "Only content, no reasoning",
			},
		]

		const result = clearReasoningContentFromMessages(input)

		expect(result).toEqual(input)
		expect(result[0]).not.toHaveProperty("reasoning_content")
	})

	it("should handle consecutive assistant messages with reasoning_content", () => {
		const input: any[] = [
			{
				role: "assistant",
				content: "First response",
				reasoning_content: "Reasoning 1",
			},
			{
				role: "assistant",
				content: "Second response",
				reasoning_content: "Reasoning 2",
			},
		]

		const result = clearReasoningContentFromMessages(input)

		expect(result).toEqual([
			{ role: "assistant", content: "First response" },
			{ role: "assistant", content: "Second response" },
		])
		expect(result[0]).not.toHaveProperty("reasoning_content")
		expect(result[1]).not.toHaveProperty("reasoning_content")
	})

	it("should preserve all other properties when clearing reasoning_content", () => {
		const input: any[] = [
			{
				role: "assistant",
				content: "Answer",
				reasoning_content: "Reasoning",
				customProperty: "should be preserved",
				anotherProperty: 123,
			},
		]

		const result = clearReasoningContentFromMessages(input)

		expect(result[0]).toEqual({
			role: "assistant",
			content: "Answer",
			customProperty: "should be preserved",
			anotherProperty: 123,
		})
		expect(result[0]).not.toHaveProperty("reasoning_content")
		expect(result[0]).toHaveProperty("customProperty")
		expect(result[0]).toHaveProperty("anotherProperty")
	})
})
