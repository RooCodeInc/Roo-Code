import type { Anthropic } from "@anthropic-ai/sdk"
import { convertToResponsesApiInput } from "../responses-api-input"

describe("convertToResponsesApiInput", () => {
	it("should return empty array for empty messages", () => {
		expect(convertToResponsesApiInput([])).toEqual([])
	})

	describe("string content messages", () => {
		it("should convert string content to input_text", () => {
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([{ role: "user", content: [{ type: "input_text", text: "Hello" }] }])
		})

		it("should convert assistant string content to output_text message format", () => {
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "assistant", content: "Hi there" }]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([
				{
					type: "message",
					role: "assistant",
					content: [{ type: "output_text", text: "Hi there" }],
				},
			])
		})
	})

	describe("user messages with content blocks", () => {
		it("should convert text blocks to input_text", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [{ type: "text", text: "What is this?" }],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([{ role: "user", content: [{ type: "input_text", text: "What is this?" }] }])
		})

		it("should convert image blocks to input_image", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "image",
							source: { type: "base64", media_type: "image/png", data: "abc123" },
						},
					],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([
				{
					role: "user",
					content: [
						{
							type: "input_image",
							detail: "auto",
							image_url: "data:image/png;base64,abc123",
						},
					],
				},
			])
		})

		it("should convert tool_result to function_call_output", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool_123",
							content: "Result text",
						},
					],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([
				{
					type: "function_call_output",
					call_id: "tool_123",
					output: "Result text",
				},
			])
		})

		it("should use (empty) for empty tool_result content", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool_123",
							content: "",
						},
					],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([
				{
					type: "function_call_output",
					call_id: "tool_123",
					output: "(empty)",
				},
			])
		})

		it("should extract text from array tool_result content", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool_123",
							content: [
								{ type: "text", text: "Line 1" },
								{ type: "text", text: "Line 2" },
							],
						},
					],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([
				{
					type: "function_call_output",
					call_id: "tool_123",
					output: "Line 1\nLine 2",
				},
			])
		})

		it("should flush pending user content before tool_result", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "Here is context" },
						{
							type: "tool_result",
							tool_use_id: "tool_123",
							content: "Done",
						},
					],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([
				{ role: "user", content: [{ type: "input_text", text: "Here is context" }] },
				{ type: "function_call_output", call_id: "tool_123", output: "Done" },
			])
		})
	})

	describe("assistant messages with content blocks", () => {
		it("should convert text blocks to output_text messages", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [{ type: "text", text: "Here is my response" }],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([
				{
					type: "message",
					role: "assistant",
					content: [{ type: "output_text", text: "Here is my response" }],
				},
			])
		})

		it("should convert tool_use to function_call", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "call_abc",
							name: "read_file",
							input: { path: "/tmp/test.txt" },
						},
					],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([
				{
					type: "function_call",
					call_id: "call_abc",
					name: "read_file",
					arguments: '{"path":"/tmp/test.txt"}',
				},
			])
		})

		it("should handle tool_use with string input", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "call_abc",
							name: "run_command",
							input: '{"cmd":"ls"}' as any,
						},
					],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result[0]).toEqual(
				expect.objectContaining({
					type: "function_call",
					arguments: '{"cmd":"ls"}',
				}),
			)
		})

		it("should handle mixed text and tool_use in assistant message", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{ type: "text", text: "Let me read that file" },
						{
							type: "tool_use",
							id: "call_abc",
							name: "read_file",
							input: { path: "/tmp/test.txt" },
						},
					],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toHaveLength(2)
			expect(result[0]).toEqual(
				expect.objectContaining({
					type: "message",
					role: "assistant",
					content: [{ type: "output_text", text: "Let me read that file" }],
				}),
			)
			expect(result[1]).toEqual(
				expect.objectContaining({
					type: "function_call",
					name: "read_file",
				}),
			)
		})

		it("should not replay Anthropic thinking blocks as assistant-visible text", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{ type: "thinking", thinking: "SECRET_CHAIN_OF_THOUGHT", signature: "sig-1" } as any,
						{ type: "text", text: "visible answer" },
					],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toEqual([
				{
					type: "message",
					role: "assistant",
					content: [{ type: "output_text", text: "visible answer" }],
				},
			])
		})
	})

	describe("multi-turn conversations", () => {
		it("should handle a complete tool use cycle", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Read /tmp/test.txt" },
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "call_1",
							name: "read_file",
							input: { path: "/tmp/test.txt" },
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "call_1",
							content: "file contents here",
						},
					],
				},
				{
					role: "assistant",
					content: [{ type: "text", text: "The file contains: file contents here" }],
				},
			]

			const result = convertToResponsesApiInput(messages)

			expect(result).toHaveLength(4)
			expect(result[0]).toEqual({ role: "user", content: [{ type: "input_text", text: "Read /tmp/test.txt" }] })
			expect(result[1]).toEqual(
				expect.objectContaining({ type: "function_call", call_id: "call_1", name: "read_file" }),
			)
			expect(result[2]).toEqual(
				expect.objectContaining({
					type: "function_call_output",
					call_id: "call_1",
					output: "file contents here",
				}),
			)
			expect(result[3]).toEqual(
				expect.objectContaining({
					type: "message",
					role: "assistant",
				}),
			)
		})
	})
})
