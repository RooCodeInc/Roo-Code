import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { promises as fs } from "node:fs"
import { QwenCodeHandler } from "../qwen-code"
import type { ApiHandlerCreateMessageMetadata } from "../../index"

// Mock the file system
vi.mock("node:fs", () => ({
	promises: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
}))

// Mock OpenAI
vi.mock("openai")

describe("QwenCodeHandler", () => {
	let handler: QwenCodeHandler
	let mockCreate: ReturnType<typeof vi.fn>
	let mockReadFile: ReturnType<typeof vi.fn>

	const mockCredentials = {
		access_token: "test-access-token",
		refresh_token: "test-refresh-token",
		token_type: "Bearer",
		expiry_date: Date.now() + 3600000, // 1 hour from now
	}

	beforeEach(() => {
		mockCreate = vi.fn()
		mockReadFile = vi.mocked(fs.readFile)

		// Mock credentials file read
		mockReadFile.mockResolvedValue(JSON.stringify(mockCredentials))

		// Mock OpenAI client
		vi.mocked(OpenAI).mockImplementation(
			() =>
				({
					chat: {
						completions: {
							create: mockCreate,
						},
					},
					apiKey: "",
					baseURL: "",
				}) as any,
		)

		handler = new QwenCodeHandler({
			qwenCodeOauthPath: "/test/credentials.json",
			apiModelId: "qwen3-coder-plus",
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("tool calling", () => {
		it("should include tools in request when provided in metadata", async () => {
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Help me with something" }]

			const mockTools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get weather information",
						parameters: {
							type: "object",
							properties: {
								location: { type: "string" },
							},
							required: ["location"],
						},
					},
				},
			]

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
			}

			// Mock stream response
			mockCreate.mockImplementation(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Test response" } }],
						usage: { prompt_tokens: 10, completion_tokens: 20 },
					}
				},
			}))

			const stream = handler.createMessage(systemPrompt, messages, metadata)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify tools were passed to OpenAI with conversion
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.arrayContaining([
						expect.objectContaining({
							type: "function",
							function: expect.objectContaining({
								name: "get_weather",
								description: "Get weather information",
							}),
						}),
					]),
					parallel_tool_calls: false,
				}),
			)
		})

		it("should include tool_choice when provided", async () => {
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Help me with something" }]

			const mockTools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get weather information",
						parameters: {
							type: "object",
							properties: {
								location: { type: "string" },
							},
							required: ["location"],
						},
					},
				},
			]

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
				tool_choice: "auto",
			}

			// Mock stream response
			mockCreate.mockImplementation(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Test response" } }],
						usage: { prompt_tokens: 10, completion_tokens: 20 },
					}
				},
			}))

			const stream = handler.createMessage(systemPrompt, messages, metadata)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify tool_choice was passed to OpenAI
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					tool_choice: "auto",
				}),
			)
		})

		it("should yield tool_call_partial chunks when streaming tool calls", async () => {
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "What's the weather?" }]

			const mockTools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get weather information",
						parameters: {
							type: "object",
							properties: {
								location: { type: "string" },
							},
							required: ["location"],
						},
					},
				},
			]

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
			}

			// Mock stream response with tool calls
			mockCreate.mockImplementation(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [
							{
								delta: {
									tool_calls: [
										{
											index: 0,
											id: "call_1",
											function: {
												name: "get_weather",
												arguments: '{"location":',
											},
										},
									],
								},
							},
						],
					}
					yield {
						choices: [
							{
								delta: {
									tool_calls: [
										{
											index: 0,
											function: {
												arguments: '"New York"}',
											},
										},
									],
								},
							},
						],
					}
					yield {
						choices: [{ delta: {} }],
						usage: { prompt_tokens: 10, completion_tokens: 20 },
					}
				},
			}))

			const stream = handler.createMessage(systemPrompt, messages, metadata)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify tool_call_partial chunks were yielded
			const toolCallChunks = chunks.filter((chunk) => chunk.type === "tool_call_partial")
			expect(toolCallChunks).toHaveLength(2)

			expect(toolCallChunks[0]).toEqual({
				type: "tool_call_partial",
				index: 0,
				id: "call_1",
				name: "get_weather",
				arguments: '{"location":',
			})

			expect(toolCallChunks[1]).toEqual({
				type: "tool_call_partial",
				index: 0,
				id: undefined,
				name: undefined,
				arguments: '"New York"}',
			})
		})

		it("should set parallel_tool_calls when specified", async () => {
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Help me with multiple things" },
			]

			const mockTools = [
				{
					type: "function" as const,
					function: {
						name: "tool1",
						description: "Tool 1",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
				parallelToolCalls: true,
			}

			// Mock stream response
			mockCreate.mockImplementation(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Test response" } }],
						usage: { prompt_tokens: 10, completion_tokens: 20 },
					}
				},
			}))

			const stream = handler.createMessage(systemPrompt, messages, metadata)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify parallel_tool_calls was set to true
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					parallel_tool_calls: true,
				}),
			)
		})

		it("should not include tools when toolProtocol is not native", async () => {
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Help me with something" }]

			const mockTools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get weather information",
						parameters: {
							type: "object",
							properties: {
								location: { type: "string" },
							},
							required: ["location"],
						},
					},
				},
			]

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "xml", // XML protocol, tools should not be included
			}

			// Mock stream response
			mockCreate.mockImplementation(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Test response" } }],
						usage: { prompt_tokens: 10, completion_tokens: 20 },
					}
				},
			}))

			const stream = handler.createMessage(systemPrompt, messages, metadata)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify tools were NOT passed to OpenAI for XML protocol
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("tools")
			expect(callArgs).not.toHaveProperty("tool_choice")
			expect(callArgs).not.toHaveProperty("parallel_tool_calls")
		})
	})

	describe("getModel", () => {
		it("should return correct model info", () => {
			const model = handler.getModel()
			expect(model.id).toBe("qwen3-coder-plus")
			expect(model.info).toMatchObject({
				maxTokens: 65536,
				contextWindow: 1000000,
				supportsNativeTools: true,
			})
		})
	})
})
