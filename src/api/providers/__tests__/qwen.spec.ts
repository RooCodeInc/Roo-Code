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

vi.mock("qwen-ai-provider-v5", () => ({
	createQwen: vi.fn(() => {
		// Return a function that returns a mock language model
		return vi.fn(() => ({
			modelId: "qwen-plus",
			provider: "qwen",
		}))
	}),
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import { qwenDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { QwenHandler } from "../qwen"

describe("QwenHandler", () => {
	let handler: QwenHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			qwenApiKey: "test-api-key",
			apiModelId: "qwen-plus",
		}
		handler = new QwenHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(QwenHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should use default model ID if not provided", () => {
			const handlerWithoutModel = new QwenHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			expect(handlerWithoutModel.getModel().id).toBe(qwenDefaultModelId)
		})

		it("should use default base URL if not provided", () => {
			const handlerWithoutBaseUrl = new QwenHandler({
				...mockOptions,
				qwenBaseUrl: undefined,
			})
			expect(handlerWithoutBaseUrl).toBeInstanceOf(QwenHandler)
		})

		it("should use custom base URL if provided", () => {
			const customBaseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1"
			const handlerWithCustomUrl = new QwenHandler({
				...mockOptions,
				qwenBaseUrl: customBaseUrl,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(QwenHandler)
		})
	})

	describe("getModel", () => {
		it("should return model info for valid model ID", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.apiModelId)
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8_192) // qwen-plus has 8K max output
			expect(model.info.contextWindow).toBe(131_072)
			expect(model.info.supportsImages).toBe(false)
			expect(model.info.supportsPromptCache).toBe(false)
		})

		it("should return correct model info for qwen-max", () => {
			const handlerWithMax = new QwenHandler({
				...mockOptions,
				apiModelId: "qwen-max",
			})
			const model = handlerWithMax.getModel()
			expect(model.id).toBe("qwen-max")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8_192)
			expect(model.info.contextWindow).toBe(32_768)
			expect(model.info.supportsImages).toBe(false)
		})

		it("should return correct model info for qwen-vl-max (vision model)", () => {
			const handlerWithVision = new QwenHandler({
				...mockOptions,
				apiModelId: "qwen-vl-max",
			})
			const model = handlerWithVision.getModel()
			expect(model.id).toBe("qwen-vl-max")
			expect(model.info).toBeDefined()
			expect(model.info.supportsImages).toBe(true)
		})

		it("should return provided model ID with default model info if model does not exist", () => {
			const handlerWithInvalidModel = new QwenHandler({
				...mockOptions,
				apiModelId: "invalid-model",
			})
			const model = handlerWithInvalidModel.getModel()
			expect(model.id).toBe("invalid-model") // Returns provided ID
			expect(model.info).toBeDefined()
			// With the current implementation, it's the same object reference when using default model info
			expect(model.info).toBe(handler.getModel().info)
		})

		it("should return default model if no model ID is provided", () => {
			const handlerWithoutModel = new QwenHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe(qwenDefaultModelId)
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
			// Mock the fullStream async generator
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			// Mock usage promise
			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const results: unknown[] = []

			for await (const chunk of stream) {
				results.push(chunk)
			}

			expect(mockStreamText).toHaveBeenCalled()
			expect(results.length).toBeGreaterThan(0)
		})

		it("should pass correct options to streamText", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			// Consume the stream
			for await (const _ of stream) {
				// Just consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					model: expect.any(Object),
					system: systemPrompt,
					messages: expect.any(Array),
					temperature: expect.any(Number),
				}),
			)
		})

		it("should yield text chunks from the stream", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Hello " }
				yield { type: "text-delta", text: "World" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const textChunks: string[] = []

			for await (const chunk of stream) {
				if (chunk && typeof chunk === "object" && "type" in chunk && chunk.type === "text") {
					textChunks.push((chunk as { type: "text"; text: string }).text)
				}
			}

			expect(textChunks).toContain("Hello ")
			expect(textChunks).toContain("World")
		})

		it("should yield usage chunk at the end", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			const expectedUsage = {
				inputTokens: 100,
				outputTokens: 50,
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve(expectedUsage),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: unknown[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c: any) => c?.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
			})
		})

		it("should handle tool calls via tool-input events", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Let me help you with that." }
				yield { type: "tool-input-start", id: "call_123", toolName: "read_file" }
				yield { type: "tool-input-delta", id: "call_123", delta: '{"path":"/test/file.txt"}' }
				yield { type: "tool-input-end", id: "call_123" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: unknown[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have text chunks
			expect(chunks.some((c: any) => c?.type === "text")).toBe(true)
			// Should have tool call start, delta, and end chunks
			expect(chunks.some((c: any) => c?.type === "tool_call_start")).toBe(true)
			expect(chunks.some((c: any) => c?.type === "tool_call_delta")).toBe(true)
			expect(chunks.some((c: any) => c?.type === "tool_call_end")).toBe(true)
		})

		it("should handle errors gracefully", async () => {
			const testError = new Error("API Error")
			;(testError as any).message = "API Error"

			// eslint-disable-next-line require-yield
			async function* mockFullStream() {
				throw testError
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const _ of stream) {
					// Consume the stream
				}
			}).rejects.toThrow()
		})
	})

	describe("completePrompt", () => {
		it("should return text from generateText", async () => {
			const expectedText = "This is a test response"

			mockGenerateText.mockResolvedValue({
				text: expectedText,
				usage: { inputTokens: 10, outputTokens: 5 },
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe(expectedText)
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					model: expect.any(Object),
					prompt: "Test prompt",
				}),
			)
		})

		it("should pass temperature to generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Response",
				usage: { inputTokens: 0, outputTokens: 0 },
			})

			await handler.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: expect.any(Number),
				}),
			)
		})

		it("should pass maxOutputTokens to generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Response",
				usage: { inputTokens: 0, outputTokens: 0 },
			})

			await handler.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					maxOutputTokens: expect.any(Number),
				}),
			)
		})
	})

	describe("model variants", () => {
		it("should handle qwen-turbo model", () => {
			const turboHandler = new QwenHandler({
				...mockOptions,
				apiModelId: "qwen-turbo",
			})
			const model = turboHandler.getModel()
			expect(model.id).toBe("qwen-turbo")
			expect(model.info.maxTokens).toBe(8_192)
			expect(model.info.contextWindow).toBe(131_072)
		})

		it("should handle qwen2.5-72b-instruct model", () => {
			const modelHandler = new QwenHandler({
				...mockOptions,
				apiModelId: "qwen2.5-72b-instruct",
			})
			const model = modelHandler.getModel()
			expect(model.id).toBe("qwen2.5-72b-instruct")
			expect(model.info.maxTokens).toBe(8_192)
		})

		it("should handle qwen2.5-14b-instruct-1m model with 1M context", () => {
			const modelHandler = new QwenHandler({
				...mockOptions,
				apiModelId: "qwen2.5-14b-instruct-1m",
			})
			const model = modelHandler.getModel()
			expect(model.id).toBe("qwen2.5-14b-instruct-1m")
			expect(model.info.contextWindow).toBe(1_000_000)
		})
	})
})
