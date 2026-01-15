import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { convertToAiSdkMessages, convertToolsForAiSdk, processAiSdkStreamPart } from "../ai-sdk"

vitest.mock("ai", () => ({
	tool: vitest.fn((t) => t),
	jsonSchema: vitest.fn((s) => s),
}))

describe("AI SDK conversion utilities", () => {
	describe("convertToAiSdkMessages", () => {
		it("converts simple string messages", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
			]

			const result = convertToAiSdkMessages(messages)

			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({ role: "user", content: "Hello" })
			expect(result[1]).toEqual({ role: "assistant", content: "Hi there" })
		})

		it("converts user messages with text content blocks", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [{ type: "text", text: "Hello world" }],
				},
			]

			const result = convertToAiSdkMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				role: "user",
				content: [{ type: "text", text: "Hello world" }],
			})
		})

		it("converts user messages with image content", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "What is in this image?" },
						{
							type: "image",
							source: {
								type: "base64",
								media_type: "image/png",
								data: "base64encodeddata",
							},
						},
					],
				},
			]

			const result = convertToAiSdkMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				role: "user",
				content: [
					{ type: "text", text: "What is in this image?" },
					{
						type: "image",
						image: "data:image/png;base64,base64encodeddata",
						mimeType: "image/png",
					},
				],
			})
		})

		it("converts tool results into separate tool messages", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "call_123",
							content: "Tool result content",
						},
					],
				},
			]

			const result = convertToAiSdkMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				role: "tool",
				content: [
					{
						type: "tool-result",
						toolCallId: "call_123",
						toolName: "",
						output: "Tool result content",
					},
				],
			})
		})

		it("converts assistant messages with tool use", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{ type: "text", text: "Let me read that file" },
						{
							type: "tool_use",
							id: "call_456",
							name: "read_file",
							input: { path: "test.ts" },
						},
					],
				},
			]

			const result = convertToAiSdkMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				role: "assistant",
				content: [
					{ type: "text", text: "Let me read that file" },
					{
						type: "tool-call",
						toolCallId: "call_456",
						toolName: "read_file",
						args: { path: "test.ts" },
					},
				],
			})
		})

		it("handles empty assistant content", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [],
				},
			]

			const result = convertToAiSdkMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				role: "assistant",
				content: [{ type: "text", text: "" }],
			})
		})
	})

	describe("convertToolsForAiSdk", () => {
		it("returns undefined for empty tools", () => {
			expect(convertToolsForAiSdk(undefined)).toBeUndefined()
			expect(convertToolsForAiSdk([])).toBeUndefined()
		})

		it("converts function tools to AI SDK format", () => {
			const tools: OpenAI.Chat.ChatCompletionTool[] = [
				{
					type: "function",
					function: {
						name: "read_file",
						description: "Read a file from disk",
						parameters: {
							type: "object",
							properties: {
								path: { type: "string", description: "File path" },
							},
							required: ["path"],
						},
					},
				},
			]

			const result = convertToolsForAiSdk(tools)

			expect(result).toBeDefined()
			expect(result!.read_file).toBeDefined()
			expect(result!.read_file.description).toBe("Read a file from disk")
		})

		it("converts multiple tools", () => {
			const tools: OpenAI.Chat.ChatCompletionTool[] = [
				{
					type: "function",
					function: {
						name: "read_file",
						description: "Read a file",
						parameters: {},
					},
				},
				{
					type: "function",
					function: {
						name: "write_file",
						description: "Write a file",
						parameters: {},
					},
				},
			]

			const result = convertToolsForAiSdk(tools)

			expect(result).toBeDefined()
			expect(Object.keys(result!)).toHaveLength(2)
			expect(result!.read_file).toBeDefined()
			expect(result!.write_file).toBeDefined()
		})
	})

	describe("processAiSdkStreamPart", () => {
		it("processes text-delta chunks", () => {
			const part = { type: "text-delta" as const, id: "1", text: "Hello" }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "text", text: "Hello" })
		})

		it("processes reasoning-delta chunks", () => {
			const part = { type: "reasoning-delta" as const, id: "1", text: "thinking..." }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "reasoning", text: "thinking..." })
		})

		it("processes tool-input-start chunks", () => {
			const part = { type: "tool-input-start" as const, id: "call_1", toolName: "read_file" }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "tool_call_start", id: "call_1", name: "read_file" })
		})

		it("processes tool-input-delta chunks", () => {
			const part = { type: "tool-input-delta" as const, id: "call_1", delta: '{"path":' }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "tool_call_delta", id: "call_1", delta: '{"path":' })
		})

		it("processes tool-input-end chunks", () => {
			const part = { type: "tool-input-end" as const, id: "call_1" }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "tool_call_end", id: "call_1" })
		})

		it("processes complete tool-call chunks", () => {
			const part = {
				type: "tool-call" as const,
				toolCallId: "call_1",
				toolName: "read_file",
				input: { path: "test.ts" },
			}
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({
				type: "tool_call",
				id: "call_1",
				name: "read_file",
				arguments: '{"path":"test.ts"}',
			})
		})

		it("processes source chunks with URL", () => {
			const part = {
				type: "source" as const,
				url: "https://example.com",
				title: "Example Source",
			}
			const chunks = [...processAiSdkStreamPart(part as any)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({
				type: "grounding",
				sources: [
					{
						title: "Example Source",
						url: "https://example.com",
						snippet: undefined,
					},
				],
			})
		})

		it("processes error chunks", () => {
			const part = { type: "error" as const, error: new Error("Test error") }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({
				type: "error",
				error: "StreamError",
				message: "Test error",
			})
		})

		it("ignores lifecycle events", () => {
			const lifecycleEvents = [
				{ type: "text-start" as const },
				{ type: "text-end" as const },
				{ type: "reasoning-start" as const },
				{ type: "reasoning-end" as const },
				{ type: "start-step" as const },
				{ type: "finish-step" as const },
				{ type: "start" as const },
				{ type: "finish" as const },
				{ type: "abort" as const },
			]

			for (const event of lifecycleEvents) {
				const chunks = [...processAiSdkStreamPart(event as any)]
				expect(chunks).toHaveLength(0)
			}
		})
	})
})
