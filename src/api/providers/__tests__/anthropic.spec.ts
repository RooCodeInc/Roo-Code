// npx vitest run src/api/providers/__tests__/anthropic.spec.ts

import { AnthropicHandler } from "../anthropic"
import { ApiHandlerOptions } from "../../../shared/api"

const mockCreate = vitest.fn()
const mockStream = vitest.fn()

// Helper to create a mock MessageStream object
function createMockMessageStream(events: any[], finalMessage?: any) {
	return {
		async *[Symbol.asyncIterator]() {
			for (const event of events) {
				yield event
			}
		},
		async finalMessage() {
			return (
				finalMessage || {
					id: "test-message",
					type: "message",
					role: "assistant",
					content: [],
					model: "test-model",
					stop_reason: "end_turn",
					usage: { input_tokens: 100, output_tokens: 50 },
				}
			)
		},
		abort() {},
	}
}

// Default stream events for standard tests
const defaultStreamEvents = [
	{
		type: "message_start",
		message: {
			usage: {
				input_tokens: 100,
				output_tokens: 50,
				cache_creation_input_tokens: 20,
				cache_read_input_tokens: 10,
			},
		},
	},
	{
		type: "content_block_start",
		index: 0,
		content_block: {
			type: "text",
			text: "Hello",
		},
	},
	{
		type: "content_block_delta",
		delta: {
			type: "text_delta",
			text: " world",
		},
	},
]

vitest.mock("@anthropic-ai/sdk", () => {
	const mockAnthropicConstructor = vitest.fn().mockImplementation(() => ({
		messages: {
			create: mockCreate.mockImplementation(async (options) => {
				if (!options.stream) {
					return {
						id: "test-completion",
						content: [{ type: "text", text: "Test response" }],
						role: "assistant",
						model: options.model,
						usage: {
							input_tokens: 10,
							output_tokens: 5,
						},
					}
				}
				// Legacy streaming via create() - shouldn't be used anymore
				return createMockMessageStream(defaultStreamEvents)
			}),
			stream: mockStream.mockImplementation((options) => {
				return createMockMessageStream(defaultStreamEvents)
			}),
		},
	}))

	return {
		Anthropic: mockAnthropicConstructor,
	}
})

// Import after mock
import { Anthropic } from "@anthropic-ai/sdk"

const mockAnthropicConstructor = vitest.mocked(Anthropic)

describe("AnthropicHandler", () => {
	let handler: AnthropicHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			apiKey: "test-api-key",
			apiModelId: "claude-3-5-sonnet-20241022",
		}
		handler = new AnthropicHandler(mockOptions)
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(AnthropicHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should initialize with undefined API key", () => {
			// The SDK will handle API key validation, so we just verify it initializes
			const handlerWithoutKey = new AnthropicHandler({
				...mockOptions,
				apiKey: undefined,
			})
			expect(handlerWithoutKey).toBeInstanceOf(AnthropicHandler)
		})

		it("should use custom base URL if provided", () => {
			const customBaseUrl = "https://custom.anthropic.com"
			const handlerWithCustomUrl = new AnthropicHandler({
				...mockOptions,
				anthropicBaseUrl: customBaseUrl,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(AnthropicHandler)
		})

		it("use apiKey for passing token if anthropicUseAuthToken is not set", () => {
			const handlerWithCustomUrl = new AnthropicHandler({
				...mockOptions,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(AnthropicHandler)
			expect(mockAnthropicConstructor).toHaveBeenCalledTimes(1)
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.apiKey).toEqual("test-api-key")
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.authToken).toBeUndefined()
		})

		it("use apiKey for passing token if anthropicUseAuthToken is set but custom base URL is not given", () => {
			const handlerWithCustomUrl = new AnthropicHandler({
				...mockOptions,
				anthropicUseAuthToken: true,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(AnthropicHandler)
			expect(mockAnthropicConstructor).toHaveBeenCalledTimes(1)
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.apiKey).toEqual("test-api-key")
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.authToken).toBeUndefined()
		})

		it("use authToken for passing token if both of anthropicBaseUrl and anthropicUseAuthToken are set", () => {
			const customBaseUrl = "https://custom.anthropic.com"
			const handlerWithCustomUrl = new AnthropicHandler({
				...mockOptions,
				anthropicBaseUrl: customBaseUrl,
				anthropicUseAuthToken: true,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(AnthropicHandler)
			expect(mockAnthropicConstructor).toHaveBeenCalledTimes(1)
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.authToken).toEqual("test-api-key")
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.apiKey).toBeUndefined()
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."

		it("should handle prompt caching for supported models", async () => {
			const stream = handler.createMessage(systemPrompt, [
				{
					role: "user",
					content: [{ type: "text" as const, text: "First message" }],
				},
				{
					role: "assistant",
					content: [{ type: "text" as const, text: "Response" }],
				},
				{
					role: "user",
					content: [{ type: "text" as const, text: "Second message" }],
				},
			])

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify usage information
			const usageChunk = chunks.find((chunk) => chunk.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.inputTokens).toBe(100)
			expect(usageChunk?.outputTokens).toBe(50)
			expect(usageChunk?.cacheWriteTokens).toBe(20)
			expect(usageChunk?.cacheReadTokens).toBe(10)

			// Verify text content
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Hello")
			expect(textChunks[1].text).toBe(" world")

			// Verify API - now using stream() instead of create()
			expect(mockStream).toHaveBeenCalled()
		})

		it("caps max_tokens using the thinking budget when it would exceed provider cap", async () => {
			// Provider cap for claude-3-7-sonnet-20250219:thinking is 128000
			// Set modelMaxTokens to 125000 so that 125000 + 8000 = 133000 > 128000
			// This forces the logic to reduce max_tokens to 128000 - 8000 = 120000
			const reasoningHandler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
				modelMaxTokens: 125_000,
				modelMaxThinkingTokens: 8_000,
			})

			const stream = reasoningHandler.createMessage(systemPrompt, [
				{
					role: "user",
					content: [{ type: "text" as const, text: "Hello" }],
				},
			])

			// Kick off the generator so the mocked client is invoked
			await stream.next()

			expect(mockStream).toHaveBeenCalledWith(
				expect.objectContaining({
					max_tokens: 120_000,
					thinking: expect.objectContaining({ budget_tokens: 8_000 }),
				}),
				expect.anything(),
			)

			await stream.return?.(undefined)
		})

		it("does not reduce max_tokens when sum is within provider cap", async () => {
			// Provider cap for claude-3-7-sonnet-20250219:thinking is 128000
			// 64000 + 8000 = 72000 < 128000, so no reduction needed
			const reasoningHandler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
				modelMaxTokens: 64_000,
				modelMaxThinkingTokens: 8_000,
			})

			const stream = reasoningHandler.createMessage(systemPrompt, [
				{
					role: "user",
					content: [{ type: "text" as const, text: "Hello" }],
				},
			])

			// Kick off the generator so the mocked client is invoked
			await stream.next()

			expect(mockStream).toHaveBeenCalledWith(
				expect.objectContaining({
					max_tokens: 64_000,
					thinking: expect.objectContaining({ budget_tokens: 8_000 }),
				}),
				expect.anything(),
			)

			await stream.return?.(undefined)
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockCreate).toHaveBeenCalledWith({
				model: mockOptions.apiModelId,
				messages: [{ role: "user", content: "Test prompt" }],
				max_tokens: 8192,
				temperature: 0,
				thinking: undefined,
				stream: false,
			})
		})

		it("should handle API errors", async () => {
			mockCreate.mockRejectedValueOnce(new Error("Anthropic completion error: API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("Anthropic completion error: API Error")
		})

		it("should handle non-text content", async () => {
			mockCreate.mockImplementationOnce(async () => ({
				content: [{ type: "image" }],
			}))
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should handle empty response", async () => {
			mockCreate.mockImplementationOnce(async () => ({
				content: [{ type: "text", text: "" }],
			}))
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})

	describe("getModel", () => {
		it("should return default model if no model ID is provided", () => {
			const handlerWithoutModel = new AnthropicHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBeDefined()
			expect(model.info).toBeDefined()
		})

		it("should return specified model if valid model ID is provided", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.apiModelId)
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("honors custom maxTokens for thinking models", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = handler.getModel()
			expect(result.maxTokens).toBe(32_768)
			expect(result.reasoningBudget).toEqual(16_384)
			expect(result.temperature).toBe(1.0)
		})

		it("does not honor custom maxTokens for non-thinking models", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = handler.getModel()
			expect(result.maxTokens).toBe(8192)
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0)
		})

		it("should handle Claude 4.5 Sonnet model correctly", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-sonnet-4-5",
			})
			const model = handler.getModel()
			expect(model.id).toBe("claude-sonnet-4-5")
			expect(model.info.maxTokens).toBe(64000)
			expect(model.info.contextWindow).toBe(200000)
			expect(model.info.supportsReasoningBudget).toBe(true)
		})

		it("should enable 1M context for Claude 4.5 Sonnet when beta flag is set", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-sonnet-4-5",
				anthropicBeta1MContext: true,
			})
			const model = handler.getModel()
			expect(model.info.contextWindow).toBe(1000000)
			expect(model.info.inputPrice).toBe(6.0)
			expect(model.info.outputPrice).toBe(22.5)
		})

		it("should use anthropicCustomModelInfo when provided with custom model name", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				anthropicBaseUrl: "https://custom.proxy.com",
				anthropicCustomModelName: "custom-opus-4.5",
				anthropicCustomModelInfo: {
					maxTokens: 64000,
					contextWindow: 200000,
					supportsImages: true,
					supportsPromptCache: true,
					supportsReasoningBudget: true,
					inputPrice: 5.0,
					outputPrice: 25.0,
				},
			})
			const model = handler.getModel()
			expect(model.id).toBe("custom-opus-4.5")
			expect(model.info.maxTokens).toBe(64000)
			expect(model.info.contextWindow).toBe(200000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
			expect(model.info.supportsReasoningBudget).toBe(true)
			expect(model.info.inputPrice).toBe(5.0)
			expect(model.info.outputPrice).toBe(25.0)
		})

		it("should enable thinking for custom models with supportsReasoningBudget in anthropicCustomModelInfo", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				anthropicCustomModelName: "custom-thinking-model",
				anthropicCustomModelInfo: {
					contextWindow: 200000,
					supportsPromptCache: true,
					supportsReasoningBudget: true,
				},
			})
			const model = handler.getModel()
			expect(model.betas).toContain("output-128k-2025-02-19")
			expect(model.reasoning).toBeDefined()
			expect(model.reasoning?.type).toBe("enabled")
		})

		it("should not enable thinking for custom models without supportsReasoningBudget", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				anthropicCustomModelName: "custom-no-thinking-model",
				anthropicCustomModelInfo: {
					contextWindow: 200000,
					supportsPromptCache: true,
					supportsReasoningBudget: false,
				},
			})
			const model = handler.getModel()
			expect(model.betas).toBeUndefined()
		})

		it("should fall back to preset model info when anthropicCustomModelInfo is not provided", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-sonnet-4-5",
			})
			const model = handler.getModel()
			expect(model.info.maxTokens).toBe(64000)
			expect(model.info.contextWindow).toBe(200000)
			expect(model.info.supportsReasoningBudget).toBe(true)
		})

		it("should require both customModelName and customModelInfo to use custom model info", () => {
			// Only customModelName without customModelInfo should fall back to preset
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-5-sonnet-20241022",
				anthropicCustomModelName: "custom-model",
			})
			const model = handler.getModel()
			// Should use the preset model info for claude-3-5-sonnet-20241022
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.supportsReasoningBudget).toBeUndefined()
		})
	})

	describe("reasoning block filtering", () => {
		const systemPrompt = "You are a helpful assistant."

		it("should filter out internal reasoning blocks before sending to API", async () => {
			handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-5-sonnet-20241022",
			})

			// Messages with internal reasoning blocks (from stored conversation history)
			const messagesWithReasoning: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello",
				},
				{
					role: "assistant",
					content: [
						{
							type: "reasoning" as any,
							text: "This is internal reasoning that should be filtered",
						},
						{
							type: "text",
							text: "This is the response",
						},
					],
				},
				{
					role: "user",
					content: "Continue",
				},
			]

			const stream = handler.createMessage(systemPrompt, messagesWithReasoning)
			const chunks: any[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify the API was called with filtered messages (no reasoning blocks)
			const calledMessages = mockStream.mock.calls[mockStream.mock.calls.length - 1][0].messages
			expect(calledMessages).toHaveLength(3)

			// Check assistant message - should have reasoning block filtered out
			const assistantMessage = calledMessages.find((m: any) => m.role === "assistant")
			expect(assistantMessage).toBeDefined()
			expect(assistantMessage.content).toEqual([{ type: "text", text: "This is the response" }])

			// Verify reasoning blocks were NOT sent to the API
			expect(assistantMessage.content).not.toContainEqual(expect.objectContaining({ type: "reasoning" }))
		})

		it("should filter empty messages after removing all reasoning blocks", async () => {
			handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-5-sonnet-20241022",
			})

			// Message with only reasoning content (should be completely filtered)
			const messagesWithOnlyReasoning: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello",
				},
				{
					role: "assistant",
					content: [
						{
							type: "reasoning" as any,
							text: "Only reasoning, no actual text",
						},
					],
				},
				{
					role: "user",
					content: "Continue",
				},
			]

			const stream = handler.createMessage(systemPrompt, messagesWithOnlyReasoning)
			const chunks: any[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify empty message was filtered out
			const calledMessages = mockStream.mock.calls[mockStream.mock.calls.length - 1][0].messages
			expect(calledMessages.length).toBe(2) // Only the two user messages
			expect(calledMessages.every((m: any) => m.role === "user")).toBe(true)
		})
	})

	describe("native tool calling", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "What's the weather in London?" }],
			},
		]

		const mockTools = [
			{
				type: "function" as const,
				function: {
					name: "get_weather",
					description: "Get the current weather",
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

		it("should include tools in request when toolProtocol is native", async () => {
			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
			})

			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
				// Just consume
			}

			expect(mockStream).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.arrayContaining([
						expect.objectContaining({
							name: "get_weather",
							description: "Get the current weather",
							input_schema: expect.objectContaining({
								type: "object",
								properties: expect.objectContaining({
									location: { type: "string" },
								}),
							}),
						}),
					]),
				}),
				expect.anything(),
			)
		})

		it("should not include tools when toolProtocol is xml", async () => {
			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "xml",
			})

			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
				// Just consume
			}

			expect(mockStream).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tools: expect.anything(),
				}),
				expect.anything(),
			)
		})

		it("should not include tools when no tools are provided", async () => {
			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				toolProtocol: "native",
			})

			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
				// Just consume
			}

			expect(mockStream).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tools: expect.anything(),
				}),
				expect.anything(),
			)
		})

		it("should convert tool_choice 'auto' to Anthropic format", async () => {
			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
				tool_choice: "auto",
			})

			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
				// Just consume
			}

			expect(mockStream).toHaveBeenCalledWith(
				expect.objectContaining({
					tool_choice: { type: "auto", disable_parallel_tool_use: true },
				}),
				expect.anything(),
			)
		})

		it("should convert tool_choice 'required' to Anthropic 'any' format", async () => {
			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
				tool_choice: "required",
			})

			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
				// Just consume
			}

			expect(mockStream).toHaveBeenCalledWith(
				expect.objectContaining({
					tool_choice: { type: "any", disable_parallel_tool_use: true },
				}),
				expect.anything(),
			)
		})

		it("should omit both tools and tool_choice when tool_choice is 'none'", async () => {
			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
				tool_choice: "none",
			})

			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
				// Just consume
			}

			// Verify that neither tools nor tool_choice are included in the request
			expect(mockStream).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tools: expect.anything(),
				}),
				expect.anything(),
			)
			expect(mockStream).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tool_choice: expect.anything(),
				}),
				expect.anything(),
			)
		})

		it("should convert specific tool_choice to Anthropic 'tool' format", async () => {
			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
				tool_choice: { type: "function" as const, function: { name: "get_weather" } },
			})

			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
				// Just consume
			}

			expect(mockStream).toHaveBeenCalledWith(
				expect.objectContaining({
					tool_choice: { type: "tool", name: "get_weather", disable_parallel_tool_use: true },
				}),
				expect.anything(),
			)
		})

		it("should enable parallel tool calls when parallelToolCalls is true", async () => {
			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
				tool_choice: "auto",
				parallelToolCalls: true,
			})

			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
				// Just consume
			}

			expect(mockStream).toHaveBeenCalledWith(
				expect.objectContaining({
					tool_choice: { type: "auto", disable_parallel_tool_use: false },
				}),
				expect.anything(),
			)
		})

		it("should handle tool_use blocks in stream and emit tool_call_partial", async () => {
			mockStream.mockImplementationOnce(() =>
				createMockMessageStream([
					{
						type: "message_start",
						message: {
							usage: {
								input_tokens: 100,
								output_tokens: 50,
							},
						},
					},
					{
						type: "content_block_start",
						index: 0,
						content_block: {
							type: "tool_use",
							id: "toolu_123",
							name: "get_weather",
						},
					},
				]),
			)

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Find the tool_call_partial chunk
			const toolCallChunk = chunks.find((chunk) => chunk.type === "tool_call_partial")
			expect(toolCallChunk).toBeDefined()
			expect(toolCallChunk).toEqual({
				type: "tool_call_partial",
				index: 0,
				id: "toolu_123",
				name: "get_weather",
				arguments: undefined,
			})
		})

		it("should handle input_json_delta in stream and emit tool_call_partial arguments", async () => {
			mockStream.mockImplementationOnce(() =>
				createMockMessageStream([
					{
						type: "message_start",
						message: {
							usage: {
								input_tokens: 100,
								output_tokens: 50,
							},
						},
					},
					{
						type: "content_block_start",
						index: 0,
						content_block: {
							type: "tool_use",
							id: "toolu_123",
							name: "get_weather",
						},
					},
					{
						type: "content_block_delta",
						index: 0,
						delta: {
							type: "input_json_delta",
							partial_json: '{"location":',
						},
					},
					{
						type: "content_block_delta",
						index: 0,
						delta: {
							type: "input_json_delta",
							partial_json: '"London"}',
						},
					},
					{
						type: "content_block_stop",
						index: 0,
					},
				]),
			)

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: mockTools,
				toolProtocol: "native",
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Find the tool_call_partial chunks
			const toolCallChunks = chunks.filter((chunk) => chunk.type === "tool_call_partial")
			expect(toolCallChunks).toHaveLength(3)

			// First chunk has id and name
			expect(toolCallChunks[0]).toEqual({
				type: "tool_call_partial",
				index: 0,
				id: "toolu_123",
				name: "get_weather",
				arguments: undefined,
			})

			// Subsequent chunks have arguments
			expect(toolCallChunks[1]).toEqual({
				type: "tool_call_partial",
				index: 0,
				id: undefined,
				name: undefined,
				arguments: '{"location":',
			})

			expect(toolCallChunks[2]).toEqual({
				type: "tool_call_partial",
				index: 0,
				id: undefined,
				name: undefined,
				arguments: '"London"}',
			})
		})
	})

	describe("stream abort and error handling", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Hello" }],
			},
		]

		it("should expose abort() method to cancel streaming", () => {
			expect(handler.abort).toBeDefined()
			expect(typeof handler.abort).toBe("function")
		})

		it("should expose isStreaming() method to check stream status", () => {
			expect(handler.isStreaming).toBeDefined()
			expect(typeof handler.isStreaming).toBe("function")
			// Should not be streaming initially
			expect(handler.isStreaming()).toBe(false)
		})

		it("should call abort on the underlying stream when abort() is called", async () => {
			let abortCalled = false
			mockStream.mockImplementationOnce(() => ({
				async *[Symbol.asyncIterator]() {
					yield {
						type: "message_start",
						message: {
							usage: { input_tokens: 100, output_tokens: 50 },
						},
					}
					// Simulate a long-running stream
					await new Promise((resolve) => setTimeout(resolve, 1000))
					yield {
						type: "content_block_start",
						index: 0,
						content_block: { type: "text", text: "Hello" },
					}
				},
				async finalMessage() {
					return {
						id: "test-message",
						type: "message",
						role: "assistant",
						content: [],
						model: "test-model",
						stop_reason: "end_turn",
						usage: { input_tokens: 100, output_tokens: 50 },
					}
				},
				abort() {
					abortCalled = true
				},
			}))

			const stream = handler.createMessage(systemPrompt, messages)

			// Start consuming but abort immediately after first chunk
			const iterator = stream[Symbol.asyncIterator]()
			await iterator.next() // Get first chunk

			// Call abort
			handler.abort()

			expect(abortCalled).toBe(true)
		})

		it("should handle stream errors gracefully", async () => {
			const testError = new Error("Stream connection lost")
			mockStream.mockImplementationOnce(() => ({
				async *[Symbol.asyncIterator]() {
					yield {
						type: "message_start",
						message: {
							usage: { input_tokens: 100, output_tokens: 50 },
						},
					}
					throw testError
				},
				async finalMessage() {
					throw testError
				},
				abort() {},
			}))

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Consume until error
				}
			}).rejects.toThrow("Stream connection lost")
		})

		it("should clear currentStream reference after completion", async () => {
			const stream = handler.createMessage(systemPrompt, messages)

			// Consume entire stream
			for await (const _chunk of stream) {
				// Just consume
			}

			// After completion, isStreaming should be false
			expect(handler.isStreaming()).toBe(false)
		})

		it("should clear currentStream reference after error", async () => {
			mockStream.mockImplementationOnce(() => ({
				async *[Symbol.asyncIterator]() {
					yield {
						type: "message_start",
						message: { usage: { input_tokens: 0, output_tokens: 0 } },
					}
					throw new Error("Test error")
				},
				async finalMessage() {
					throw new Error("Test error")
				},
				abort() {},
			}))

			const stream = handler.createMessage(systemPrompt, messages)

			try {
				for await (const _chunk of stream) {
					// Consume until error
				}
			} catch {
				// Expected error
			}

			// After error, isStreaming should be false
			expect(handler.isStreaming()).toBe(false)
		})
	})

	describe("thought signature handling", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Think about this" }],
			},
		]

		it("should capture signature from signature_delta during streaming", async () => {
			mockStream.mockImplementationOnce(() =>
				createMockMessageStream(
					[
						{
							type: "message_start",
							message: {
								usage: { input_tokens: 100, output_tokens: 50 },
							},
						},
						{
							type: "content_block_start",
							index: 0,
							content_block: {
								type: "thinking",
								thinking: "Let me think...",
							},
						},
						{
							type: "content_block_delta",
							index: 0,
							delta: {
								type: "thinking_delta",
								thinking: " more thoughts",
							},
						},
						{
							type: "content_block_delta",
							index: 0,
							delta: {
								type: "signature_delta",
								signature: "stream_signature_abc123",
							},
						},
						{
							type: "content_block_stop",
							index: 0,
						},
					],
					{
						id: "test-message",
						type: "message",
						role: "assistant",
						content: [
							{
								type: "thinking",
								thinking: "Let me think... more thoughts",
								signature: "final_signature_xyz789",
							},
						],
						model: "claude-3-7-sonnet-20250219",
						stop_reason: "end_turn",
						usage: { input_tokens: 100, output_tokens: 50 },
					},
				),
			)

			const thinkingHandler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
			})

			const stream = thinkingHandler.createMessage(systemPrompt, messages)

			// Consume entire stream
			for await (const _chunk of stream) {
				// Just consume
			}

			// After streaming, the signature from finalMessage should be captured
			// (finalMessage takes precedence for reliability)
			expect(thinkingHandler.getThoughtSignature()).toBe("final_signature_xyz789")
		})

		it("should fallback to stream signature if finalMessage fails", async () => {
			mockStream.mockImplementationOnce(() => ({
				async *[Symbol.asyncIterator]() {
					yield {
						type: "message_start",
						message: {
							usage: { input_tokens: 100, output_tokens: 50 },
						},
					}
					yield {
						type: "content_block_delta",
						index: 0,
						delta: {
							type: "signature_delta",
							signature: "fallback_stream_signature",
						},
					}
				},
				async finalMessage() {
					throw new Error("finalMessage not available")
				},
				abort() {},
			}))

			const thinkingHandler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
			})

			const stream = thinkingHandler.createMessage(systemPrompt, messages)

			// Consume entire stream
			for await (const _chunk of stream) {
				// Just consume
			}

			// Should fallback to signature captured during streaming
			expect(thinkingHandler.getThoughtSignature()).toBe("fallback_stream_signature")
		})

		it("should reset signature at start of new message", async () => {
			// First set up a handler with an existing signature
			const thinkingHandler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
			})

			// Mock first stream with signature
			mockStream.mockImplementationOnce(() =>
				createMockMessageStream(
					[
						{
							type: "message_start",
							message: { usage: { input_tokens: 100, output_tokens: 50 } },
						},
					],
					{
						id: "test-message",
						type: "message",
						role: "assistant",
						content: [{ type: "thinking", thinking: "test", signature: "first_signature" }],
						model: "test-model",
						stop_reason: "end_turn",
						usage: { input_tokens: 100, output_tokens: 50 },
					},
				),
			)

			// First message
			const stream1 = thinkingHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream1) {
				// Consume
			}
			expect(thinkingHandler.getThoughtSignature()).toBe("first_signature")

			// Mock second stream without signature
			mockStream.mockImplementationOnce(() =>
				createMockMessageStream([
					{
						type: "message_start",
						message: { usage: { input_tokens: 100, output_tokens: 50 } },
					},
					{
						type: "content_block_start",
						index: 0,
						content_block: { type: "text", text: "No thinking here" },
					},
				]),
			)

			// Second message - signature should be reset
			const stream2 = thinkingHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream2) {
				// Consume
			}

			// Signature should be undefined since the second message had no thinking
			expect(thinkingHandler.getThoughtSignature()).toBeUndefined()
		})
	})

	describe("redacted thinking blocks", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Think about this privately" }],
			},
		]

		it("should handle redacted_thinking blocks and emit placeholder text", async () => {
			mockStream.mockImplementationOnce(() =>
				createMockMessageStream([
					{
						type: "message_start",
						message: {
							usage: { input_tokens: 100, output_tokens: 50 },
						},
					},
					{
						type: "content_block_start",
						index: 0,
						content_block: {
							type: "redacted_thinking",
							data: "encrypted_data_here",
						},
					},
					{
						type: "content_block_stop",
						index: 0,
					},
					{
						type: "content_block_start",
						index: 1,
						content_block: {
							type: "text",
							text: "Here is my response",
						},
					},
				]),
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Find the reasoning chunks (from redacted thinking)
			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			expect(reasoningChunks.length).toBeGreaterThan(0)
			expect(reasoningChunks[0].text).toBe("[Thinking redacted]")

			// Find the text chunks (filter out newlines which are inserted for index > 0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text" && chunk.text !== "\n")
			expect(textChunks.length).toBeGreaterThan(0)
			expect(textChunks[0].text).toBe("Here is my response")
		})

		it("should handle multiple redacted thinking blocks with line breaks", async () => {
			mockStream.mockImplementationOnce(() =>
				createMockMessageStream([
					{
						type: "message_start",
						message: {
							usage: { input_tokens: 100, output_tokens: 50 },
						},
					},
					{
						type: "content_block_start",
						index: 0,
						content_block: {
							type: "redacted_thinking",
							data: "first_redacted",
						},
					},
					{
						type: "content_block_stop",
						index: 0,
					},
					{
						type: "content_block_start",
						index: 1,
						content_block: {
							type: "redacted_thinking",
							data: "second_redacted",
						},
					},
				]),
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have line break between multiple redacted blocks
			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			expect(reasoningChunks.length).toBe(3) // First redacted, newline, second redacted
			expect(reasoningChunks[0].text).toBe("[Thinking redacted]")
			expect(reasoningChunks[1].text).toBe("\n") // Line break for index > 0
			expect(reasoningChunks[2].text).toBe("[Thinking redacted]")
		})
	})
})
