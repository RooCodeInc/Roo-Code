import type { RooMessage } from "../../../core/task-persistence/rooMessage"
// npx vitest run src/api/providers/__tests__/baseten.spec.ts

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

vi.mock("@ai-sdk/baseten", () => ({
	createBaseten: vi.fn(() => {
		return vi.fn(() => ({
			modelId: "zai-org/GLM-4.6",
			provider: "baseten",
		}))
	}),
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import { basetenDefaultModelId, basetenModels, type BasetenModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { BasetenHandler } from "../baseten"

describe("BasetenHandler", () => {
	let handler: BasetenHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			basetenApiKey: "test-baseten-api-key",
			apiModelId: "zai-org/GLM-4.6",
		}
		handler = new BasetenHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(BasetenHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should use default model ID if not provided", () => {
			const handlerWithoutModel = new BasetenHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			expect(handlerWithoutModel.getModel().id).toBe(basetenDefaultModelId)
		})
	})

	describe("getModel", () => {
		it("should return default model when no model is specified", () => {
			const handlerWithoutModel = new BasetenHandler({
				basetenApiKey: "test-baseten-api-key",
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe(basetenDefaultModelId)
			expect(model.info).toEqual(basetenModels[basetenDefaultModelId])
		})

		it("should return specified model when valid model is provided", () => {
			const testModelId: BasetenModelId = "deepseek-ai/DeepSeek-R1"
			const handlerWithModel = new BasetenHandler({
				apiModelId: testModelId,
				basetenApiKey: "test-baseten-api-key",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(basetenModels[testModelId])
		})

		it("should return provided model ID with default model info if model does not exist", () => {
			const handlerWithInvalidModel = new BasetenHandler({
				...mockOptions,
				apiModelId: "invalid-model",
			})
			const model = handlerWithInvalidModel.getModel()
			expect(model.id).toBe("invalid-model")
			expect(model.info).toBeDefined()
			expect(model.info).toBe(basetenModels[basetenDefaultModelId])
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: RooMessage[] = [
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
				yield { type: "text-delta", text: "Test response from Baseten" }
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
			expect(textChunks[0].text).toBe("Test response from Baseten")
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

		it("should pass correct temperature (0.5 default) to streamText", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const handlerWithDefaultTemp = new BasetenHandler({
				basetenApiKey: "test-key",
				apiModelId: "zai-org/GLM-4.6",
			})

			const stream = handlerWithDefaultTemp.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.5,
				}),
			)
		})

		it("should use user-specified temperature over default", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const handlerWithCustomTemp = new BasetenHandler({
				basetenApiKey: "test-key",
				apiModelId: "zai-org/GLM-4.6",
				modelTemperature: 0.9,
			})

			const stream = handlerWithCustomTemp.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.9,
				}),
			)
		})

		it("should handle stream with multiple chunks", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Hello" }
				yield { type: "text-delta", text: " world" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 5, outputTokens: 10 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks[0]).toEqual({ type: "text", text: "Hello" })
			expect(textChunks[1]).toEqual({ type: "text", text: " world" })

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks[0]).toMatchObject({ type: "usage", inputTokens: 5, outputTokens: 10 })
		})
	})

	describe("completePrompt", () => {
		it("should complete a prompt using generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test completion from Baseten",
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Test completion from Baseten")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
				}),
			)
		})

		it("should use default temperature in completePrompt", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test completion",
			})

			await handler.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.5,
				}),
			)
		})
	})

	describe("tool handling", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: RooMessage[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Hello!" }],
			},
		]

		it("should handle tool calls in streaming", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-input-start",
					id: "tool-call-1",
					toolName: "read_file",
				}
				yield {
					type: "tool-input-delta",
					id: "tool-call-1",
					delta: '{"path":"test.ts"}',
				}
				yield {
					type: "tool-input-end",
					id: "tool-call-1",
				}
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
			})

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: [
					{
						type: "function",
						function: {
							name: "read_file",
							description: "Read a file",
							parameters: {
								type: "object",
								properties: { path: { type: "string" } },
								required: ["path"],
							},
						},
					},
				],
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolCallStartChunks = chunks.filter((c) => c.type === "tool_call_start")
			const toolCallDeltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
			const toolCallEndChunks = chunks.filter((c) => c.type === "tool_call_end")

			expect(toolCallStartChunks.length).toBe(1)
			expect(toolCallStartChunks[0].id).toBe("tool-call-1")
			expect(toolCallStartChunks[0].name).toBe("read_file")

			expect(toolCallDeltaChunks.length).toBe(1)
			expect(toolCallDeltaChunks[0].delta).toBe('{"path":"test.ts"}')

			expect(toolCallEndChunks.length).toBe(1)
			expect(toolCallEndChunks[0].id).toBe("tool-call-1")
		})

		it("should ignore tool-call events to prevent duplicate tools in UI", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-call",
					toolCallId: "tool-call-1",
					toolName: "read_file",
					input: { path: "test.ts" },
				}
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

			const toolCallChunks = chunks.filter(
				(c) => c.type === "tool_call_start" || c.type === "tool_call_delta" || c.type === "tool_call_end",
			)
			expect(toolCallChunks.length).toBe(0)
		})
	})

	describe("error handling", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: RooMessage[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Hello!" }],
			},
		]

		it("should handle AI SDK errors with handleAiSdkError", async () => {
			// eslint-disable-next-line require-yield
			async function* mockFullStream(): AsyncGenerator<any> {
				throw new Error("API Error")
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("Baseten: API Error")
		})

		it("should preserve status codes in error handling", async () => {
			const apiError = new Error("Rate limit exceeded")
			;(apiError as any).status = 429

			// eslint-disable-next-line require-yield
			async function* mockFullStream(): AsyncGenerator<any> {
				throw apiError
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)

			try {
				for await (const _ of stream) {
					// consume stream
				}
				expect.fail("Should have thrown an error")
			} catch (error: any) {
				expect(error.message).toContain("Baseten")
				expect(error.status).toBe(429)
			}
		})
	})
})
