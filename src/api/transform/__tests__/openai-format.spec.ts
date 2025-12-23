// npx vitest run api/transform/__tests__/openai-format.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { convertToOpenAiMessages } from "../openai-format"
import { normalizeMistralToolCallId } from "../mistral-format"

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

	it("should handle assistant messages with tool use (no normalization without normalizeToolCallId)", () => {
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
			id: "weather-123", // Not normalized without normalizeToolCallId function
			type: "function",
			function: {
				name: "get_weather",
				arguments: JSON.stringify({ city: "London" }),
			},
		})
	})

	it("should handle user messages with tool results (no normalization without normalizeToolCallId)", () => {
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
		expect(toolMessage.tool_call_id).toBe("weather-123") // Not normalized without normalizeToolCallId function
		expect(toolMessage.content).toBe("Current temperature in London: 20°C")
	})

	it("should normalize tool call IDs when normalizeToolCallId function is provided", () => {
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

		// With normalizeToolCallId function - should normalize
		const openAiMessages = convertToOpenAiMessages(anthropicMessages, {
			normalizeToolCallId: normalizeMistralToolCallId,
		})

		const assistantMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam
		expect(assistantMessage.tool_calls![0].id).toBe(normalizeMistralToolCallId("call_5019f900a247472bacde0b82"))

		const toolMessage = openAiMessages[1] as OpenAI.Chat.ChatCompletionToolMessageParam
		expect(toolMessage.tool_call_id).toBe(normalizeMistralToolCallId("call_5019f900a247472bacde0b82"))
	})

	it("should not normalize tool call IDs when normalizeToolCallId function is not provided", () => {
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

		// Without normalizeToolCallId function - should NOT normalize
		const openAiMessages = convertToOpenAiMessages(anthropicMessages, {})

		const assistantMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam
		expect(assistantMessage.tool_calls![0].id).toBe("call_5019f900a247472bacde0b82")

		const toolMessage = openAiMessages[1] as OpenAI.Chat.ChatCompletionToolMessageParam
		expect(toolMessage.tool_call_id).toBe("call_5019f900a247472bacde0b82")
	})

	it("should use custom normalization function when provided", () => {
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

		// Custom normalization function that prefixes with "custom_"
		const customNormalizer = (id: string) => `custom_${id}`
		const openAiMessages = convertToOpenAiMessages(anthropicMessages, { normalizeToolCallId: customNormalizer })

		const assistantMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam
		expect(assistantMessage.tool_calls![0].id).toBe("custom_toolu_123")
	})

	describe("mergeToolResultText option", () => {
		it("should merge text content into last tool message when mergeToolResultText is true", () => {
			const anthropicMessages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-123",
							content: "Tool result content",
						},
						{
							type: "text",
							text: "<environment_details>\nSome context\n</environment_details>",
						},
					],
				},
			]

			const openAiMessages = convertToOpenAiMessages(anthropicMessages, { mergeToolResultText: true })

			// Should produce only one tool message with merged content
			expect(openAiMessages).toHaveLength(1)
			const toolMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionToolMessageParam
			expect(toolMessage.role).toBe("tool")
			expect(toolMessage.tool_call_id).toBe("tool-123")
			expect(toolMessage.content).toBe(
				"Tool result content\n\n<environment_details>\nSome context\n</environment_details>",
			)
		})

		it("should merge text into last tool message when multiple tool results exist", () => {
			const anthropicMessages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "call_1",
							content: "First result",
						},
						{
							type: "tool_result",
							tool_use_id: "call_2",
							content: "Second result",
						},
						{
							type: "text",
							text: "<environment_details>Context</environment_details>",
						},
					],
				},
			]

			const openAiMessages = convertToOpenAiMessages(anthropicMessages, { mergeToolResultText: true })

			// Should produce two tool messages, with text merged into the last one
			expect(openAiMessages).toHaveLength(2)
			expect((openAiMessages[0] as OpenAI.Chat.ChatCompletionToolMessageParam).content).toBe("First result")
			expect((openAiMessages[1] as OpenAI.Chat.ChatCompletionToolMessageParam).content).toBe(
				"Second result\n\n<environment_details>Context</environment_details>",
			)
		})

		it("should NOT merge text when images are present (fall back to user message)", () => {
			const anthropicMessages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-123",
							content: "Tool result content",
						},
						{
							type: "image",
							source: {
								type: "base64",
								media_type: "image/png",
								data: "base64data",
							},
						},
					],
				},
			]

			const openAiMessages = convertToOpenAiMessages(anthropicMessages, { mergeToolResultText: true })

			// Should produce a tool message AND a user message (because image is present)
			expect(openAiMessages).toHaveLength(2)
			expect((openAiMessages[0] as OpenAI.Chat.ChatCompletionToolMessageParam).role).toBe("tool")
			expect(openAiMessages[1].role).toBe("user")
		})

		it("should create separate user message when mergeToolResultText is false", () => {
			const anthropicMessages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-123",
							content: "Tool result content",
						},
						{
							type: "text",
							text: "<environment_details>\nSome context\n</environment_details>",
						},
					],
				},
			]

			const openAiMessages = convertToOpenAiMessages(anthropicMessages, { mergeToolResultText: false })

			// Should produce a tool message AND a separate user message (default behavior)
			expect(openAiMessages).toHaveLength(2)
			expect((openAiMessages[0] as OpenAI.Chat.ChatCompletionToolMessageParam).role).toBe("tool")
			expect((openAiMessages[0] as OpenAI.Chat.ChatCompletionToolMessageParam).content).toBe(
				"Tool result content",
			)
			expect(openAiMessages[1].role).toBe("user")
		})

		it("should work with normalizeToolCallId when mergeToolResultText is true", () => {
			const anthropicMessages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "call_5019f900a247472bacde0b82",
							content: "Tool result content",
						},
						{
							type: "text",
							text: "<environment_details>Context</environment_details>",
						},
					],
				},
			]

			const openAiMessages = convertToOpenAiMessages(anthropicMessages, {
				mergeToolResultText: true,
				normalizeToolCallId: normalizeMistralToolCallId,
			})

			// Should merge AND normalize the ID
			expect(openAiMessages).toHaveLength(1)
			const toolMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionToolMessageParam
			expect(toolMessage.role).toBe("tool")
			expect(toolMessage.tool_call_id).toBe(normalizeMistralToolCallId("call_5019f900a247472bacde0b82"))
			expect(toolMessage.content).toBe(
				"Tool result content\n\n<environment_details>Context</environment_details>",
			)
		})

		it("should handle user messages with only text content (no tool results)", () => {
			const anthropicMessages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello, how are you?",
						},
					],
				},
			]

			const openAiMessages = convertToOpenAiMessages(anthropicMessages, { mergeToolResultText: true })

			// Should produce a normal user message
			expect(openAiMessages).toHaveLength(1)
			expect(openAiMessages[0].role).toBe("user")
		})
	})
})
