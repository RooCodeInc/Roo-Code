// npx vitest run api/transform/__tests__/openai-format.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { convertToOpenAiMessages, normalizeToolCallId } from "../openai-format"

describe("normalizeToolCallId", () => {
	it("should strip non-alphanumeric characters and truncate to 9 characters", () => {
		// OpenAI-style tool call ID: "call_5019f900..." -> "call5019f900..." -> first 9 chars = "call5019f"
		expect(normalizeToolCallId("call_5019f900a247472bacde0b82")).toBe("call5019f")
	})

	it("should handle Anthropic-style tool call IDs", () => {
		// Anthropic-style tool call ID
		expect(normalizeToolCallId("toolu_01234567890abcdef")).toBe("toolu0123")
	})

	it("should pad short IDs to 9 characters", () => {
		expect(normalizeToolCallId("abc")).toBe("abc000000")
		expect(normalizeToolCallId("tool-1")).toBe("tool10000")
	})

	it("should handle IDs that are exactly 9 alphanumeric characters", () => {
		expect(normalizeToolCallId("abcd12345")).toBe("abcd12345")
	})

	it("should return consistent results for the same input", () => {
		const id = "call_5019f900a247472bacde0b82"
		expect(normalizeToolCallId(id)).toBe(normalizeToolCallId(id))
	})

	it("should handle edge cases", () => {
		// Empty string
		expect(normalizeToolCallId("")).toBe("000000000")

		// Only non-alphanumeric characters
		expect(normalizeToolCallId("---___---")).toBe("000000000")

		// Mixed special characters
		expect(normalizeToolCallId("a-b_c.d@e")).toBe("abcde0000")
	})
})

describe("convertToOpenAiMessages", () => {
	it("should convert simple text messages", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
			{
				role: "assistant",
				content: "Hi there!",
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(2)
		expect(openAiMessages[0]).toEqual({
			role: "user",
			content: "Hello",
		})
		expect(openAiMessages[1]).toEqual({
			role: "assistant",
			content: "Hi there!",
		})
	})

	it("should handle messages with image content", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "What is in this image?",
					},
					{
						type: "image",
						source: {
							type: "base64",
							media_type: "image/jpeg",
							data: "base64data",
						},
					},
				],
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(1)
		expect(openAiMessages[0].role).toBe("user")

		const content = openAiMessages[0].content as Array<{
			type: string
			text?: string
			image_url?: { url: string }
		}>

		expect(Array.isArray(content)).toBe(true)
		expect(content).toHaveLength(2)
		expect(content[0]).toEqual({ type: "text", text: "What is in this image?" })
		expect(content[1]).toEqual({
			type: "image_url",
			image_url: { url: "data:image/jpeg;base64,base64data" },
		})
	})

	it("should handle assistant messages with tool use (no normalization without modelId)", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: "Let me check the weather.",
					},
					{
						type: "tool_use",
						id: "weather-123",
						name: "get_weather",
						input: { city: "London" },
					},
				],
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(1)

		const assistantMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam
		expect(assistantMessage.role).toBe("assistant")
		expect(assistantMessage.content).toBe("Let me check the weather.")
		expect(assistantMessage.tool_calls).toHaveLength(1)
		expect(assistantMessage.tool_calls![0]).toEqual({
			id: "weather-123", // Not normalized without modelId
			type: "function",
			function: {
				name: "get_weather",
				arguments: JSON.stringify({ city: "London" }),
			},
		})
	})

	it("should handle user messages with tool results (no normalization without modelId)", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "weather-123",
						content: "Current temperature in London: 20°C",
					},
				],
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(1)

		const toolMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionToolMessageParam
		expect(toolMessage.role).toBe("tool")
		expect(toolMessage.tool_call_id).toBe("weather-123") // Not normalized without modelId
		expect(toolMessage.content).toBe("Current temperature in London: 20°C")
	})

	it("should normalize tool call IDs when modelId contains 'mistral'", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "call_5019f900a247472bacde0b82",
						name: "read_file",
						input: { path: "test.ts" },
					},
				],
			},
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "call_5019f900a247472bacde0b82",
						content: "file contents",
					},
				],
			},
		]

		// With Mistral model ID - should normalize
		const openAiMessages = convertToOpenAiMessages(anthropicMessages, {
			modelId: "mistralai/mistral-large-latest",
		})

		const assistantMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam
		expect(assistantMessage.tool_calls![0].id).toBe(normalizeToolCallId("call_5019f900a247472bacde0b82"))

		const toolMessage = openAiMessages[1] as OpenAI.Chat.ChatCompletionToolMessageParam
		expect(toolMessage.tool_call_id).toBe(normalizeToolCallId("call_5019f900a247472bacde0b82"))
	})

	it("should not normalize tool call IDs when modelId does not contain 'mistral'", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "call_5019f900a247472bacde0b82",
						name: "read_file",
						input: { path: "test.ts" },
					},
				],
			},
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "call_5019f900a247472bacde0b82",
						content: "file contents",
					},
				],
			},
		]

		// With non-Mistral model ID - should NOT normalize
		const openAiMessages = convertToOpenAiMessages(anthropicMessages, { modelId: "openai/gpt-4" })

		const assistantMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam
		expect(assistantMessage.tool_calls![0].id).toBe("call_5019f900a247472bacde0b82")

		const toolMessage = openAiMessages[1] as OpenAI.Chat.ChatCompletionToolMessageParam
		expect(toolMessage.tool_call_id).toBe("call_5019f900a247472bacde0b82")
	})

	it("should be case-insensitive when checking for mistral in modelId", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "toolu_123",
						name: "test_tool",
						input: {},
					},
				],
			},
		]

		// Uppercase MISTRAL should still trigger normalization
		const openAiMessages = convertToOpenAiMessages(anthropicMessages, { modelId: "MISTRAL-7B" })

		const assistantMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam
		expect(assistantMessage.tool_calls![0].id).toBe(normalizeToolCallId("toolu_123"))
	})
})
