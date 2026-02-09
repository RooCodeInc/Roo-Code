// npx vitest run src/api/providers/__tests__/zai.spec.ts

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

vi.mock("zhipu-ai-provider", () => ({
	createZhipu: vi.fn(() => {
		return vi.fn(() => ({
			modelId: "glm-4.6",
			provider: "zhipu",
		}))
	}),
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import {
	type InternationalZAiModelId,
	type MainlandZAiModelId,
	internationalZAiDefaultModelId,
	mainlandZAiDefaultModelId,
	internationalZAiModels,
	mainlandZAiModels,
	ZAI_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { ZAiHandler } from "../zai"

describe("ZAiHandler", () => {
	let handler: ZAiHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			zaiApiKey: "test-zai-api-key",
			zaiApiLine: "international_coding",
			apiModelId: "glm-4.6",
		}
		handler = new ZAiHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(ZAiHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should default to international when no zaiApiLine is specified", () => {
			const handlerDefault = new ZAiHandler({ zaiApiKey: "test-zai-api-key" })
			const model = handlerDefault.getModel()
			expect(model.id).toBe(internationalZAiDefaultModelId)
			expect(model.info).toEqual(internationalZAiModels[internationalZAiDefaultModelId])
		})
	})

	describe("International Z AI", () => {
		beforeEach(() => {
			handler = new ZAiHandler({ zaiApiKey: "test-zai-api-key", zaiApiLine: "international_coding" })
		})

		it("should return international default model when no model is specified", () => {
			const model = handler.getModel()
			expect(model.id).toBe(internationalZAiDefaultModelId)
			expect(model.info).toEqual(internationalZAiModels[internationalZAiDefaultModelId])
		})

		it("should return specified international model when valid model is provided", () => {
			const testModelId: InternationalZAiModelId = "glm-4.5-air"
			const handlerWithModel = new ZAiHandler({
				apiModelId: testModelId,
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "international_coding",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(internationalZAiModels[testModelId])
		})

		it("should return GLM-4.6 international model with correct configuration", () => {
			const testModelId: InternationalZAiModelId = "glm-4.6"
			const handlerWithModel = new ZAiHandler({
				apiModelId: testModelId,
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "international_coding",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(internationalZAiModels[testModelId])
			expect(model.info.contextWindow).toBe(200_000)
		})

		it("should return GLM-4.7 international model with thinking support", () => {
			const testModelId: InternationalZAiModelId = "glm-4.7"
			const handlerWithModel = new ZAiHandler({
				apiModelId: testModelId,
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "international_coding",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(internationalZAiModels[testModelId])
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.supportsReasoningEffort).toEqual(["disable", "medium"])
			expect(model.info.reasoningEffort).toBe("medium")
			expect(model.info.preserveReasoning).toBe(true)
		})

		it("should return GLM-4.5v international model with vision support", () => {
			const testModelId: InternationalZAiModelId = "glm-4.5v"
			const handlerWithModel = new ZAiHandler({
				apiModelId: testModelId,
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "international_coding",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(internationalZAiModels[testModelId])
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.maxTokens).toBe(16_384)
			expect(model.info.contextWindow).toBe(131_072)
		})
	})

	describe("China Z AI", () => {
		beforeEach(() => {
			handler = new ZAiHandler({ zaiApiKey: "test-zai-api-key", zaiApiLine: "china_coding" })
		})

		it("should return China default model when no model is specified", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mainlandZAiDefaultModelId)
			expect(model.info).toEqual(mainlandZAiModels[mainlandZAiDefaultModelId])
		})

		it("should return specified China model when valid model is provided", () => {
			const testModelId: MainlandZAiModelId = "glm-4.5-air"
			const handlerWithModel = new ZAiHandler({
				apiModelId: testModelId,
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "china_coding",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(mainlandZAiModels[testModelId])
		})

		it("should return GLM-4.6 China model with correct configuration", () => {
			const testModelId: MainlandZAiModelId = "glm-4.6"
			const handlerWithModel = new ZAiHandler({
				apiModelId: testModelId,
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "china_coding",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(mainlandZAiModels[testModelId])
			expect(model.info.contextWindow).toBe(204_800)
		})

		it("should return GLM-4.5v China model with vision support", () => {
			const testModelId: MainlandZAiModelId = "glm-4.5v"
			const handlerWithModel = new ZAiHandler({
				apiModelId: testModelId,
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "china_coding",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(mainlandZAiModels[testModelId])
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.maxTokens).toBe(16_384)
			expect(model.info.contextWindow).toBe(131_072)
		})

		it("should return GLM-4.7 China model with thinking support", () => {
			const testModelId: MainlandZAiModelId = "glm-4.7"
			const handlerWithModel = new ZAiHandler({
				apiModelId: testModelId,
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "china_coding",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(mainlandZAiModels[testModelId])
			expect(model.info.contextWindow).toBe(204_800)
			expect(model.info.supportsReasoningEffort).toEqual(["disable", "medium"])
			expect(model.info.reasoningEffort).toBe("medium")
			expect(model.info.preserveReasoning).toBe(true)
		})
	})

	describe("International API", () => {
		beforeEach(() => {
			handler = new ZAiHandler({ zaiApiKey: "test-zai-api-key", zaiApiLine: "international_api" })
		})

		it("should return international default model when no model is specified", () => {
			const model = handler.getModel()
			expect(model.id).toBe(internationalZAiDefaultModelId)
			expect(model.info).toEqual(internationalZAiModels[internationalZAiDefaultModelId])
		})

		it("should return specified international model when valid model is provided", () => {
			const testModelId: InternationalZAiModelId = "glm-4.5-air"
			const handlerWithModel = new ZAiHandler({
				apiModelId: testModelId,
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "international_api",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(internationalZAiModels[testModelId])
		})
	})

	describe("China API", () => {
		beforeEach(() => {
			handler = new ZAiHandler({ zaiApiKey: "test-zai-api-key", zaiApiLine: "china_api" })
		})

		it("should return China default model when no model is specified", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mainlandZAiDefaultModelId)
			expect(model.info).toEqual(mainlandZAiModels[mainlandZAiDefaultModelId])
		})

		it("should return specified China model when valid model is provided", () => {
			const testModelId: MainlandZAiModelId = "glm-4.5-air"
			const handlerWithModel = new ZAiHandler({
				apiModelId: testModelId,
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "china_api",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(mainlandZAiModels[testModelId])
		})
	})

	describe("getModel", () => {
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
				content: [{ type: "text" as const, text: "Hello!" }],
			},
		]

		it("should handle streaming responses", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response from Z.ai" }
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
			expect(textChunks[0].text).toBe("Test response from Z.ai")
		})

		it("should include usage information", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 20,
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
			expect(usageChunks[0].outputTokens).toBe(20)
		})

		it("should pass correct parameters to streamText", async () => {
			async function* mockFullStream() {
				// empty stream
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			// Consume the stream
			for await (const _chunk of stream) {
				// drain
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: systemPrompt,
					temperature: expect.any(Number),
				}),
			)
		})
	})

	describe("GLM-4.7 Thinking Mode", () => {
		it("should enable thinking by default for GLM-4.7 (default reasoningEffort is medium)", async () => {
			const handlerWithModel = new ZAiHandler({
				apiModelId: "glm-4.7",
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "international_coding",
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handlerWithModel.createMessage("system prompt", [])
			for await (const _chunk of stream) {
				// drain
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: {
						zhipu: {
							thinking: { type: "enabled" },
						},
					},
				}),
			)
		})

		it("should disable thinking for GLM-4.7 when reasoningEffort is set to disable", async () => {
			const handlerWithModel = new ZAiHandler({
				apiModelId: "glm-4.7",
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "international_coding",
				enableReasoningEffort: true,
				reasoningEffort: "disable",
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handlerWithModel.createMessage("system prompt", [])
			for await (const _chunk of stream) {
				// drain
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: {
						zhipu: {
							thinking: { type: "disabled" },
						},
					},
				}),
			)
		})

		it("should enable thinking for GLM-4.7 when reasoningEffort is set to medium", async () => {
			const handlerWithModel = new ZAiHandler({
				apiModelId: "glm-4.7",
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "international_coding",
				enableReasoningEffort: true,
				reasoningEffort: "medium",
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handlerWithModel.createMessage("system prompt", [])
			for await (const _chunk of stream) {
				// drain
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: {
						zhipu: {
							thinking: { type: "enabled" },
						},
					},
				}),
			)
		})

		it("should NOT add providerOptions for non-thinking models like GLM-4.6", async () => {
			const handlerWithModel = new ZAiHandler({
				apiModelId: "glm-4.6",
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "international_coding",
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handlerWithModel.createMessage("system prompt", [])
			for await (const _chunk of stream) {
				// drain
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions).toBeUndefined()
		})

		it("should handle reasoning content in streaming responses", async () => {
			const handlerWithModel = new ZAiHandler({
				apiModelId: "glm-4.7",
				zaiApiKey: "test-zai-api-key",
				zaiApiLine: "international_coding",
			})

			async function* mockFullStream() {
				yield { type: "reasoning", text: "Let me think about this..." }
				yield { type: "text-delta", text: "Here is my answer" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20 }),
			})

			const stream = handlerWithModel.createMessage("system prompt", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Let me think about this...")

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Here is my answer")
		})
	})

	describe("completePrompt", () => {
		it("should complete a prompt using generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test completion from Z.ai",
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Test completion from Z.ai")
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
