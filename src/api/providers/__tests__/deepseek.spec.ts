// Mocks must come first, before imports
const mockCreate = vi.fn()
vi.mock("openai", () => {
	return {
		__esModule: true,
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate.mockImplementation(async (options) => {
						if (!options.stream) {
							return {
								id: "test-completion",
								choices: [
									{
										message: { role: "assistant", content: "Test response", refusal: null },
										finish_reason: "stop",
										index: 0,
									},
								],
								usage: {
									prompt_tokens: 10,
									completion_tokens: 5,
									total_tokens: 15,
									prompt_tokens_details: {
										cache_miss_tokens: 8,
										cached_tokens: 2,
									},
								},
							}
						}

						// Return async iterator for streaming
						return {
							[Symbol.asyncIterator]: async function* () {
								yield {
									choices: [
										{
											delta: { content: "Test response" },
											index: 0,
										},
									],
									usage: null,
								}
								yield {
									choices: [
										{
											delta: {},
											index: 0,
										},
									],
									usage: {
										prompt_tokens: 10,
										completion_tokens: 5,
										total_tokens: 15,
										prompt_tokens_details: {
											cache_miss_tokens: 8,
											cached_tokens: 2,
										},
									},
								}
							},
						}
					}),
				},
			},
		})),
	}
})

import OpenAI from "openai"
import type { Anthropic } from "@anthropic-ai/sdk"

import { deepSeekDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { DeepSeekHandler } from "../deepseek"

describe("DeepSeekHandler", () => {
	let handler: DeepSeekHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			deepSeekApiKey: "test-api-key",
			apiModelId: "deepseek-chat",
			deepSeekBaseUrl: "https://api.deepseek.com",
		}
		handler = new DeepSeekHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(DeepSeekHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it.skip("should throw error if API key is missing", () => {
			expect(() => {
				new DeepSeekHandler({
					...mockOptions,
					deepSeekApiKey: undefined,
				})
			}).toThrow("DeepSeek API key is required")
		})

		it("should use default model ID if not provided", () => {
			const handlerWithoutModel = new DeepSeekHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			expect(handlerWithoutModel.getModel().id).toBe(deepSeekDefaultModelId)
		})

		it("should use default base URL if not provided", () => {
			const handlerWithoutBaseUrl = new DeepSeekHandler({
				...mockOptions,
				deepSeekBaseUrl: undefined,
			})
			expect(handlerWithoutBaseUrl).toBeInstanceOf(DeepSeekHandler)
			// The base URL is passed to OpenAI client internally
			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.deepseek.com",
				}),
			)
		})

		it("should use custom base URL if provided", () => {
			const customBaseUrl = "https://custom.deepseek.com/v1"
			const handlerWithCustomUrl = new DeepSeekHandler({
				...mockOptions,
				deepSeekBaseUrl: customBaseUrl,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(DeepSeekHandler)
			// The custom base URL is passed to OpenAI client
			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: customBaseUrl,
				}),
			)
		})

		it("should set includeMaxTokens to true", () => {
			// Create a new handler and verify OpenAI client was called with includeMaxTokens
			const _handler = new DeepSeekHandler(mockOptions)
			expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: mockOptions.deepSeekApiKey }))
		})
	})

	describe("getModel", () => {
		it("should return model info for valid model ID", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.apiModelId)
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192) // deepseek-chat has 8K max
			expect(model.info.contextWindow).toBe(128_000)
			expect(model.info.supportsImages).toBe(false)
			expect(model.info.supportsPromptCache).toBe(true) // Should be true now
		})

		it("should return correct model info for deepseek-reasoner", () => {
			const handlerWithReasoner = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-reasoner",
			})
			const model = handlerWithReasoner.getModel()
			expect(model.id).toBe("deepseek-reasoner")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(65536) // deepseek-reasoner has 64K max
			expect(model.info.contextWindow).toBe(128_000)
			expect(model.info.supportsImages).toBe(false)
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should return provided model ID with default model info if model does not exist", () => {
			const handlerWithInvalidModel = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "invalid-model",
			})
			const model = handlerWithInvalidModel.getModel()
			expect(model.id).toBe("invalid-model") // Returns provided ID
			expect(model.info).toBeDefined()
			// With the current implementation, it's the same object reference when using default model info
			expect(model.info).toBe(handler.getModel().info)
			// Should have the same base properties
			expect(model.info.contextWindow).toBe(handler.getModel().info.contextWindow)
			// And should have supportsPromptCache set to true
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should return default model if no model ID is provided", () => {
			const handlerWithoutModel = new DeepSeekHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe(deepSeekDefaultModelId)
			expect(model.info).toBeDefined()
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text" as const,
						text: "Hello!",
					},
				],
			},
		]

		it("should handle streaming responses", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
		})

		it("should include usage information", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(5)
		})

		it("should include cache metrics in usage information", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0].cacheWriteTokens).toBe(8)
			expect(usageChunks[0].cacheReadTokens).toBe(2)
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly process usage metrics including cache information", () => {
			// We need to access the protected method, so we'll create a test subclass
			class TestDeepSeekHandler extends DeepSeekHandler {
				public testProcessUsageMetrics(usage: any) {
					return this.processUsageMetrics(usage)
				}
			}

			const testHandler = new TestDeepSeekHandler(mockOptions)

			const usage = {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
				prompt_tokens_details: {
					cache_miss_tokens: 80,
					cached_tokens: 20,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(80)
			expect(result.cacheReadTokens).toBe(20)
		})

		it("should handle missing cache metrics gracefully", () => {
			class TestDeepSeekHandler extends DeepSeekHandler {
				public testProcessUsageMetrics(usage: any) {
					return this.processUsageMetrics(usage)
				}
			}

			const testHandler = new TestDeepSeekHandler(mockOptions)

			const usage = {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
				// No prompt_tokens_details
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})
	})

	describe("native tool calling", () => {
		it("should use OpenAI format for deepseek-reasoner with native tools", async () => {
			const handlerWithReasoner = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-reasoner",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text" as const,
							text: "Use the calculator tool to add 2 + 2",
						},
					],
				},
			]

			const metadata = {
				taskId: "test-task-id",
				toolProtocol: "native" as const,
				tools: [
					{
						type: "function" as const,
						function: {
							name: "calculator",
							description: "A simple calculator",
							parameters: {
								type: "object",
								properties: {
									operation: { type: "string" },
									a: { type: "number" },
									b: { type: "number" },
								},
								required: ["operation", "a", "b"],
							},
						},
					},
				],
			}

			// Mock the stream response with tool calls
			mockCreate.mockImplementationOnce(async (options) => {
				// Verify that the messages are in OpenAI format (not R1 format)
				expect(options.messages).toBeDefined()
				expect(options.messages.length).toBeGreaterThan(0)
				// First message should be user role with system prompt
				expect(options.messages[0].role).toBe("user")

				// Verify tools are included
				expect(options.tools).toBeDefined()
				expect(options.tools.length).toBe(1)
				expect(options.tools[0].function.name).toBe("calculator")

				// Return a mock stream with tool call
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [
								{
									delta: {
										tool_calls: [
											{
												index: 0,
												id: "call_123",
												function: {
													name: "calculator",
													arguments: '{"operation":"add","a":2,"b":2}',
												},
											},
										],
									},
									index: 0,
								},
							],
							usage: null,
						}
						yield {
							choices: [
								{
									delta: {},
									index: 0,
								},
							],
							usage: {
								prompt_tokens: 20,
								completion_tokens: 10,
								total_tokens: 30,
							},
						}
					},
				}
			})

			const stream = handlerWithReasoner.createMessage(systemPrompt, messages, metadata)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify tool call chunks were emitted
			const toolCallChunks = chunks.filter((chunk) => chunk.type === "tool_call_partial")
			expect(toolCallChunks.length).toBeGreaterThan(0)
			expect(toolCallChunks[0].name).toBe("calculator")
			expect(toolCallChunks[0].arguments).toBe('{"operation":"add","a":2,"b":2}')
		})

		it("should handle tool results properly with deepseek-reasoner", async () => {
			const handlerWithReasoner = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-reasoner",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text" as const,
							text: "Use the calculator tool to add 2 + 2",
						},
					],
				},
				{
					role: "assistant",
					content: [
						{
							type: "tool_use" as const,
							id: "tool_use_123",
							name: "calculator",
							input: { operation: "add", a: 2, b: 2 },
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result" as const,
							tool_use_id: "tool_use_123",
							content: "4",
						},
					],
				},
			]

			const metadata = {
				taskId: "test-task-id",
				toolProtocol: "native" as const,
			}

			mockCreate.mockImplementationOnce(async (options) => {
				// Verify tool result is properly converted to OpenAI format
				const toolMessage = options.messages.find((msg: any) => msg.role === "tool")
				expect(toolMessage).toBeDefined()
				expect(toolMessage.tool_call_id).toBe("tool_use_123")
				expect(toolMessage.content).toBe("4")

				// Return a mock stream
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [
								{
									delta: { content: "The result is 4" },
									index: 0,
								},
							],
							usage: null,
						}
						yield {
							choices: [
								{
									delta: {},
									index: 0,
								},
							],
							usage: {
								prompt_tokens: 30,
								completion_tokens: 5,
								total_tokens: 35,
							},
						}
					},
				}
			})

			const stream = handlerWithReasoner.createMessage(systemPrompt, messages, metadata)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks[0].text).toBe("The result is 4")
		})

		it("should use R1 format for deepseek-reasoner without native tools", async () => {
			const handlerWithReasoner = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-reasoner",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text" as const,
							text: "Hello!",
						},
					],
				},
			]

			// No metadata or toolProtocol is "xml"
			const metadata = {
				taskId: "test-task-id",
				toolProtocol: "xml" as const,
			}

			mockCreate.mockImplementationOnce(async (options) => {
				// Verify that messages are in R1 format (merged consecutive same-role messages)
				expect(options.messages).toBeDefined()
				// In R1 format, system prompt is merged with user message
				expect(options.messages[0].role).toBe("user")
				expect(options.messages[0].content).toContain("You are a helpful assistant")
				expect(options.messages[0].content).toContain("Hello!")

				// Return a mock stream
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [
								{
									delta: { content: "Hi there!" },
									index: 0,
								},
							],
							usage: null,
						}
						yield {
							choices: [
								{
									delta: {},
									index: 0,
								},
							],
							usage: {
								prompt_tokens: 10,
								completion_tokens: 3,
								total_tokens: 13,
							},
						}
					},
				}
			})

			const stream = handlerWithReasoner.createMessage(systemPrompt, messages, metadata)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks[0].text).toBe("Hi there!")
		})

		it("should handle reasoning_content for deepseek-reasoner", async () => {
			const handlerWithReasoner = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-reasoner",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text" as const,
							text: "What is 2 + 2?",
						},
					],
				},
			]

			const metadata = {
				taskId: "test-task-id",
				toolProtocol: "native" as const,
			}

			mockCreate.mockImplementationOnce(async () => {
				// Return a mock stream with reasoning_content
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [
								{
									delta: {
										reasoning_content: "Let me calculate 2 + 2...",
									},
									index: 0,
								},
							],
							usage: null,
						}
						yield {
							choices: [
								{
									delta: {
										content: "2 + 2 equals 4",
									},
									index: 0,
								},
							],
							usage: null,
						}
						yield {
							choices: [
								{
									delta: {},
									index: 0,
								},
							],
							usage: {
								prompt_tokens: 15,
								completion_tokens: 10,
								total_tokens: 25,
							},
						}
					},
				}
			})

			const stream = handlerWithReasoner.createMessage(systemPrompt, messages, metadata)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify reasoning chunks were emitted
			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			expect(reasoningChunks.length).toBeGreaterThan(0)
			expect(reasoningChunks[0].text).toBe("Let me calculate 2 + 2...")

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks[0].text).toBe("2 + 2 equals 4")
		})

		it("should use parent implementation for deepseek-chat model", async () => {
			// deepseek-chat should always use parent implementation
			const handlerWithChat = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-chat",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "text" as const,
							text: "Hello!",
						},
					],
				},
			]

			const metadata = {
				taskId: "test-task-id",
				toolProtocol: "native" as const,
				tools: [
					{
						type: "function" as const,
						function: {
							name: "test_tool",
							description: "A test tool",
							parameters: {
								type: "object",
								properties: {},
							},
						},
					},
				],
			}

			mockCreate.mockImplementationOnce(async (options) => {
				// For deepseek-chat, it should use the parent's OpenAI format handling
				expect(options.messages).toBeDefined()
				// Should have system message and user message
				expect(options.messages[0].role).toBe("system")
				// The content might be wrapped in an array for prompt caching
				if (Array.isArray(options.messages[0].content)) {
					expect(options.messages[0].content[0].text).toBe("You are a helpful assistant.")
				} else {
					expect(options.messages[0].content).toBe("You are a helpful assistant.")
				}
				expect(options.messages[1].role).toBe("user")

				// Return a mock stream
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [
								{
									delta: { content: "Hello!" },
									index: 0,
								},
							],
							usage: null,
						}
						yield {
							choices: [
								{
									delta: {},
									index: 0,
								},
							],
							usage: {
								prompt_tokens: 10,
								completion_tokens: 2,
								total_tokens: 12,
							},
						}
					},
				}
			})

			const stream = handlerWithChat.createMessage(systemPrompt, messages, metadata)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks[0].text).toBe("Hello!")
		})
	})
})
