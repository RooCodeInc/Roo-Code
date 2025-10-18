import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../../shared/api"

import { BaseOpenAiCompatibleProvider } from "../base-openai-compatible-provider"

// Mock OpenAI module
vi.mock("openai", () => {
	const mockCreate = vi.fn()
	const MockOpenAI = vi.fn().mockImplementation(() => ({
		chat: {
			completions: {
				create: mockCreate,
			},
		},
	}))
	return { default: MockOpenAI }
})

// Create a concrete implementation for testing
class TestOpenAiCompatibleProvider extends BaseOpenAiCompatibleProvider<"test-model" | "glm-4.6"> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "TestProvider",
			baseURL: options.openAiBaseUrl || "https://api.test.com/v1",
			defaultProviderModelId: "test-model",
			providerModels: {
				"test-model": {
					maxTokens: 4096,
					contextWindow: 8192,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: 0.01,
					outputPrice: 0.02,
				},
				"glm-4.6": {
					maxTokens: 8192,
					contextWindow: 128000,
					supportsImages: true,
					supportsPromptCache: false,
					inputPrice: 0.015,
					outputPrice: 0.03,
				},
			},
		})
	}
}

describe("BaseOpenAiCompatibleProvider", () => {
	let provider: TestOpenAiCompatibleProvider
	let mockOpenAIInstance: any
	let mockCreate: Mock

	beforeEach(() => {
		vi.clearAllMocks()
		mockOpenAIInstance = new (OpenAI as any)()
		mockCreate = mockOpenAIInstance.chat.completions.create
	})

	describe("GLM-4.6 thinking token support", () => {
		it("should detect GLM-4.6 model correctly", () => {
			provider = new TestOpenAiCompatibleProvider({
				apiKey: "test-key",
				apiModelId: "glm-4.6",
			})

			// Test the isGLM46Model method
			expect((provider as any).isGLM46Model("glm-4.6")).toBe(true)
			expect((provider as any).isGLM46Model("GLM-4.6")).toBe(true)
			expect((provider as any).isGLM46Model("glm-4-6")).toBe(true)
			expect((provider as any).isGLM46Model("GLM-4-6")).toBe(true)
			expect((provider as any).isGLM46Model("test-model")).toBe(false)
			expect((provider as any).isGLM46Model("gpt-4")).toBe(false)
		})

		it("should add thinking parameter for GLM-4.6 model", async () => {
			provider = new TestOpenAiCompatibleProvider({
				apiKey: "test-key",
				apiModelId: "glm-4.6",
			})

			// Mock the stream response
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { content: "Test response" } }],
						usage: { prompt_tokens: 10, completion_tokens: 5 },
					}
				},
			}
			mockCreate.mockResolvedValue(mockStream)

			// Create a message
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = provider.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			// Verify that the create method was called with thinking parameter
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "glm-4.6",
					thinking: { type: "enabled" },
					stream: true,
				}),
				undefined,
			)
		})

		it("should not add thinking parameter for non-GLM-4.6 models", async () => {
			provider = new TestOpenAiCompatibleProvider({
				apiKey: "test-key",
				apiModelId: "test-model",
			})

			// Mock the stream response
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { content: "Test response" } }],
						usage: { prompt_tokens: 10, completion_tokens: 5 },
					}
				},
			}
			mockCreate.mockResolvedValue(mockStream)

			// Create a message
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = provider.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			// Verify that the create method was called without thinking parameter
			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					thinking: expect.anything(),
				}),
				undefined,
			)
		})

		it("should parse thinking tokens from GLM-4.6 response", async () => {
			provider = new TestOpenAiCompatibleProvider({
				apiKey: "test-key",
				apiModelId: "glm-4.6",
			})

			// Mock the stream response with thinking tokens
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { choices: [{ delta: { content: "<think>" } }], usage: null }
					yield { choices: [{ delta: { content: "Let me analyze this problem..." } }], usage: null }
					yield { choices: [{ delta: { content: "</think>" } }], usage: null }
					yield { choices: [{ delta: { content: "The answer is 42." } }], usage: null }
					yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 20 } }
				},
			}
			mockCreate.mockResolvedValue(mockStream)

			// Create a message
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "What is the meaning of life?" },
			]

			const stream = provider.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			// Verify that thinking tokens were parsed correctly
			const reasoningChunks = results.filter((r) => r.type === "reasoning")
			const textChunks = results.filter((r) => r.type === "text")

			expect(reasoningChunks.length).toBeGreaterThan(0)
			expect(reasoningChunks.some((c) => c.text?.includes("Let me analyze this problem"))).toBe(true)
			expect(textChunks.some((c) => c.text === "The answer is 42.")).toBe(true)
		})

		it("should handle reasoning_content in delta for models that support it", async () => {
			provider = new TestOpenAiCompatibleProvider({
				apiKey: "test-key",
				apiModelId: "glm-4.6",
			})

			// Mock the stream response with reasoning_content
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { choices: [{ delta: { reasoning_content: "Thinking about the problem..." } }], usage: null }
					yield { choices: [{ delta: { content: "The solution is simple." } }], usage: null }
					yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 15 } }
				},
			}
			mockCreate.mockResolvedValue(mockStream)

			// Create a message
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Solve this problem" }]

			const stream = provider.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			// Verify that reasoning_content was handled correctly
			const reasoningChunks = results.filter((r) => r.type === "reasoning")
			const textChunks = results.filter((r) => r.type === "text")

			expect(reasoningChunks.some((c) => c.text === "Thinking about the problem...")).toBe(true)
			expect(textChunks.some((c) => c.text === "The solution is simple.")).toBe(true)
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			provider = new TestOpenAiCompatibleProvider({
				apiKey: "test-key",
				apiModelId: "test-model",
			})

			const mockResponse = {
				choices: [{ message: { content: "Completed response" } }],
			}
			mockCreate.mockResolvedValue(mockResponse)

			const result = await provider.completePrompt("Test prompt")

			expect(result).toBe("Completed response")
			expect(mockCreate).toHaveBeenCalledWith({
				model: "test-model",
				messages: [{ role: "user", content: "Test prompt" }],
			})
		})
	})

	describe("getModel", () => {
		it("should return correct model info", () => {
			provider = new TestOpenAiCompatibleProvider({
				apiKey: "test-key",
				apiModelId: "glm-4.6",
			})

			const model = provider.getModel()

			expect(model.id).toBe("glm-4.6")
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(128000)
		})

		it("should use default model when apiModelId is not provided", () => {
			provider = new TestOpenAiCompatibleProvider({
				apiKey: "test-key",
			})

			const model = provider.getModel()

			expect(model.id).toBe("test-model")
			expect(model.info.maxTokens).toBe(4096)
		})
	})
})
