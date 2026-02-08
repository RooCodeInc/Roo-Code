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
		return vi.fn(() => ({
			modelId: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
			provider: "IO Intelligence",
		}))
	}),
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import { ioIntelligenceDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { IOIntelligenceHandler } from "../io-intelligence"

describe("IOIntelligenceHandler", () => {
	let handler: IOIntelligenceHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			ioIntelligenceApiKey: "test-api-key",
			ioIntelligenceModelId: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
			modelTemperature: 0.7,
			modelMaxTokens: undefined,
		} as ApiHandlerOptions
		handler = new IOIntelligenceHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(IOIntelligenceHandler)
			expect(handler.getModel().id).toBe("meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8")
		})

		it("should use default model ID if not provided", () => {
			const handlerWithoutModel = new IOIntelligenceHandler({
				...mockOptions,
				ioIntelligenceModelId: undefined,
			} as ApiHandlerOptions)
			expect(handlerWithoutModel.getModel().id).toBe(ioIntelligenceDefaultModelId)
		})

		it("should throw error when API key is missing", () => {
			const optionsWithoutKey = { ...mockOptions }
			delete optionsWithoutKey.ioIntelligenceApiKey

			expect(() => new IOIntelligenceHandler(optionsWithoutKey)).toThrow("IO Intelligence API key is required")
		})
	})

	describe("getModel", () => {
		it("should return model info for valid model ID", () => {
			const model = handler.getModel()
			expect(model.id).toBe("meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(430000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(false)
		})

		it("should return default model info for unknown model ID", () => {
			const handlerWithUnknown = new IOIntelligenceHandler({
				...mockOptions,
				ioIntelligenceModelId: "unknown-model",
			} as ApiHandlerOptions)
			const model = handlerWithUnknown.getModel()
			expect(model.id).toBe("unknown-model")
			expect(model.info).toBeDefined()
			expect(model.info.contextWindow).toBe(handler.getModel().info.contextWindow)
		})

		it("should return default model if no model ID is provided", () => {
			const handlerWithoutModel = new IOIntelligenceHandler({
				...mockOptions,
				ioIntelligenceModelId: undefined,
			} as ApiHandlerOptions)
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe(ioIntelligenceDefaultModelId)
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
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
				details: {},
				raw: {},
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
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
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
				details: {},
				raw: {},
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

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(5)
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
	})
})
