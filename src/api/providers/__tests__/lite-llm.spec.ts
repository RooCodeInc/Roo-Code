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
		return vi.fn((modelId: string) => ({
			modelId,
			provider: "litellm",
		}))
	}),
}))

vi.mock("vscode", () => ({}))

vi.mock("../fetchers/modelCache", () => ({
	getModels: vi.fn().mockImplementation(() => {
		return Promise.resolve({
			"claude-3-7-sonnet-20250219": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3.0,
				outputPrice: 15.0,
			},
			"gpt-4": {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: false,
				inputPrice: 5.0,
				outputPrice: 15.0,
			},
			"custom-model": {
				maxTokens: 4096,
				contextWindow: 32000,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 1.0,
				outputPrice: 2.0,
			},
		})
	}),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import { litellmDefaultModelId, litellmDefaultModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { LiteLLMHandler } from "../lite-llm"
import { getModels, getModelsFromCache } from "../fetchers/modelCache"

describe("LiteLLMHandler", () => {
	let handler: LiteLLMHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		vi.clearAllMocks()
		mockOptions = {
			litellmApiKey: "test-key",
			litellmBaseUrl: "http://localhost:4000",
			litellmModelId: litellmDefaultModelId,
		}
		handler = new LiteLLMHandler(mockOptions)
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(LiteLLMHandler)
			expect(handler.getModel().id).toBe(litellmDefaultModelId)
		})

		it("should use default model ID if not provided", () => {
			const handlerWithoutModel = new LiteLLMHandler({
				...mockOptions,
				litellmModelId: undefined,
			})
			expect(handlerWithoutModel.getModel().id).toBe(litellmDefaultModelId)
		})

		it("should use default base URL if not provided", () => {
			const handlerWithoutBaseUrl = new LiteLLMHandler({
				...mockOptions,
				litellmBaseUrl: undefined,
			})
			expect(handlerWithoutBaseUrl).toBeInstanceOf(LiteLLMHandler)
		})

		it("should use default API key if not provided", () => {
			const handlerWithoutKey = new LiteLLMHandler({
				...mockOptions,
				litellmApiKey: undefined,
			})
			expect(handlerWithoutKey).toBeInstanceOf(LiteLLMHandler)
		})
	})

	describe("getModel", () => {
		it("should return default model info when no models are cached", () => {
			const model = handler.getModel()
			expect(model.id).toBe(litellmDefaultModelId)
			expect(model.info).toEqual(litellmDefaultModelInfo)
		})

		it("should return fetched model info after fetchModel is called", async () => {
			// Trigger fetchModel via createMessage setup
			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "Hello" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "Hello" }])
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// After createMessage, models should be populated
			const model = handler.getModel()
			expect(model.id).toBe(litellmDefaultModelId)
			expect(model.info.maxTokens).toBe(8192)
		})

		it("should fall back to cache when models are not fetched", () => {
			const cachedModels = {
				[litellmDefaultModelId]: {
					maxTokens: 4096,
					contextWindow: 100000,
					supportsImages: false,
					supportsPromptCache: false,
				},
			}
			vi.mocked(getModelsFromCache).mockReturnValue(cachedModels as any)

			const model = handler.getModel()
			expect(model.id).toBe(litellmDefaultModelId)
			expect(model.info.maxTokens).toBe(4096)
		})

		it("should use custom model ID from options", () => {
			const customHandler = new LiteLLMHandler({
				...mockOptions,
				litellmModelId: "custom-model",
			})
			// Before fetch, returns default info since models not loaded
			const model = customHandler.getModel()
			expect(model.id).toBe("custom-model")
		})
	})

	describe("createMessage", () => {
		it("should fetch models before creating a message", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "Hello!" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const generator = handler.createMessage("You are a helpful assistant", [{ role: "user", content: "Hello" }])
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			expect(getModels).toHaveBeenCalledWith({
				provider: "litellm",
				apiKey: "test-key",
				baseUrl: "http://localhost:4000",
			})
		})

		it("should stream text content", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "Hello" }
				yield { type: "text-delta" as const, id: "1", text: " world!" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const generator = handler.createMessage("system prompt", [{ role: "user", content: "Hi" }])
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			const textChunks = results.filter((r) => r.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0]).toEqual({ type: "text", text: "Hello" })
			expect(textChunks[1]).toEqual({ type: "text", text: " world!" })
		})

		it("should yield usage metrics at the end", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "Hello" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 50,
					details: {
						cachedInputTokens: 30,
						reasoningTokens: 10,
					},
				}),
			})

			const generator = handler.createMessage("system prompt", [{ role: "user", content: "Hi" }])
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			const usageChunk = results.find((r) => r.type === "usage")
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
				cacheReadTokens: 30,
				reasoningTokens: 10,
			})
		})

		it("should pass system prompt and messages to streamText", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "Response" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const generator = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of generator) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.system).toBe(systemPrompt)
			expect(callArgs.model).toBeDefined()
		})

		it("should pass temperature from options", async () => {
			const handlerWithTemp = new LiteLLMHandler({
				...mockOptions,
				modelTemperature: 0.7,
			})

			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "Hello" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const generator = handlerWithTemp.createMessage("system", [{ role: "user", content: "Hi" }])
			for await (const _chunk of generator) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.temperature).toBe(0.7)
		})

		it("should pass maxOutputTokens from model info", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "Hello" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "Hi" }])
			for await (const _chunk of generator) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBeDefined()
		})

		it("should handle tool calls in stream", async () => {
			const mockFullStream = (async function* () {
				yield { type: "tool-input-start" as const, id: "call_123", toolName: "test_tool" }
				yield { type: "tool-input-delta" as const, id: "call_123", delta: '{"key":"value"}' }
				yield { type: "tool-input-end" as const, id: "call_123" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "Hi" }])
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			const toolStartChunks = results.filter((r) => r.type === "tool_call_start")
			expect(toolStartChunks).toHaveLength(1)
			expect(toolStartChunks[0]).toMatchObject({
				type: "tool_call_start",
				id: "call_123",
				name: "test_tool",
			})

			const toolDeltaChunks = results.filter((r) => r.type === "tool_call_delta")
			expect(toolDeltaChunks).toHaveLength(1)

			const toolEndChunks = results.filter((r) => r.type === "tool_call_end")
			expect(toolEndChunks).toHaveLength(1)
		})

		it("should handle reasoning content in stream", async () => {
			const mockFullStream = (async function* () {
				yield { type: "reasoning" as const, text: "Let me think..." }
				yield { type: "text-delta" as const, id: "1", text: "The answer is 42" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "Hi" }])
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			const reasoningChunks = results.filter((r) => r.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0]).toEqual({ type: "reasoning", text: "Let me think..." })
		})

		it("should handle errors from streamText", async () => {
			const error = new Error("API Error")
			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "" }
				throw error
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "Hi" }])
			await expect(async () => {
				for await (const _chunk of generator) {
					// consume
				}
			}).rejects.toThrow()
		})
	})

	describe("completePrompt", () => {
		it("should return text from generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Completed response",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Completed response")
		})

		it("should pass prompt to generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Response",
			})

			await handler.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledTimes(1)
			const callArgs = mockGenerateText.mock.calls[0][0]
			expect(callArgs.prompt).toBe("Test prompt")
			expect(callArgs.model).toBeDefined()
		})

		it("should pass maxOutputTokens to generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Response",
			})

			await handler.completePrompt("Test prompt")

			const callArgs = mockGenerateText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBeDefined()
		})

		it("should fetch models before completing prompt", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Response",
			})

			await handler.completePrompt("Test prompt")

			expect(getModels).toHaveBeenCalledWith({
				provider: "litellm",
				apiKey: "test-key",
				baseUrl: "http://localhost:4000",
			})
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("model resolution with custom model IDs", () => {
		it("should resolve model from fetched models", async () => {
			const customHandler = new LiteLLMHandler({
				...mockOptions,
				litellmModelId: "gpt-4",
			})

			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "Hello" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const generator = customHandler.createMessage("system", [{ role: "user", content: "Hi" }])
			for await (const _chunk of generator) {
				// consume
			}

			const model = customHandler.getModel()
			expect(model.id).toBe("gpt-4")
			expect(model.info.contextWindow).toBe(128000)
		})

		it("should fall back to default info for unknown models", () => {
			const unknownHandler = new LiteLLMHandler({
				...mockOptions,
				litellmModelId: "unknown-model",
			})

			const model = unknownHandler.getModel()
			expect(model.id).toBe("unknown-model")
			expect(model.info).toEqual(litellmDefaultModelInfo)
		})
	})

	describe("usage metrics", () => {
		it("should handle usage without cache details", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "Hello" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({
					inputTokens: 50,
					outputTokens: 25,
				}),
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "Hi" }])
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			const usageChunk = results.find((r) => r.type === "usage")
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 50,
				outputTokens: 25,
			})
		})

		it("should handle zero token usage", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta" as const, id: "1", text: "" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({
					inputTokens: 0,
					outputTokens: 0,
				}),
			})

			const generator = handler.createMessage("system", [{ role: "user", content: "Hi" }])
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			const usageChunk = results.find((r) => r.type === "usage")
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 0,
				outputTokens: 0,
			})
		})
	})
})
