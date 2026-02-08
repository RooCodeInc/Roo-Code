// npx vitest run api/providers/__tests__/featherless.spec.ts

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
			modelId: "featherless-model",
			provider: "Featherless",
		}))
	}),
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import { type FeatherlessModelId, featherlessDefaultModelId, featherlessModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { FeatherlessHandler } from "../featherless"

describe("FeatherlessHandler", () => {
	let handler: FeatherlessHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			featherlessApiKey: "test-api-key",
		}
		handler = new FeatherlessHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(FeatherlessHandler)
			expect(handler.getModel().id).toBe(featherlessDefaultModelId)
		})

		it("should use specified model ID when provided", () => {
			const testModelId: FeatherlessModelId = "moonshotai/Kimi-K2-Instruct"
			const handlerWithModel = new FeatherlessHandler({
				apiModelId: testModelId,
				featherlessApiKey: "test-api-key",
			})
			expect(handlerWithModel.getModel().id).toBe(testModelId)
		})
	})

	describe("getModel", () => {
		it("should return default model when no model is specified", () => {
			const model = handler.getModel()
			expect(model.id).toBe(featherlessDefaultModelId)
			expect(model.info).toEqual(expect.objectContaining(featherlessModels[featherlessDefaultModelId]))
		})

		it("should return specified model when valid model is provided", () => {
			const testModelId: FeatherlessModelId = "moonshotai/Kimi-K2-Instruct"
			const handlerWithModel = new FeatherlessHandler({
				apiModelId: testModelId,
				featherlessApiKey: "test-api-key",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(expect.objectContaining(featherlessModels[testModelId]))
		})

		it("should use default temperature for non-DeepSeek models", () => {
			const testModelId: FeatherlessModelId = "moonshotai/Kimi-K2-Instruct"
			const handlerWithModel = new FeatherlessHandler({
				apiModelId: testModelId,
				featherlessApiKey: "test-api-key",
			})
			const model = handlerWithModel.getModel()
			expect(model.temperature).toBe(0.5)
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

		it("should handle streaming responses for non-R1 models", async () => {
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

		it("should handle reasoning format from DeepSeek-R1 models using TagMatcher", async () => {
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

			vi.spyOn(handler, "getModel").mockReturnValue({
				id: "some-DeepSeek-R1-model",
				info: { maxTokens: 1024, temperature: 0.6 },
				maxTokens: 1024,
				temperature: 0.6,
			} as any)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks[0]).toEqual({ type: "reasoning", text: "Thinking..." })
			expect(chunks[1]).toEqual({ type: "text", text: "Hello" })
			expect(chunks[2]).toMatchObject({ type: "usage", inputTokens: 10, outputTokens: 5 })
		})

		it("should delegate to super.createMessage for non-DeepSeek-R1 models", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Standard response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 15,
				outputTokens: 8,
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
			})

			vi.spyOn(handler, "getModel").mockReturnValue({
				id: "some-other-model",
				info: { maxTokens: 1024, temperature: 0.5 },
				maxTokens: 1024,
				temperature: 0.5,
			} as any)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks[0]).toEqual({ type: "text", text: "Standard response" })
			expect(chunks[1]).toMatchObject({ type: "usage", inputTokens: 15, outputTokens: 8 })
		})

		it("should pass correct model to streamText for R1 path", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			vi.spyOn(handler, "getModel").mockReturnValue({
				id: "some-DeepSeek-R1-model",
				info: { maxTokens: 2048, temperature: 0.6 },
				maxTokens: 2048,
				temperature: 0.6,
			} as any)

			const stream = handler.createMessage(systemPrompt, messages)
			// Consume stream
			for await (const _ of stream) {
				// drain
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.6,
				}),
			)
		})

		it("should not pass system prompt to streamText for R1 path", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			vi.spyOn(handler, "getModel").mockReturnValue({
				id: "some-DeepSeek-R1-model",
				info: { maxTokens: 2048, temperature: 0.6 },
				maxTokens: 2048,
				temperature: 0.6,
			} as any)

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// drain
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.system).toBeUndefined()
			expect(callArgs.messages).toBeDefined()
		})

		it("should merge consecutive user messages in R1 path to avoid DeepSeek rejection", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			vi.spyOn(handler, "getModel").mockReturnValue({
				id: "some-DeepSeek-R1-model",
				info: { maxTokens: 2048, temperature: 0.6 },
				maxTokens: 2048,
				temperature: 0.6,
			} as any)

			// messages starts with a user message, so after prepending the system
			// prompt as a user message we'd have two consecutive user messages.
			const userFirstMessages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello!" },
				{ role: "assistant", content: "Hi there" },
				{ role: "user", content: "Follow-up" },
			]

			const stream = handler.createMessage(systemPrompt, userFirstMessages)
			for await (const _ of stream) {
				// drain
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			const passedMessages = callArgs.messages

			// Verify no two consecutive messages share the same role
			for (let i = 1; i < passedMessages.length; i++) {
				expect(passedMessages[i].role).not.toBe(passedMessages[i - 1].role)
			}

			// The system prompt and first user message should be merged into a single user message
			expect(passedMessages[0].role).toBe("user")
			expect(passedMessages[1].role).toBe("assistant")
			expect(passedMessages[2].role).toBe("user")
			expect(passedMessages).toHaveLength(3)
		})
	})

	describe("completePrompt", () => {
		it("should complete a prompt using generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test completion from Featherless",
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Test completion from Featherless")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
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
