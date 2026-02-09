// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
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
		// Return a function that returns a mock language model
		return vi.fn(() => ({
			modelId: "MiniMax-M2",
			provider: "minimax",
		}))
	}),
}))

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { minimaxDefaultModelId, minimaxModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { MiniMaxHandler } from "../minimax"

describe("MiniMaxHandler", () => {
	let handler: MiniMaxHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		vi.clearAllMocks()
		mockOptions = {
			minimaxApiKey: "test-api-key",
			apiModelId: "MiniMax-M2",
			minimaxBaseUrl: "https://api.minimax.io/v1",
		}
		handler = new MiniMaxHandler(mockOptions)
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(MiniMaxHandler)
			expect(handler.getModel().id).toBe("MiniMax-M2")
		})

		it("should use default model ID if not provided", () => {
			const handlerWithoutModel = new MiniMaxHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			expect(handlerWithoutModel.getModel().id).toBe(minimaxDefaultModelId)
		})

		it("should use default base URL if not provided", () => {
			const handlerWithoutBaseUrl = new MiniMaxHandler({
				...mockOptions,
				minimaxBaseUrl: undefined,
			})
			expect(handlerWithoutBaseUrl).toBeInstanceOf(MiniMaxHandler)
		})

		it("should handle China base URL", () => {
			const handlerChina = new MiniMaxHandler({
				...mockOptions,
				minimaxBaseUrl: "https://api.minimaxi.com/v1",
			})
			expect(handlerChina).toBeInstanceOf(MiniMaxHandler)
		})

		it("should strip /anthropic suffix and use /v1 endpoint", () => {
			const handlerAnthropicUrl = new MiniMaxHandler({
				...mockOptions,
				minimaxBaseUrl: "https://api.minimax.io/anthropic" as any,
			})
			expect(handlerAnthropicUrl).toBeInstanceOf(MiniMaxHandler)
		})
	})

	describe("getModel", () => {
		it("should return model info for valid model ID", () => {
			const model = handler.getModel()
			expect(model.id).toBe("MiniMax-M2")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(16_384)
			expect(model.info.contextWindow).toBe(192_000)
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should return default model info for unknown model ID", () => {
			const handlerUnknown = new MiniMaxHandler({
				...mockOptions,
				apiModelId: "unknown-model",
			})
			const model = handlerUnknown.getModel()
			expect(model.id).toBe("unknown-model")
			// Falls back to default model info
			expect(model.info).toEqual(minimaxModels[minimaxDefaultModelId])
		})

		it("should return default model if no model ID is provided", () => {
			const handlerNoModel = new MiniMaxHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			const model = handlerNoModel.getModel()
			expect(model.id).toBe(minimaxDefaultModelId)
			expect(model.info).toBeDefined()
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: NeutralMessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Hello!" }],
			},
		]

		it("should handle streaming responses", async () => {
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

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
		})

		it("should include usage information", async () => {
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

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(5)
		})

		it("should handle reasoning content in stream", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning", text: "Let me think..." }
				yield { type: "text-delta", text: "Answer" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 5, outputTokens: 3 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Let me think...")
		})

		it("should handle tool calls in stream", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-input-start",
					id: "tool-123",
					toolName: "get_weather",
				}
				yield {
					type: "tool-input-delta",
					id: "tool-123",
					delta: '{"city":"London"}',
				}
				yield {
					type: "tool-input-end",
					id: "tool-123",
				}
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 5, outputTokens: 3 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolStartChunks = chunks.filter((c) => c.type === "tool_call_start")
			expect(toolStartChunks).toHaveLength(1)
			expect(toolStartChunks[0].name).toBe("get_weather")
			expect(toolStartChunks[0].id).toBe("tool-123")
		})

		it("should handle errors in stream", async () => {
			async function* mockFullStream() {
				yield
				throw new Error("Stream error")
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			await expect(async () => {
				for await (const _chunk of stream) {
					// consume
				}
			}).rejects.toThrow()
		})
	})

	describe("completePrompt", () => {
		it("should complete a prompt using generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test completion",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test completion")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
				}),
			)
		})

		it("should handle errors in completePrompt", async () => {
			mockGenerateText.mockRejectedValue(new Error("API error"))
			await expect(handler.completePrompt("test")).rejects.toThrow("API error")
		})
	})

	describe("Model Configuration", () => {
		it("should correctly configure MiniMax-M2 model properties", () => {
			const model = minimaxModels["MiniMax-M2"]
			expect(model.maxTokens).toBe(16_384)
			expect(model.contextWindow).toBe(192_000)
			expect(model.supportsImages).toBe(false)
			expect(model.supportsPromptCache).toBe(true)
			expect(model.inputPrice).toBe(0.3)
			expect(model.outputPrice).toBe(1.2)
			expect(model.cacheWritesPrice).toBe(0.375)
			expect(model.cacheReadsPrice).toBe(0.03)
		})

		it("should correctly configure MiniMax-M2-Stable model properties", () => {
			const model = minimaxModels["MiniMax-M2-Stable"]
			expect(model.maxTokens).toBe(16_384)
			expect(model.contextWindow).toBe(192_000)
			expect(model.supportsImages).toBe(false)
			expect(model.supportsPromptCache).toBe(true)
			expect(model.inputPrice).toBe(0.3)
			expect(model.outputPrice).toBe(1.2)
			expect(model.cacheWritesPrice).toBe(0.375)
			expect(model.cacheReadsPrice).toBe(0.03)
		})
	})
})
