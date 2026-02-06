// npx vitest run src/api/providers/__tests__/anthropic.spec.ts

const mockCaptureException = vitest.fn()

vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: (...args: unknown[]) => mockCaptureException(...args),
		},
	},
}))

// Mock the AI SDK functions
const mockStreamText = vitest.fn()
const mockGenerateText = vitest.fn()

vitest.mock("ai", async (importOriginal) => {
	const original = await importOriginal<typeof import("ai")>()
	return {
		...original,
		streamText: (...args: unknown[]) => mockStreamText(...args),
		generateText: (...args: unknown[]) => mockGenerateText(...args),
	}
})

// Mock createAnthropic to capture constructor options
const mockCreateAnthropic = vitest.fn().mockReturnValue(() => ({}))

vitest.mock("@ai-sdk/anthropic", () => ({
	createAnthropic: (...args: unknown[]) => mockCreateAnthropic(...args),
}))

import { Anthropic } from "@anthropic-ai/sdk"
import { type ModelInfo, anthropicDefaultModelId, ApiProviderError } from "@roo-code/types"
import { AnthropicHandler } from "../anthropic"
import { ApiHandlerOptions } from "../../../shared/api"

describe("AnthropicHandler", () => {
	let handler: AnthropicHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockCaptureException.mockClear()
		mockStreamText.mockClear()
		mockGenerateText.mockClear()
		mockCreateAnthropic.mockClear()
		mockCreateAnthropic.mockReturnValue(() => ({}))

		mockOptions = {
			apiKey: "test-api-key",
			apiModelId: "claude-3-5-sonnet-20241022",
		}
		handler = new AnthropicHandler(mockOptions)
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(AnthropicHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should create provider with apiKey", () => {
			mockCreateAnthropic.mockClear()
			new AnthropicHandler(mockOptions)
			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "test-api-key",
				}),
			)
		})

		it("should use custom base URL if provided", () => {
			mockCreateAnthropic.mockClear()
			new AnthropicHandler({
				...mockOptions,
				anthropicBaseUrl: "https://custom.anthropic.com",
			})
			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://custom.anthropic.com",
				}),
			)
		})

		it("should pass undefined baseURL when anthropicBaseUrl is not provided", () => {
			mockCreateAnthropic.mockClear()
			new AnthropicHandler(mockOptions)
			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: undefined,
				}),
			)
		})

		it("should use Bearer auth when anthropicBaseUrl and anthropicUseAuthToken are set", () => {
			mockCreateAnthropic.mockClear()
			new AnthropicHandler({
				...mockOptions,
				anthropicBaseUrl: "https://custom.anthropic.com",
				anthropicUseAuthToken: true,
			})
			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "",
					headers: expect.objectContaining({
						Authorization: "Bearer test-api-key",
					}),
				}),
			)
		})

		it("should use apiKey auth when anthropicUseAuthToken is set but no base URL", () => {
			mockCreateAnthropic.mockClear()
			new AnthropicHandler({
				...mockOptions,
				anthropicUseAuthToken: true,
			})
			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "test-api-key",
				}),
			)
			// Should not have Authorization header
			const calledHeaders = mockCreateAnthropic.mock.calls[0][0].headers
			expect(calledHeaders.Authorization).toBeUndefined()
		})

		it("should initialize with undefined API key", () => {
			const handlerWithoutKey = new AnthropicHandler({
				...mockOptions,
				apiKey: undefined,
			})
			expect(handlerWithoutKey).toBeInstanceOf(AnthropicHandler)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const mockMessages: Anthropic.Messages.MessageParam[] = [
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
		]

		it("should handle text messages correctly", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "Hello" }
				yield { type: "text-delta", text: " world!" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([]),
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks: any[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have text chunks + usage
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0]).toEqual({ type: "text", text: "Hello" })
			expect(textChunks[1]).toEqual({ type: "text", text: " world!" })

			// Should have usage chunk
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0]).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
			})

			// Verify streamText was called
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0,
				}),
			)
		})

		it("should pass beta headers", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "Hi" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([]),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						"anthropic-beta": expect.stringContaining("fine-grained-tool-streaming-2025-05-14"),
					}),
				}),
			)
		})

		it("should include prompt-caching beta for supported models", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "Hi" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([]),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						"anthropic-beta": expect.stringContaining("prompt-caching-2024-07-31"),
					}),
				}),
			)
		})

		it("should use system array with cache control for cache-supported models", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "Hi" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([]),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const _chunk of stream) {
				// consume
			}

			// For cache-supported models, system should be an array with providerOptions
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(Array.isArray(callArgs.system)).toBe(true)
			expect(callArgs.system[0]).toEqual({
				type: "text",
				text: systemPrompt,
				providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
			})
		})

		it("should handle API errors", async () => {
			const mockError = new Error("Anthropic API error")
			// eslint-disable-next-line require-yield
			const mockFullStream = (async function* () {
				throw mockError
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([]),
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should throw
				}
			}).rejects.toThrow("Anthropic API error")

			// Should capture telemetry
			expect(mockCaptureException).toHaveBeenCalled()
		})

		it("should handle reasoning stream parts", async () => {
			const mockFullStream = (async function* () {
				yield { type: "reasoning-delta", text: "Let me think..." }
				yield { type: "text-delta", text: "The answer is 42." }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([{ type: "text", text: "Let me think...", signature: "sig123" }]),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks: any[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0]).toEqual({ type: "reasoning", text: "Let me think..." })

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0]).toEqual({ type: "text", text: "The answer is 42." })
		})

		it("should capture thought signature from reasoning", async () => {
			const mockFullStream = (async function* () {
				yield { type: "reasoning-delta", text: "Thinking..." }
				yield { type: "text-delta", text: "Answer" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([{ type: "text", text: "Thinking...", signature: "thought-sig-abc" }]),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const _chunk of stream) {
				// consume
			}

			expect(handler.getThoughtSignature()).toBe("thought-sig-abc")
		})

		it("should capture redacted thinking blocks from reasoning", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "Answer" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([
					{ type: "text", text: "Thinking...", signature: "sig1" },
					{ type: "redacted", data: "base64redacteddata" },
				]),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const _chunk of stream) {
				// consume
			}

			const redacted = handler.getRedactedThinkingBlocks()
			expect(redacted).toEqual([{ type: "redacted_thinking", data: "base64redacteddata" }])
		})

		it("should handle usage with cache tokens from provider metadata", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "Hi" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([]),
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 50,
					details: { cachedInputTokens: 30 },
				}),
				providerMetadata: Promise.resolve({
					anthropic: { cacheCreationInputTokens: 20 },
				}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks: any[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
				cacheReadTokens: 30,
				cacheWriteTokens: 20,
			})
			expect(usageChunk.totalCost).toBeDefined()
		})

		it("should pass tools to streamText", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "Hi" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([]),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const mockTools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get the current weather",
						parameters: {
							type: "object",
							properties: { location: { type: "string" } },
							required: ["location"],
						},
					},
				},
			]

			const stream = handler.createMessage(systemPrompt, mockMessages, {
				taskId: "test-task",
				tools: mockTools,
			})

			for await (const _chunk of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.objectContaining({
						get_weather: expect.any(Object),
					}),
				}),
			)
		})

		it("should handle tool call stream parts", async () => {
			const mockFullStream = (async function* () {
				yield { type: "tool-input-start", id: "toolu_123", toolName: "get_weather" }
				yield { type: "tool-input-delta", id: "toolu_123", delta: '{"location":' }
				yield { type: "tool-input-delta", id: "toolu_123", delta: '"London"}' }
				yield { type: "tool-input-end", id: "toolu_123" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				reasoning: Promise.resolve([]),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks: any[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const startChunk = chunks.find((c) => c.type === "tool_call_start")
			expect(startChunk).toEqual({
				type: "tool_call_start",
				id: "toolu_123",
				name: "get_weather",
			})

			const deltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
			expect(deltaChunks).toHaveLength(2)
			expect(deltaChunks[0]).toEqual({
				type: "tool_call_delta",
				id: "toolu_123",
				delta: '{"location":',
			})

			const endChunk = chunks.find((c) => c.type === "tool_call_end")
			expect(endChunk).toEqual({
				type: "tool_call_end",
				id: "toolu_123",
			})
		})

		it("should reset reasoning state on each call", async () => {
			// First call with signature
			const mockFullStream1 = (async function* () {
				yield { type: "text-delta", text: "First" }
			})()

			mockStreamText.mockReturnValueOnce({
				fullStream: mockFullStream1,
				reasoning: Promise.resolve([{ type: "text", text: "Think", signature: "sig1" }]),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream1 = handler.createMessage(systemPrompt, mockMessages)
			for await (const _chunk of stream1) {
				// consume
			}
			expect(handler.getThoughtSignature()).toBe("sig1")

			// Second call without signature
			const mockFullStream2 = (async function* () {
				yield { type: "text-delta", text: "Second" }
			})()

			mockStreamText.mockReturnValueOnce({
				fullStream: mockFullStream2,
				reasoning: Promise.resolve([]),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream2 = handler.createMessage(systemPrompt, mockMessages)
			for await (const _chunk of stream2) {
				// consume
			}
			expect(handler.getThoughtSignature()).toBeUndefined()
			expect(handler.getRedactedThinkingBlocks()).toBeUndefined()
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			mockGenerateText.mockResolvedValue({
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
			const mockError = new Error("Anthropic completion error: API Error")
			mockGenerateText.mockRejectedValue(mockError)
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("Anthropic completion error: API Error")
			expect(mockCaptureException).toHaveBeenCalled()
		})

		it("should handle empty response", async () => {
			mockGenerateText.mockResolvedValue({
				text: "",
			})
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should handle undefined text", async () => {
			mockGenerateText.mockResolvedValue({
				text: undefined,
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

		it("should strip :thinking suffix from model ID", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
			})
			const model = handler.getModel()
			expect(model.id).toBe("claude-3-7-sonnet-20250219")
			expect(model.betas).toContain("output-128k-2025-02-19")
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("getThoughtSignature", () => {
		it("should return undefined before any call", () => {
			expect(handler.getThoughtSignature()).toBeUndefined()
		})
	})

	describe("getRedactedThinkingBlocks", () => {
		it("should return undefined before any call", () => {
			expect(handler.getRedactedThinkingBlocks()).toBeUndefined()
		})
	})
})
