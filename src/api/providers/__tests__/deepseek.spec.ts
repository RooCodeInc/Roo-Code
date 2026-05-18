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

						// Check if this is a reasoning_content test by looking at model
						const isReasonerModel = options.model?.includes("deepseek-v4")
						const isToolCallTest = options.tools?.length > 0

						// Return async iterator for streaming
						return {
							[Symbol.asyncIterator]: async function* () {
								// For reasoner models, emit reasoning_content first
								if (isReasonerModel) {
									yield {
										choices: [
											{
												delta: { reasoning_content: "Let me think about this..." },
												index: 0,
											},
										],
										usage: null,
									}
									yield {
										choices: [
											{
												delta: { reasoning_content: " I'll analyze step by step." },
												index: 0,
											},
										],
										usage: null,
									}
								}

								// For tool call tests with reasoner, emit tool call
								if (isReasonerModel && isToolCallTest) {
									yield {
										choices: [
											{
												delta: {
													tool_calls: [
														{
															index: 0,
															id: "call_123",
															function: {
																name: "get_weather",
																arguments: '{"location":"SF"}',
															},
														},
													],
												},
												index: 0,
											},
										],
										usage: null,
									}
								} else {
									yield {
										choices: [
											{
												delta: { content: "Test response" },
												index: 0,
											},
										],
										usage: null,
									}
								}

								yield {
									choices: [
										{
											delta: {},
											index: 0,
											finish_reason: isToolCallTest ? "tool_calls" : "stop",
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

import { deepSeekDefaultModelId, deepSeekModels, DEEP_SEEK_DEFAULT_TEMPERATURE, type ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { DeepSeekHandler } from "../deepseek"

describe("DeepSeekHandler", () => {
	let handler: DeepSeekHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			deepSeekApiKey: "test-api-key",
			apiModelId: "deepseek-v4-flash",
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
			expect(model.info.maxTokens).toBe(384_000)
			expect(model.info.contextWindow).toBe(1_000_000)
			expect(model.info.supportsImages).toBe(false)
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it.each([
			["deepseek-v4-flash", deepSeekModels["deepseek-v4-flash"]],
			["deepseek-v4-pro", deepSeekModels["deepseek-v4-pro"]],
		])("should return correct model info for %s", (modelId, expectedInfo) => {
			const handlerWithV4 = new DeepSeekHandler({
				...mockOptions,
				apiModelId: modelId,
			})

			const model = handlerWithV4.getModel()
			const info = model.info as ModelInfo

			expect(model.id).toBe(modelId)
			expect(info.maxTokens).toBe(384_000)
			expect(info.contextWindow).toBe(1_000_000)
			expect(info.supportsPromptCache).toBe(true)
			expect(info.preserveReasoning).toBe(true)
			expect(info.supportsReasoningEffort).toEqual(["disable", "high", "xhigh"])
			expect(info.reasoningEffort).toBe("high")
			expect(model.info).toBe(expectedInfo)
		})

		it("should have preserveReasoning enabled for DeepSeek V4 models to support interleaved thinking", () => {
			// This is critical for DeepSeek's interleaved thinking mode with tool calls.
			// See: https://api-docs.deepseek.com/guides/thinking_mode
			// The reasoning_content needs to be passed back during tool call continuation
			// within the same turn for the model to continue reasoning properly.
			const handlerWithV4 = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-v4-pro",
			})
			const model = handlerWithV4.getModel()
			// Cast to ModelInfo to access preserveReasoning which is an optional property
			expect((model.info as ModelInfo).preserveReasoning).toBe(true)
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

		it("should use DEEP_SEEK_DEFAULT_TEMPERATURE as the default temperature", () => {
			const model = handler.getModel()
			expect(model.temperature).toBe(DEEP_SEEK_DEFAULT_TEMPERATURE)
		})

		it("should respect user-provided temperature over DEEP_SEEK_DEFAULT_TEMPERATURE", () => {
			const handlerWithTemp = new DeepSeekHandler({
				...mockOptions,
				modelTemperature: 0.9,
			})
			const model = handlerWithTemp.getModel()
			expect(model.temperature).toBe(0.9)
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

	describe("interleaved thinking mode", () => {
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

		it("should handle reasoning_content in streaming responses for DeepSeek V4", async () => {
			const reasonerHandler = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-v4-pro",
			})

			const stream = reasonerHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have reasoning chunks
			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			expect(reasoningChunks.length).toBeGreaterThan(0)
			expect(reasoningChunks[0].text).toBe("Let me think about this...")
			expect(reasoningChunks[1].text).toBe(" I'll analyze step by step.")
		})

		it("should preserve empty reasoning_content chunks for DeepSeek V4", async () => {
			mockCreate.mockImplementationOnce(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [
							{
								delta: { reasoning_content: "" },
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
								finish_reason: "stop",
							},
						],
						usage: {
							prompt_tokens: 10,
							completion_tokens: 5,
							total_tokens: 15,
						},
					}
				},
			}))

			const reasonerHandler = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-v4-pro",
			})

			const chunks: any[] = []
			for await (const chunk of reasonerHandler.createMessage(systemPrompt, messages)) {
				chunks.push(chunk)
			}

			expect(chunks.filter((chunk) => chunk.type === "reasoning")).toContainEqual({
				type: "reasoning",
				text: "",
			})
		})

		it("should pass thinking parameter for DeepSeek V4 models", async () => {
			const reasonerHandler = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-v4-pro",
			})

			const stream = reasonerHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			// Verify that the thinking parameter was passed to the API
			// Note: mockCreate receives two arguments - request options and path options
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					thinking: { type: "enabled" },
				}),
				{}, // Empty path options for non-Azure URLs
			)
		})

		it("should pass reasoning parameters for DeepSeek V4 models", async () => {
			const v4Handler = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-v4-flash",
				enableReasoningEffort: true,
				reasoningEffort: "high",
			})

			const stream = v4Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.thinking).toEqual({ type: "enabled" })
			expect(callArgs.reasoning_effort).toBe("high")
		})

		it("should map xhigh reasoning effort to DeepSeek max", async () => {
			const v4Handler = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-v4-pro",
				enableReasoningEffort: true,
				reasoningEffort: "xhigh",
			})

			const stream = v4Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.thinking).toEqual({ type: "enabled" })
			expect(callArgs.reasoning_effort).toBe("max")
		})

		it("should disable thinking for DeepSeek V4 when reasoning effort is disabled", async () => {
			const v4Handler = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-v4-flash",
				enableReasoningEffort: true,
				reasoningEffort: "disable",
			})

			const stream = v4Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.thinking).toEqual({ type: "disabled" })
			expect(callArgs.reasoning_effort).toBeUndefined()
		})

		it("should add empty reasoning_content to old tool calls when thinking is re-enabled", async () => {
			const v4Handler = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-v4-pro",
				enableReasoningEffort: true,
				reasoningEffort: "high",
			})

			const priorMessages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "call_without_reasoning",
							name: "read_file",
							input: { path: "memory.md" },
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "call_without_reasoning",
							content: "ok",
						},
					],
				},
			]

			const stream = v4Handler.createMessage(systemPrompt, priorMessages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			const callArgs = mockCreate.mock.calls[0][0]
			const assistantWithToolCall = callArgs.messages.find((message: any) => message.role === "assistant")
			expect(callArgs.thinking).toEqual({ type: "enabled" })
			expect(assistantWithToolCall.reasoning_content).toBe("")
		})

		it("should handle tool calls with reasoning_content", async () => {
			const reasonerHandler = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-v4-pro",
			})

			const tools: any[] = [
				{
					type: "function",
					function: {
						name: "get_weather",
						description: "Get weather",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const stream = reasonerHandler.createMessage(systemPrompt, messages, { taskId: "test", tools })
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have reasoning chunks
			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			expect(reasoningChunks.length).toBeGreaterThan(0)

			// Should have tool call chunks
			const toolCallChunks = chunks.filter((chunk) => chunk.type === "tool_call_partial")
			expect(toolCallChunks.length).toBeGreaterThan(0)
			expect(toolCallChunks[0].name).toBe("get_weather")
		})
	})
})
