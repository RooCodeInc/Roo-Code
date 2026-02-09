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
			modelId: "local-model",
			provider: "lmstudio",
		}))
	}),
}))

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { openAiModelInfoSaneDefaults } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { LmStudioHandler, getLmStudioModels } from "../lm-studio"

describe("LmStudioHandler", () => {
	let handler: LmStudioHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			apiModelId: "local-model",
			lmStudioModelId: "local-model",
			lmStudioBaseUrl: "http://localhost:1234",
		}
		handler = new LmStudioHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(LmStudioHandler)
			expect(handler.getModel().id).toBe(mockOptions.lmStudioModelId)
		})

		it("should use default base URL if not provided", () => {
			const handlerWithoutUrl = new LmStudioHandler({
				apiModelId: "local-model",
				lmStudioModelId: "local-model",
			})
			expect(handlerWithoutUrl).toBeInstanceOf(LmStudioHandler)
		})

		it("should handle empty string base URL", () => {
			const handlerWithEmptyUrl = new LmStudioHandler({
				apiModelId: "local-model",
				lmStudioModelId: "local-model",
				lmStudioBaseUrl: "",
			})
			expect(handlerWithEmptyUrl).toBeInstanceOf(LmStudioHandler)
		})
	})

	describe("getModel", () => {
		it("should return model info with sane defaults", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe(mockOptions.lmStudioModelId)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(openAiModelInfoSaneDefaults.maxTokens)
			expect(modelInfo.info.contextWindow).toBe(openAiModelInfoSaneDefaults.contextWindow)
		})

		it("should return empty string id when no model ID provided", () => {
			const handlerWithoutModel = new LmStudioHandler({
				lmStudioBaseUrl: "http://localhost:1234",
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe("")
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

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
				}),
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

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
				}),
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

		it("should handle API errors", async () => {
			mockStreamText.mockImplementation(() => {
				throw new Error("API Error")
			})

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow()
		})

		it("should pass speculative decoding providerOptions when enabled", async () => {
			const speculativeHandler = new LmStudioHandler({
				...mockOptions,
				lmStudioSpeculativeDecodingEnabled: true,
				lmStudioDraftModelId: "draft-model",
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = speculativeHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// drain
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: {
						lmstudio: { draft_model: "draft-model" },
					},
				}),
			)
		})

		it("should NOT pass providerOptions when speculative decoding is disabled", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// drain
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions).toBeUndefined()
		})

		it("should handle tool call streaming", async () => {
			async function* mockFullStream() {
				yield { type: "tool-input-start", id: "call_123", toolName: "test_tool" }
				yield { type: "tool-input-delta", id: "call_123", delta: '{"arg1":"value"}' }
				yield { type: "tool-input-end", id: "call_123" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toContainEqual({
				type: "tool_call_start",
				id: "call_123",
				name: "test_tool",
			})
			expect(chunks).toContainEqual({
				type: "tool_call_delta",
				id: "call_123",
				delta: '{"arg1":"value"}',
			})
			expect(chunks).toContainEqual({
				type: "tool_call_end",
				id: "call_123",
			})
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			mockGenerateText.mockResolvedValue({ text: "Test response" })

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
		})

		it("should pass speculative decoding providerOptions when enabled", async () => {
			const speculativeHandler = new LmStudioHandler({
				...mockOptions,
				lmStudioSpeculativeDecodingEnabled: true,
				lmStudioDraftModelId: "draft-model",
			})

			mockGenerateText.mockResolvedValue({ text: "response" })

			await speculativeHandler.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: {
						lmstudio: { draft_model: "draft-model" },
					},
				}),
			)
		})

		it("should handle API errors", async () => {
			mockGenerateText.mockRejectedValue(new Error("API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow()
		})

		it("should handle empty response", async () => {
			mockGenerateText.mockResolvedValue({ text: "" })
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})
})

describe("getLmStudioModels", () => {
	it("should be exported as a function", () => {
		expect(typeof getLmStudioModels).toBe("function")
	})
})
