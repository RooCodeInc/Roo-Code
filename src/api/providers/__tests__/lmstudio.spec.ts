import type { RooMessage } from "../../../core/task-persistence/rooMessage"
// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText, mockWrapLanguageModel } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockWrapLanguageModel: vi.fn((opts: any) => opts.model),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
		wrapLanguageModel: mockWrapLanguageModel,
	}
})

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: vi.fn(() => {
		return vi.fn(() => ({
			modelId: "local-model",
			provider: "lmstudio",
		}))
	}),
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import { LmStudioHandler } from "../lm-studio"
import type { ApiHandlerOptions } from "../../../shared/api"

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
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: RooMessage[] = [
			{
				role: "user",
				content: "Hello!",
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

		it("should handle API errors", async () => {
			async function* mockFullStream(): AsyncGenerator<{ type: string; text: string }> {
				yield { type: "text-delta", text: "" }
				throw new Error("API Error")
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow()
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
				}),
			)
		})

		it("should handle empty response", async () => {
			mockGenerateText.mockResolvedValue({
				text: "",
			})
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should handle API errors with handleAiSdkError", async () => {
			mockGenerateText.mockRejectedValueOnce(new Error("Connection refused"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("LM Studio")
		})
	})

	describe("getModel", () => {
		it("should return model info", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe(mockOptions.lmStudioModelId)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(-1)
			expect(modelInfo.info.contextWindow).toBe(128_000)
		})
	})

	describe("speculative decoding", () => {
		it("should include draft_model in providerOptions when speculative decoding is enabled", async () => {
			const speculativeHandler = new LmStudioHandler({
				...mockOptions,
				lmStudioSpeculativeDecodingEnabled: true,
				lmStudioDraftModelId: "draft-model-id",
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 5, outputTokens: 3 }),
			})

			const stream = speculativeHandler.createMessage("test prompt", [])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: {
						lmstudio: { draft_model: "draft-model-id" },
					},
				}),
			)
		})

		it("should not include draft_model when speculative decoding is disabled", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 5, outputTokens: 3 }),
			})

			const stream = handler.createMessage("test prompt", [])
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions).toBeUndefined()
		})

		it("should include draft_model in completePrompt when speculative decoding is enabled", async () => {
			const speculativeHandler = new LmStudioHandler({
				...mockOptions,
				lmStudioSpeculativeDecodingEnabled: true,
				lmStudioDraftModelId: "draft-model-id",
			})

			mockGenerateText.mockResolvedValue({ text: "Test" })

			await speculativeHandler.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: {
						lmstudio: { draft_model: "draft-model-id" },
					},
				}),
			)
		})
	})

	describe("reasoning middleware", () => {
		it("should wrap the language model with extractReasoningMiddleware for <think> tags", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 5, outputTokens: 3 }),
			})

			const stream = handler.createMessage("test prompt", [])
			for await (const _chunk of stream) {
				// consume stream to trigger getLanguageModel()
			}

			expect(mockWrapLanguageModel).toHaveBeenCalledWith(
				expect.objectContaining({
					middleware: expect.any(Object),
				}),
			)
		})

		it("should handle reasoning-delta chunks from middleware-processed stream", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning-delta", text: "Let me think about this..." }
				yield { type: "text-delta", text: "The answer is 42." }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 8 }),
			})

			const stream = handler.createMessage("test prompt", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			const textChunks = chunks.filter((c) => c.type === "text")

			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Let me think about this...")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("The answer is 42.")
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})
})
