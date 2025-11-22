// npx vitest run api/transform/__tests__/openai-format.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { convertToOpenAiMessages } from "../openai-format"

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

	it("should handle assistant messages with tool use", () => {
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
			id: "weather-123",
			type: "function",
			function: {
				name: "get_weather",
				arguments: JSON.stringify({ city: "London" }),
			},
		})
	})

	it("should handle user messages with tool results", () => {
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
		expect(toolMessage.tool_call_id).toBe("weather-123")
		expect(toolMessage.content).toBe("Current temperature in London: 20°C")
	})
	it("should handle assistant messages with reasoning details and preserve index field", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: "I will now reason about this.",
						// @ts-ignore
						reasoning_details: [
							{
								type: "reasoning.text",
								text: "This is the first part",
								index: 0,
								signature: "sig1",
								format: "format1",
							},
							{
								type: "reasoning.text",
								text: " of the reasoning.",
								index: 0,
								signature: "sig1",
								format: "format1",
							},
						],
					},
				],
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(1)

		const assistantMessage = openAiMessages[0] as any
		expect(assistantMessage.role).toBe("assistant")
		expect(assistantMessage.content).toBe("I will now reason about this.")
		expect(assistantMessage.reasoning_details).toHaveLength(1)
		expect(assistantMessage.reasoning_details[0]).toEqual({
			type: "reasoning.text",
			text: "This is the first part of the reasoning.",
			signature: "sig1",
			format: "format1",
			index: 0,
		})
		expect(assistantMessage.reasoning_details[0]).toHaveProperty("index")
	})
	it("should not include reasoning_details if they consolidate to empty array", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: "Response.",
						// @ts-ignore
						reasoning_details: [
							{
								index: 0,
								// No text, no data
							},
						],
					},
				],
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(1)

		const assistantMessage = openAiMessages[0] as any
		expect(assistantMessage.role).toBe("assistant")
		expect(assistantMessage.reasoning_details).toBeUndefined()
	})
	it("should re-index reasoning details sequentially", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: "Response.",
						// @ts-ignore
						reasoning_details: [
							{
								type: "reasoning.text",
								text: "Part 1",
								index: 0,
								format: "fmt",
							},
							{
								type: "reasoning.encrypted",
								data: "data1",
								index: 0,
								format: "fmt",
							},
							{
								type: "reasoning.text",
								text: "Part 2",
								index: 5, // Gap in index
								format: "fmt",
							},
						],
					},
				],
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		const assistantMessage = openAiMessages[0] as any
		const reasoning = assistantMessage.reasoning_details

		expect(reasoning).toHaveLength(3)
		expect(reasoning[0].index).toBe(0)
		expect(reasoning[0].text).toBe("Part 1")

		expect(reasoning[1].index).toBe(1)
		expect(reasoning[1].data).toBe("data1")

		expect(reasoning[2].index).toBe(2)
		expect(reasoning[2].text).toBe("Part 2")
	})
})
