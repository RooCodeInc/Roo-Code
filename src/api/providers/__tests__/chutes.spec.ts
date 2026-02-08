// npx vitest run api/providers/__tests__/chutes.spec.ts

const { mockStreamText, mockGenerateText, mockGetModels, mockGetModelsFromCache } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockGetModels: vi.fn(),
	mockGetModelsFromCache: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: vi.fn(() => {
		return vi.fn((modelId: string) => ({
			modelId,
			provider: "chutes",
		}))
	}),
}))

vi.mock("../fetchers/modelCache", () => ({
	getModels: mockGetModels,
	getModelsFromCache: mockGetModelsFromCache,
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import { chutesDefaultModelId, chutesDefaultModelInfo, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@roo-code/types"

import { ChutesHandler } from "../chutes"

describe("ChutesHandler", () => {
	let handler: ChutesHandler

	beforeEach(() => {
		vi.clearAllMocks()
		mockGetModels.mockResolvedValue({
			[chutesDefaultModelId]: chutesDefaultModelInfo,
		})
		mockGetModelsFromCache.mockReturnValue(undefined)
		handler = new ChutesHandler({ chutesApiKey: "test-key" })
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(ChutesHandler)
		})

		it("should use default model when no model ID is provided", () => {
			const model = handler.getModel()
			expect(model.id).toBe(chutesDefaultModelId)
		})
	})

	describe("getModel", () => {
		it("should return default model when no model is specified and no cache", () => {
			const model = handler.getModel()
			expect(model.id).toBe(chutesDefaultModelId)
			expect(model.info).toEqual(
				expect.objectContaining({
					...chutesDefaultModelInfo,
				}),
			)
		})

		it("should return model info from fetched models", async () => {
			const testModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: false,
			}
			mockGetModels.mockResolvedValue({
				"some-model": testModelInfo,
			})

			const handlerWithModel = new ChutesHandler({
				apiModelId: "some-model",
				chutesApiKey: "test-key",
			})
			const model = await handlerWithModel.fetchModel()
			expect(model.id).toBe("some-model")
			expect(model.info).toEqual(expect.objectContaining(testModelInfo))
		})

		it("should fall back to global cache when instance models are empty", () => {
			const cachedInfo = {
				maxTokens: 2048,
				contextWindow: 64000,
				supportsImages: false,
				supportsPromptCache: false,
			}
			mockGetModelsFromCache.mockReturnValue({
				"cached-model": cachedInfo,
			})

			const handlerWithModel = new ChutesHandler({
				apiModelId: "cached-model",
				chutesApiKey: "test-key",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe("cached-model")
			expect(model.info).toEqual(expect.objectContaining(cachedInfo))
		})

		it("should apply DeepSeek default temperature for R1 models", () => {
			const r1Info = {
				maxTokens: 32768,
				contextWindow: 163840,
				supportsImages: false,
				supportsPromptCache: false,
			}
			mockGetModelsFromCache.mockReturnValue({
				"deepseek-ai/DeepSeek-R1-0528": r1Info,
			})

			const handlerWithModel = new ChutesHandler({
				apiModelId: "deepseek-ai/DeepSeek-R1-0528",
				chutesApiKey: "test-key",
			})
			const model = handlerWithModel.getModel()
			expect(model.info.defaultTemperature).toBe(DEEP_SEEK_DEFAULT_TEMPERATURE)
			expect(model.temperature).toBe(DEEP_SEEK_DEFAULT_TEMPERATURE)
		})

		it("should use default temperature for non-DeepSeek models", () => {
			const modelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: false,
			}
			mockGetModelsFromCache.mockReturnValue({
				"unsloth/Llama-3.3-70B-Instruct": modelInfo,
			})

			const handlerWithModel = new ChutesHandler({
				apiModelId: "unsloth/Llama-3.3-70B-Instruct",
				chutesApiKey: "test-key",
			})
			const model = handlerWithModel.getModel()
			expect(model.info.defaultTemperature).toBe(0.5)
			expect(model.temperature).toBe(0.5)
		})
	})

	describe("fetchModel", () => {
		it("should fetch models and return the resolved model", async () => {
			const model = await handler.fetchModel()
			expect(mockGetModels).toHaveBeenCalledWith(
				expect.objectContaining({
					provider: "chutes",
				}),
			)
			expect(model.id).toBe(chutesDefaultModelId)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hi" }]

		it("should handle non-DeepSeek models with standard streaming", async () => {
			mockGetModels.mockResolvedValue({
				"some-other-model": { maxTokens: 1024, contextWindow: 8192, supportsPromptCache: false },
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
			})

			const handlerWithModel = new ChutesHandler({
				apiModelId: "some-other-model",
				chutesApiKey: "test-key",
			})

			const stream = handlerWithModel.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "text", text: "Test response" },
				{
					type: "usage",
					inputTokens: 10,
					outputTokens: 5,
					cacheReadTokens: undefined,
					reasoningTokens: undefined,
				},
			])
		})

		it("should handle DeepSeek R1 reasoning format with TagMatcher", async () => {
			mockGetModels.mockResolvedValue({
				"deepseek-ai/DeepSeek-R1-0528": {
					maxTokens: 32768,
					contextWindow: 163840,
					supportsImages: false,
					supportsPromptCache: false,
				},
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "<think>Thinking..." }
				yield { type: "text-delta", text: "</think>Hello" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
			})

			const handlerWithModel = new ChutesHandler({
				apiModelId: "deepseek-ai/DeepSeek-R1-0528",
				chutesApiKey: "test-key",
			})

			const stream = handlerWithModel.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "reasoning", text: "Thinking..." },
				{ type: "text", text: "Hello" },
				{
					type: "usage",
					inputTokens: 10,
					outputTokens: 5,
					cacheReadTokens: undefined,
					reasoningTokens: undefined,
				},
			])
		})

		it("should handle tool calls in R1 path", async () => {
			mockGetModels.mockResolvedValue({
				"deepseek-ai/DeepSeek-R1-0528": {
					maxTokens: 32768,
					contextWindow: 163840,
					supportsImages: false,
					supportsPromptCache: false,
				},
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Let me help" }
				yield {
					type: "tool-input-start",
					id: "call_123",
					toolName: "test_tool",
				}
				yield {
					type: "tool-input-delta",
					id: "call_123",
					delta: '{"arg":"value"}',
				}
				yield {
					type: "tool-input-end",
					id: "call_123",
				}
			}

			const mockUsage = Promise.resolve({
				inputTokens: 15,
				outputTokens: 10,
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
			})

			const handlerWithModel = new ChutesHandler({
				apiModelId: "deepseek-ai/DeepSeek-R1-0528",
				chutesApiKey: "test-key",
			})

			const stream = handlerWithModel.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toContainEqual({ type: "text", text: "Let me help" })
			expect(chunks).toContainEqual({
				type: "tool_call_start",
				id: "call_123",
				name: "test_tool",
			})
			expect(chunks).toContainEqual({
				type: "tool_call_delta",
				id: "call_123",
				delta: '{"arg":"value"}',
			})
			expect(chunks).toContainEqual({
				type: "tool_call_end",
				id: "call_123",
			})
		})

		it("should merge system prompt into first user message for R1 path", async () => {
			mockGetModels.mockResolvedValue({
				"deepseek-ai/DeepSeek-R1-0528": {
					maxTokens: 32768,
					contextWindow: 163840,
					supportsImages: false,
					supportsPromptCache: false,
				},
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 5, outputTokens: 3 }),
			})

			const handlerWithModel = new ChutesHandler({
				apiModelId: "deepseek-ai/DeepSeek-R1-0528",
				chutesApiKey: "test-key",
			})

			const stream = handlerWithModel.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.any(Array),
				}),
			)

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.system).toBeUndefined()
		})

		it("should pass system prompt separately for non-R1 path", async () => {
			mockGetModels.mockResolvedValue({
				"some-model": { maxTokens: 1024, contextWindow: 8192, supportsPromptCache: false },
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 5, outputTokens: 3 }),
			})

			const handlerWithModel = new ChutesHandler({
				apiModelId: "some-model",
				chutesApiKey: "test-key",
			})

			const stream = handlerWithModel.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: systemPrompt,
				}),
			)
		})

		it("should include usage information from stream", async () => {
			mockGetModels.mockResolvedValue({
				"some-model": { maxTokens: 1024, contextWindow: 8192, supportsPromptCache: false },
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Hello" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 20,
					outputTokens: 10,
				}),
			})

			const handlerWithModel = new ChutesHandler({
				apiModelId: "some-model",
				chutesApiKey: "test-key",
			})

			const stream = handlerWithModel.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(20)
			expect(usageChunks[0].outputTokens).toBe(10)
		})
	})

	describe("completePrompt", () => {
		it("should return text from generateText", async () => {
			const expectedResponse = "This is a test response from Chutes"
			mockGenerateText.mockResolvedValue({ text: expectedResponse })

			const result = await handler.completePrompt("test prompt")
			expect(result).toBe(expectedResponse)
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "test prompt",
				}),
			)
		})

		it("should handle errors in completePrompt", async () => {
			const errorMessage = "Chutes API error"
			mockGenerateText.mockRejectedValue(new Error(errorMessage))
			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				`Chutes completion error: ${errorMessage}`,
			)
		})

		it("should pass temperature for R1 models in completePrompt", async () => {
			mockGetModels.mockResolvedValue({
				"deepseek-ai/DeepSeek-R1-0528": {
					maxTokens: 32768,
					contextWindow: 163840,
					supportsImages: false,
					supportsPromptCache: false,
				},
			})

			mockGenerateText.mockResolvedValue({ text: "response" })

			const handlerWithModel = new ChutesHandler({
				apiModelId: "deepseek-ai/DeepSeek-R1-0528",
				chutesApiKey: "test-key",
			})

			await handlerWithModel.completePrompt("test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: DEEP_SEEK_DEFAULT_TEMPERATURE,
				}),
			)
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})
})
