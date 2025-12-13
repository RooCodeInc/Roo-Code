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

	describe("tool message handling", () => {
		it("should convert tool_use blocks to OpenAI tool_calls format", () => {
			const input: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Read the file test.txt" },
				{
					role: "assistant",
					content: [
						{ type: "text", text: "I'll read that file for you." },
						{
							type: "tool_use",
							id: "tool-123",
							name: "read_file",
							input: { path: "test.txt" },
						},
					],
				},
			]

			const result = convertToR1Format(input)

			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({ role: "user", content: "Read the file test.txt" })

			const assistantMsg = result[1] as OpenAI.Chat.ChatCompletionAssistantMessageParam
			expect(assistantMsg.role).toBe("assistant")
			expect(assistantMsg.content).toBe("I'll read that file for you.")
			expect(assistantMsg.tool_calls).toHaveLength(1)
			expect(assistantMsg.tool_calls![0]).toEqual({
				id: "tool-123",
				type: "function",
				function: {
					name: "read_file",
					arguments: '{"path":"test.txt"}',
				},
			})
		})

		it("should convert tool_result blocks to OpenAI tool messages", () => {
			const input: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-123",
							content: "File contents: Hello World",
						},
					],
				},
			]

			const result = convertToR1Format(input)

			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				role: "tool",
				tool_call_id: "tool-123",
				content: "File contents: Hello World",
			})
		})

		it("should handle tool_result with array content", () => {
			const input: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-456",
							content: [
								{ type: "text", text: "Line 1" },
								{ type: "text", text: "Line 2" },
							],
						},
					],
				},
			]

			const result = convertToR1Format(input)

			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				role: "tool",
				tool_call_id: "tool-456",
				content: "Line 1\nLine 2",
			})
		})

		it("should handle multiple tool_use blocks in one message", () => {
			const input: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{ type: "text", text: "I'll read both files." },
						{
							type: "tool_use",
							id: "tool-1",
							name: "read_file",
							input: { path: "file1.txt" },
						},
						{
							type: "tool_use",
							id: "tool-2",
							name: "read_file",
							input: { path: "file2.txt" },
						},
					],
				},
			]

			const result = convertToR1Format(input)

			expect(result).toHaveLength(1)
			const assistantMsg = result[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam
			expect(assistantMsg.tool_calls).toHaveLength(2)
			expect(assistantMsg.tool_calls![0].id).toBe("tool-1")
			expect(assistantMsg.tool_calls![1].id).toBe("tool-2")
		})

		it("should handle multiple tool_result blocks in one message", () => {
			const input: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-1",
							content: "Contents of file1",
						},
						{
							type: "tool_result",
							tool_use_id: "tool-2",
							content: "Contents of file2",
						},
					],
				},
			]

			const result = convertToR1Format(input)

			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({
				role: "tool",
				tool_call_id: "tool-1",
				content: "Contents of file1",
			})
			expect(result[1]).toEqual({
				role: "tool",
				tool_call_id: "tool-2",
				content: "Contents of file2",
			})
		})

		it("should handle full conversation with tool calls and results", () => {
			const input: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "What's in test.txt?" },
				{
					role: "assistant",
					content: [
						{ type: "text", text: "Let me check that file." },
						{
							type: "tool_use",
							id: "tool-abc",
							name: "read_file",
							input: { path: "test.txt" },
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-abc",
							content: "Hello, World!",
						},
					],
				},
				{
					role: "assistant",
					content: "The file test.txt contains: Hello, World!",
				},
			]

			const result = convertToR1Format(input)

			expect(result).toHaveLength(4)

			// User message
			expect(result[0]).toEqual({ role: "user", content: "What's in test.txt?" })

			// Assistant with tool call
			const assistantMsg = result[1] as OpenAI.Chat.ChatCompletionAssistantMessageParam
			expect(assistantMsg.role).toBe("assistant")
			expect(assistantMsg.content).toBe("Let me check that file.")
			expect(assistantMsg.tool_calls).toHaveLength(1)
			expect(assistantMsg.tool_calls![0].id).toBe("tool-abc")

			// Tool result
			expect(result[2]).toEqual({
				role: "tool",
				tool_call_id: "tool-abc",
				content: "Hello, World!",
			})

			// Final assistant response
			expect(result[3]).toEqual({
				role: "assistant",
				content: "The file test.txt contains: Hello, World!",
			})
		})

		it("should handle tool_result mixed with text content", () => {
			const input: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-123",
							content: "Tool output here",
						},
						{ type: "text", text: "Also, here is some additional context." },
					],
				},
			]

			const result = convertToR1Format(input)

			// Tool results should come first, then user text
			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({
				role: "tool",
				tool_call_id: "tool-123",
				content: "Tool output here",
			})
			expect(result[1]).toEqual({
				role: "user",
				content: "Also, here is some additional context.",
			})
		})

		it("should not merge assistant messages after tool_calls", () => {
			const input: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-1",
							name: "test_tool",
							input: {},
						},
					],
				},
				{
					role: "assistant",
					content: "Follow-up text",
				},
			]

			const result = convertToR1Format(input)

			// Should NOT merge because first message has tool_calls
			expect(result).toHaveLength(2)
			expect((result[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam).tool_calls).toBeDefined()
			expect(result[1]).toEqual({
				role: "assistant",
				content: "Follow-up text",
			})
		})

		it("should handle tool_use without text content", () => {
			const input: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-only",
							name: "some_tool",
							input: { key: "value" },
						},
					],
				},
			]

			const result = convertToR1Format(input)

			expect(result).toHaveLength(1)
			const assistantMsg = result[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam
			expect(assistantMsg.role).toBe("assistant")
			expect(assistantMsg.content).toBeNull()
			expect(assistantMsg.tool_calls).toHaveLength(1)
		})
	})
})
