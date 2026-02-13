// npx vitest run src/api/providers/__tests__/anthropic.spec.ts

import { AnthropicHandler } from "../anthropic"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock TelemetryService
vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: vitest.fn(),
		},
	},
}))

// Mock the AI SDK
const mockStreamText = vitest.fn()
const mockGenerateText = vitest.fn()

vitest.mock("ai", () => ({
	streamText: (...args: any[]) => mockStreamText(...args),
	generateText: (...args: any[]) => mockGenerateText(...args),
	tool: vitest.fn(),
	jsonSchema: vitest.fn(),
	ToolSet: {},
}))

// Mock the @ai-sdk/anthropic provider
const mockCreateAnthropic = vitest.fn()

vitest.mock("@ai-sdk/anthropic", () => ({
	createAnthropic: (...args: any[]) => mockCreateAnthropic(...args),
}))

// Mock ai-sdk transform utilities
vitest.mock("../../transform/ai-sdk", () => ({
	convertToAiSdkMessages: vitest.fn().mockReturnValue([{ role: "user", content: [{ type: "text", text: "Hello" }] }]),
	convertToolsForAiSdk: vitest.fn().mockReturnValue(undefined),
	processAiSdkStreamPart: vitest.fn().mockImplementation(function* (part: any) {
		if (part.type === "text-delta") {
			yield { type: "text", text: part.text }
		} else if (part.type === "reasoning-delta") {
			yield { type: "reasoning", text: part.text }
		} else if (part.type === "tool-input-start") {
			yield { type: "tool_call_start", id: part.id, name: part.toolName }
		} else if (part.type === "tool-input-delta") {
			yield { type: "tool_call_delta", id: part.id, delta: part.delta }
		} else if (part.type === "tool-input-end") {
			yield { type: "tool_call_end", id: part.id }
		}
	}),
	mapToolChoice: vitest.fn().mockReturnValue(undefined),
	handleAiSdkError: vitest.fn().mockImplementation((error: any) => error),
	yieldResponseMessage: vitest.fn().mockImplementation(function* () {}),
}))

// Import mocked modules
import { convertToAiSdkMessages, convertToolsForAiSdk, mapToolChoice } from "../../transform/ai-sdk"
import { Anthropic } from "@anthropic-ai/sdk"

// Helper: create a mock provider function
function createMockProviderFn() {
	const providerFn = vitest.fn().mockReturnValue("mock-model")
	return providerFn
}

describe("AnthropicHandler", () => {
	let handler: AnthropicHandler
	let mockOptions: ApiHandlerOptions
	let mockProviderFn: ReturnType<typeof createMockProviderFn>

	beforeEach(() => {
		mockOptions = {
			apiKey: "test-api-key",
			apiModelId: "claude-3-5-sonnet-20241022",
		}

		mockProviderFn = createMockProviderFn()
		mockCreateAnthropic.mockReturnValue(mockProviderFn)

		handler = new AnthropicHandler(mockOptions)
		vitest.clearAllMocks()

		// Re-set mock defaults after clearAllMocks
		mockCreateAnthropic.mockReturnValue(mockProviderFn)
		vitest
			.mocked(convertToAiSdkMessages)
			.mockReturnValue([{ role: "user", content: [{ type: "text", text: "Hello" }] }])
		vitest.mocked(convertToolsForAiSdk).mockReturnValue(undefined)
		vitest.mocked(mapToolChoice).mockReturnValue(undefined)
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(AnthropicHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should initialize with undefined API key and pass it through for env-var fallback", () => {
			mockCreateAnthropic.mockClear()
			const handlerWithoutKey = new AnthropicHandler({
				...mockOptions,
				apiKey: undefined,
			})
			expect(handlerWithoutKey).toBeInstanceOf(AnthropicHandler)
			const callArgs = mockCreateAnthropic.mock.calls[0]![0]!
			expect(callArgs.apiKey).toBeUndefined()
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
			mockCreateAnthropic.mockClear()
			const _ = new AnthropicHandler({
				...mockOptions,
			})
			expect(mockCreateAnthropic).toHaveBeenCalledTimes(1)
			const callArgs = mockCreateAnthropic.mock.calls[0]![0]!
			expect(callArgs.apiKey).toEqual("test-api-key")
			expect(callArgs.authToken).toBeUndefined()
		})

		it("use apiKey for passing token if anthropicUseAuthToken is set but custom base URL is not given", () => {
			mockCreateAnthropic.mockClear()
			const _ = new AnthropicHandler({
				...mockOptions,
				anthropicUseAuthToken: true,
			})
			expect(mockCreateAnthropic).toHaveBeenCalledTimes(1)
			const callArgs = mockCreateAnthropic.mock.calls[0]![0]!
			expect(callArgs.apiKey).toEqual("test-api-key")
			expect(callArgs.authToken).toBeUndefined()
		})

		it("use authToken for passing token if both of anthropicBaseUrl and anthropicUseAuthToken are set", () => {
			mockCreateAnthropic.mockClear()
			const customBaseUrl = "https://custom.anthropic.com"
			const _ = new AnthropicHandler({
				...mockOptions,
				anthropicBaseUrl: customBaseUrl,
				anthropicUseAuthToken: true,
			})
			expect(mockCreateAnthropic).toHaveBeenCalledTimes(1)
			const callArgs = mockCreateAnthropic.mock.calls[0]![0]!
			expect(callArgs.authToken).toEqual("test-api-key")
			expect(callArgs.apiKey).toBeUndefined()
		})

		it("should include 1M context beta header when enabled", () => {
			mockCreateAnthropic.mockClear()
			const _ = new AnthropicHandler({
				...mockOptions,
				apiModelId: "claude-sonnet-4-5",
				anthropicBeta1MContext: true,
			})
			expect(mockCreateAnthropic).toHaveBeenCalledTimes(1)
			const callArgs = mockCreateAnthropic.mock.calls[0]![0]!
			expect(callArgs.headers["anthropic-beta"]).toContain("context-1m-2025-08-07")
		})

		it("should include output-128k beta for thinking model", () => {
			mockCreateAnthropic.mockClear()
			const _ = new AnthropicHandler({
				...mockOptions,
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
			})
			expect(mockCreateAnthropic).toHaveBeenCalledTimes(1)
			const callArgs = mockCreateAnthropic.mock.calls[0]![0]!
			expect(callArgs.headers["anthropic-beta"]).toContain("output-128k-2025-02-19")
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."

		function setupStreamTextMock(parts: any[], usage?: any, providerMetadata?: any) {
			const asyncIterable = {
				async *[Symbol.asyncIterator]() {
					for (const part of parts) {
						yield part
					}
				},
			}
			mockStreamText.mockReturnValue({
				fullStream: asyncIterable,
				usage: Promise.resolve(usage || { inputTokens: 100, outputTokens: 50 }),
				providerMetadata: Promise.resolve(
					providerMetadata || {
						anthropic: {
							cacheCreationInputTokens: 20,
							cacheReadInputTokens: 10,
						},
					},
				),
			})
		}

		it("should stream text content using AI SDK", async () => {
			setupStreamTextMock([
				{ type: "text-delta", text: "Hello" },
				{ type: "text-delta", text: " world" },
			])

			const stream = handler.createMessage(systemPrompt, [
				{
					role: "user",
					content: [{ type: "text" as const, text: "First message" }],
				},
			])

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify text content
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Hello")
			expect(textChunks[1].text).toBe(" world")

			// Verify usage information
			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
		})

		it("should handle prompt caching for supported models", async () => {
			setupStreamTextMock(
				[{ type: "text-delta", text: "Hello" }],
				{ inputTokens: 100, outputTokens: 50 },
				{
					anthropic: {
						cacheCreationInputTokens: 20,
						cacheReadInputTokens: 10,
					},
				},
			)

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

			// Verify usage information includes cache metrics
			const usageChunk = chunks.find(
				(chunk) => chunk.type === "usage" && (chunk.cacheWriteTokens || chunk.cacheReadTokens),
			)
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.cacheWriteTokens).toBe(20)
			expect(usageChunk?.cacheReadTokens).toBe(10)

			// Verify streamText was called
			expect(mockStreamText).toHaveBeenCalled()
		})

		it("should pass tools via AI SDK when tools are provided", async () => {
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

			setupStreamTextMock([{ type: "text-delta", text: "Weather check" }])

			const stream = handler.createMessage(
				systemPrompt,
				[{ role: "user", content: [{ type: "text" as const, text: "What's the weather?" }] }],
				{ taskId: "test-task", tools: mockTools },
			)

			for await (const _chunk of stream) {
				// Consume stream
			}

			// Verify tools were converted
			expect(convertToolsForAiSdk).toHaveBeenCalled()
			expect(mockStreamText).toHaveBeenCalled()
		})

		it("should handle tool_choice mapping", async () => {
			setupStreamTextMock([{ type: "text-delta", text: "test" }])

			const stream = handler.createMessage(
				systemPrompt,
				[{ role: "user", content: [{ type: "text" as const, text: "test" }] }],
				{ taskId: "test-task", tool_choice: "auto" },
			)

			for await (const _chunk of stream) {
				// Consume stream
			}

			expect(mapToolChoice).toHaveBeenCalledWith("auto")
		})

		it("should disable parallel tool use when parallelToolCalls is false", async () => {
			setupStreamTextMock([{ type: "text-delta", text: "test" }])

			const stream = handler.createMessage(
				systemPrompt,
				[{ role: "user", content: [{ type: "text" as const, text: "test" }] }],
				{ taskId: "test-task", parallelToolCalls: false },
			)

			for await (const _chunk of stream) {
				// Consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: expect.objectContaining({
						anthropic: expect.objectContaining({
							disableParallelToolUse: true,
						}),
					}),
				}),
			)
		})

		it("should not set disableParallelToolUse when parallelToolCalls is true or undefined", async () => {
			setupStreamTextMock([{ type: "text-delta", text: "test" }])

			const stream = handler.createMessage(
				systemPrompt,
				[{ role: "user", content: [{ type: "text" as const, text: "test" }] }],
				{ taskId: "test-task", parallelToolCalls: true },
			)

			for await (const _chunk of stream) {
				// Consume stream
			}

			// providerOptions should not include disableParallelToolUse
			const callArgs = mockStreamText.mock.calls[0]![0]
			const anthropicOptions = callArgs?.providerOptions?.anthropic
			expect(anthropicOptions?.disableParallelToolUse).toBeUndefined()
		})

		it("should handle tool call streaming via AI SDK", async () => {
			setupStreamTextMock([
				{ type: "tool-input-start", id: "toolu_123", toolName: "get_weather" },
				{ type: "tool-input-delta", id: "toolu_123", delta: '{"location":' },
				{ type: "tool-input-delta", id: "toolu_123", delta: '"London"}' },
				{ type: "tool-input-end", id: "toolu_123" },
			])

			const stream = handler.createMessage(
				systemPrompt,
				[{ role: "user", content: [{ type: "text" as const, text: "What's the weather?" }] }],
				{ taskId: "test-task" },
			)

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const startChunk = chunks.find((c) => c.type === "tool_call_start")
			expect(startChunk).toBeDefined()
			expect(startChunk?.id).toBe("toolu_123")
			expect(startChunk?.name).toBe("get_weather")

			const deltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
			expect(deltaChunks).toHaveLength(2)

			const endChunk = chunks.find((c) => c.type === "tool_call_end")
			expect(endChunk).toBeDefined()
		})

		it("should pass system prompt via system param when no systemProviderOptions", async () => {
			setupStreamTextMock([{ type: "text-delta", text: "test" }])

			const stream = handler.createMessage(systemPrompt, [
				{ role: "user", content: [{ type: "text" as const, text: "test" }] },
			])

			for await (const _chunk of stream) {
				// Consume
			}

			// Without systemProviderOptions, system prompt is passed via the system parameter
			const callArgs = mockStreamText.mock.calls[0]![0]
			expect(callArgs.system).toBe(systemPrompt)
			// System prompt should NOT be in the messages array
			const systemMessages = callArgs.messages.filter((m: any) => m.role === "system")
			expect(systemMessages).toHaveLength(0)
		})

		it("should inject system prompt as cached system message when systemProviderOptions provided", async () => {
			setupStreamTextMock([{ type: "text-delta", text: "test" }])

			const cacheOpts = { anthropic: { cacheControl: { type: "ephemeral" } } }
			const stream = handler.createMessage(
				systemPrompt,
				[{ role: "user", content: [{ type: "text" as const, text: "test" }] }],
				{ taskId: "test-task", systemProviderOptions: cacheOpts },
			)

			for await (const _chunk of stream) {
				// Consume
			}

			// With systemProviderOptions, system prompt is injected as messages[0]
			const callArgs = mockStreamText.mock.calls[0]![0]
			expect(callArgs.system).toBeUndefined()
			// System prompt should be the first message with providerOptions
			const systemMessages = callArgs.messages.filter((m: any) => m.role === "system")
			expect(systemMessages).toHaveLength(1)
			expect(systemMessages[0].content).toBe(systemPrompt)
			expect(systemMessages[0].providerOptions).toEqual(cacheOpts)
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "Test response",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
					temperature: 0,
				}),
			)
		})

		it("should handle API errors", async () => {
			const error = new Error("Anthropic completion error: API Error")
			mockGenerateText.mockRejectedValueOnce(error)
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow()
		})

		it("should handle empty response", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "",
			})
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
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})
})
