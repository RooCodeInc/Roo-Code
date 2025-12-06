// npx vitest run api/transform/__tests__/r1-format.spec.ts

import { convertToR1Format } from "../r1-format"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

describe("convertToR1Format", () => {
	it("should convert basic text messages", () => {
		const input: Anthropic.Messages.MessageParam[] = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there" },
		]

		const expected: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there" },
		]

		expect(convertToR1Format(input)).toEqual(expected)
	})

	it("should merge consecutive messages with same role", () => {
		const input: Anthropic.Messages.MessageParam[] = [
			{ role: "user", content: "Hello" },
			{ role: "user", content: "How are you?" },
			{ role: "assistant", content: "Hi!" },
			{ role: "assistant", content: "I'm doing well" },
		]

		const expected: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "user", content: "Hello\nHow are you?" },
			{ role: "assistant", content: "Hi!\nI'm doing well" },
		]

		expect(convertToR1Format(input)).toEqual(expected)
	})

	it("should handle image content", () => {
		const input: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
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

		const expected: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "image_url",
						image_url: {
							url: "data:image/jpeg;base64,base64data",
						},
					},
				],
			},
		]

		expect(convertToR1Format(input)).toEqual(expected)
	})

	it("should handle mixed text and image content", () => {
		const input: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Check this image:" },
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

		const expected: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Check this image:" },
					{
						type: "image_url",
						image_url: {
							url: "data:image/jpeg;base64,base64data",
						},
					},
				],
			},
		]

		expect(convertToR1Format(input)).toEqual(expected)
	})

	it("should merge mixed content messages with same role", () => {
		const input: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "First image:" },
					{
						type: "image",
						source: {
							type: "base64",
							media_type: "image/jpeg",
							data: "image1",
						},
					},
				],
			},
			{
				role: "user",
				content: [
					{ type: "text", text: "Second image:" },
					{
						type: "image",
						source: {
							type: "base64",
							media_type: "image/png",
							data: "image2",
						},
					},
				],
			},
		]

		const expected: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "First image:" },
					{
						type: "image_url",
						image_url: {
							url: "data:image/jpeg;base64,image1",
						},
					},
					{ type: "text", text: "Second image:" },
					{
						type: "image_url",
						image_url: {
							url: "data:image/png;base64,image2",
						},
					},
				],
			},
		]

		expect(convertToR1Format(input)).toEqual(expected)
	})

	it("should handle empty messages array", () => {
		expect(convertToR1Format([])).toEqual([])
	})

	it("should handle messages with empty content", () => {
		const input: Anthropic.Messages.MessageParam[] = [
			{ role: "user", content: "" },
			{ role: "assistant", content: "" },
		]

		const expected: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "user", content: "" },
			{ role: "assistant", content: "" },
		]

		expect(convertToR1Format(input)).toEqual(expected)
	})

	describe("reasoning_content clearing", () => {
		it("should clear reasoning_content from assistant messages", () => {
			const input: any[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: "Hi there",
					reasoning_content: "Let me think about this...",
				},
			]

			const result = convertToR1Format(input)

			expect(result).toEqual([
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
			])
			expect(result[1]).not.toHaveProperty("reasoning_content")
		})

		it("should clear reasoning_content when merging consecutive assistant messages", () => {
			const input: any[] = [
				{ role: "user", content: "Question" },
				{
					role: "assistant",
					content: "First part",
					reasoning_content: "Reasoning 1",
				},
				{
					role: "assistant",
					content: "Second part",
					reasoning_content: "Reasoning 2",
				},
			]

			const result = convertToR1Format(input)

			expect(result).toEqual([
				{ role: "user", content: "Question" },
				{ role: "assistant", content: "First part\nSecond part" },
			])
			expect(result[1]).not.toHaveProperty("reasoning_content")
		})

		it("should preserve content while clearing reasoning_content", () => {
			const input: any[] = [
				{
					role: "assistant",
					content: "The final answer",
					reasoning_content: "Detailed reasoning process",
				},
			]

			const result = convertToR1Format(input)

			expect(result[0]).toEqual({
				role: "assistant",
				content: "The final answer",
			})
			expect(result[0].content).toBe("The final answer")
			expect(result[0]).not.toHaveProperty("reasoning_content")
		})

		it("should handle messages without reasoning_content (should still work)", () => {
			const input: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
			]

			const result = convertToR1Format(input)

			expect(result).toEqual([
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
			])
		})

		it("should preserve reasoning_content when clearReasoningContent is false", () => {
			const input: any[] = [
				{ role: "user", content: "Question" },
				{
					role: "assistant",
					content: "Answer",
					reasoning_content: "Let me think...",
				},
			]

			const result = convertToR1Format(input, false)

			expect(result[1]).toHaveProperty("reasoning_content")
			expect((result[1] as any).reasoning_content).toBe("Let me think...")
		})

		it("should clear reasoning_content when clearReasoningContent is true (default)", () => {
			const input: any[] = [
				{ role: "user", content: "Question" },
				{
					role: "assistant",
					content: "Answer",
					reasoning_content: "Let me think...",
				},
			]

			const result = convertToR1Format(input, true)

			expect(result[1]).not.toHaveProperty("reasoning_content")
		})

		it("should preserve reasoning_content during tool call sequences", () => {
			const input: any[] = [
				{ role: "user", content: "Get weather" },
				{
					role: "assistant",
					content: "Let me check",
					reasoning_content: "I need to get the weather",
					tool_calls: [{ id: "call-1", function: { name: "get_weather", arguments: "{}" } }],
				},
			]

			// During tool call continuation, reasoning_content should be preserved
			const result = convertToR1Format(input, false)

			expect(result[1]).toHaveProperty("reasoning_content")
			expect((result[1] as any).reasoning_content).toBe("I need to get the weather")
		})

		it("should clear reasoning_content for new turns (default behavior)", () => {
			const input: any[] = [
				{ role: "user", content: "First question" },
				{
					role: "assistant",
					content: "First answer",
					reasoning_content: "Reasoning for first",
				},
				{ role: "user", content: "Second question" },
			]

			// New turn - reasoning_content should be cleared
			const result = convertToR1Format(input, true)

			expect(result[1]).not.toHaveProperty("reasoning_content")
		})
	})
})
