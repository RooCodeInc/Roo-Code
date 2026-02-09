// npx vitest run api/providers/__tests__/native-ollama.spec.ts

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
			modelId: "llama2",
			provider: "ollama",
		}))
	}),
}))

vi.mock("../fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({}),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

import { ollamaDefaultModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { NativeOllamaHandler } from "../native-ollama"

describe("NativeOllamaHandler", () => {
	let handler: NativeOllamaHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		vi.clearAllMocks()
		mockOptions = {
			ollamaModelId: "llama2",
			ollamaBaseUrl: "http://localhost:11434",
			ollamaApiKey: "test-key",
		}
		handler = new NativeOllamaHandler(mockOptions)
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(NativeOllamaHandler)
			expect(handler.getModel().id).toBe("llama2")
		})

		it("should configure the provider with correct base URL", () => {
			expect(createOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "ollama",
					baseURL: "http://localhost:11434/v1",
				}),
			)
		})

		it("should strip trailing slashes from base URL", () => {
			new NativeOllamaHandler({
				...mockOptions,
				ollamaBaseUrl: "http://localhost:11434/",
			})
			expect(createOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "http://localhost:11434/v1",
				}),
			)
		})

		it("should use default base URL when not provided", () => {
			new NativeOllamaHandler({
				...mockOptions,
				ollamaBaseUrl: undefined,
			})
			expect(createOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "http://localhost:11434/v1",
				}),
			)
		})

		it("should use 'ollama' as default API key when not provided", () => {
			new NativeOllamaHandler({
				...mockOptions,
				ollamaApiKey: undefined,
			})
			expect(createOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "ollama",
				}),
			)
		})

		it("should use provided API key", () => {
			new NativeOllamaHandler({
				...mockOptions,
				ollamaApiKey: "my-secret-key",
			})
			expect(createOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "my-secret-key",
				}),
			)
		})
	})

	describe("getModel", () => {
		it("should return model info using defaults when cache is empty", () => {
			const model = handler.getModel()
			expect(model.id).toBe("llama2")
			expect(model.info).toEqual(ollamaDefaultModelInfo)
		})

		it("should return empty string model ID when no model is configured", () => {
			const handlerNoModel = new NativeOllamaHandler({
				...mockOptions,
				ollamaModelId: undefined,
			})
			const model = handlerNoModel.getModel()
			expect(model.id).toBe("")
			expect(model.info).toEqual(ollamaDefaultModelInfo)
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})

		it("should use default temperature of 0", () => {
			const handlerNoTemp = new NativeOllamaHandler({
				...mockOptions,
				modelTemperature: undefined,
			})
			const model = handlerNoTemp.getModel()
			expect(model.temperature).toBe(0)
		})

		it("should use custom temperature when specified", () => {
			const handlerCustomTemp = new NativeOllamaHandler({
				...mockOptions,
				modelTemperature: 0.7,
			})
			const model = handlerCustomTemp.getModel()
			expect(model.temperature).toBe(0.7)
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
				yield { type: "text-delta", text: "Hello" }
				yield { type: "text-delta", text: " world" }
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
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Hello")
			expect(textChunks[1].text).toBe(" world")
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

		it("should delegate to super.createMessage when num_ctx is not set", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			// Should be called without providerOptions (base class call)
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.not.objectContaining({
					providerOptions: expect.anything(),
				}),
			)
		})

		it("should pass num_ctx via providerOptions when ollamaNumCtx is set", async () => {
			const handlerWithNumCtx = new NativeOllamaHandler({
				...mockOptions,
				ollamaNumCtx: 8192,
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }),
			})

			const stream = handlerWithNumCtx.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: { ollama: { num_ctx: 8192 } },
				}),
			)
		})

		it("should handle errors through handleAiSdkError", async () => {
			async function* mockFullStream() {
				yield undefined // Need a yield before throwing (C9)
				throw new Error("Connection refused")
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			await expect(async () => {
				for await (const _ of stream) {
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

		it("should delegate to super.completePrompt when num_ctx is not set", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test completion",
			})

			await handler.completePrompt("Test prompt")

			// Should be called without providerOptions (base class call)
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.not.objectContaining({
					providerOptions: expect.anything(),
				}),
			)
		})

		it("should pass num_ctx via providerOptions when ollamaNumCtx is set", async () => {
			const handlerWithNumCtx = new NativeOllamaHandler({
				...mockOptions,
				ollamaNumCtx: 16384,
			})

			mockGenerateText.mockResolvedValue({
				text: "Test completion",
			})

			await handlerWithNumCtx.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: { ollama: { num_ctx: 16384 } },
				}),
			)
		})
	})

	describe("tool handling", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: NeutralMessageParam[] = [
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

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
				}),
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
			expect(toolCallStartChunks.length).toBe(1)
			expect(toolCallStartChunks[0].name).toBe("read_file")
			expect(toolCallStartChunks[0].id).toBe("tool-call-1")
		})
	})
})
