// npx vitest run api/providers/__tests__/base-openai-compatible-provider-retry.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { BaseOpenAiCompatibleProvider } from "../base-openai-compatible-provider"
import type { ModelInfo } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../../shared/api"

// Mock the OpenAI client
vi.mock("openai")

// Create a concrete implementation for testing
class TestProvider extends BaseOpenAiCompatibleProvider<"test-model"> {
	constructor(options: ApiHandlerOptions) {
		super({
			providerName: "TestProvider",
			baseURL: "https://test.api.com/v1",
			defaultProviderModelId: "test-model",
			providerModels: {
				"test-model": {
					maxTokens: 4096,
					contextWindow: 8192,
					supportsPromptCache: false,
					inputPrice: 0,
					outputPrice: 0,
				} as ModelInfo,
			},
			...options,
		})
	}
}

describe("BaseOpenAiCompatibleProvider - HTTP 400 Retry Logic", () => {
	let provider: TestProvider
	let mockCreate: ReturnType<typeof vi.fn>
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		// Mock the OpenAI client's create method
		mockCreate = vi.fn()
		;(OpenAI as any).mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		}))

		// Spy on console.warn to verify retry messages
		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

		provider = new TestProvider({
			apiKey: "test-key",
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleWarnSpy.mockRestore()
	})

	describe("createStream", () => {
		it("should retry with truncated conversation history on HTTP 400 error", async () => {
			// First call fails with 400, second call succeeds
			mockCreate
				.mockRejectedValueOnce({ status: 400, message: "Bad Request" })
				.mockResolvedValueOnce(createMockStream())

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = Array.from({ length: 20 }, (_, i) => ({
				role: i % 2 === 0 ? "user" : "assistant",
				content: `Message ${i}`,
			}))

			const stream = await provider["createStream"](systemPrompt, messages)

			// Verify the stream was returned
			expect(stream).toBeDefined()

			// Verify retry was attempted
			expect(mockCreate).toHaveBeenCalledTimes(2)

			// Verify warning was logged
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"[TestProvider] Received HTTP 400 error, retrying with truncated conversation history",
				),
			)

			// Verify second call had truncated messages
			const secondCallParams = mockCreate.mock.calls[1][0]
			expect(secondCallParams.messages.length).toBeLessThan(21) // system + 20 messages originally
		})

		it("should progressively truncate more messages on multiple retries", async () => {
			// All calls fail with 400 to test progressive truncation
			mockCreate
				.mockRejectedValueOnce({ status: 400, message: "Bad Request" })
				.mockRejectedValueOnce({ response: { status: 400 } })
				.mockRejectedValueOnce(new Error("400 Bad Request"))
				.mockRejectedValueOnce({ status: 400 }) // Final failure

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = Array.from({ length: 30 }, (_, i) => ({
				role: i % 2 === 0 ? "user" : "assistant",
				content: `Message ${i}`,
			}))

			await expect(provider["createStream"](systemPrompt, messages)).rejects.toThrow()

			// Verify all retry attempts were made
			expect(mockCreate).toHaveBeenCalledTimes(4) // Initial + 3 retries

			// Verify progressive truncation
			const messageCounts = mockCreate.mock.calls.map((call) => call[0].messages.length)
			expect(messageCounts[0]).toBe(31) // system + 30 messages
			expect(messageCounts[1]).toBeLessThan(messageCounts[0]) // First truncation
			expect(messageCounts[2]).toBeLessThan(messageCounts[1]) // Second truncation
			// The third truncation might hit the minimum of 10 messages, so it could be equal
			expect(messageCounts[3]).toBeLessThanOrEqual(messageCounts[2]) // Third truncation or minimum reached
		})

		it("should not retry on non-400 errors", async () => {
			mockCreate.mockRejectedValueOnce({ status: 500, message: "Internal Server Error" })

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			await expect(provider["createStream"](systemPrompt, messages)).rejects.toThrow()

			// Should not retry
			expect(mockCreate).toHaveBeenCalledTimes(1)
			expect(consoleWarnSpy).not.toHaveBeenCalled()
		})

		it("should not truncate if conversation has 10 or fewer messages", async () => {
			mockCreate
				.mockRejectedValueOnce({ status: 400, message: "Bad Request" })
				.mockResolvedValueOnce(createMockStream())

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = Array.from({ length: 5 }, (_, i) => ({
				role: i % 2 === 0 ? "user" : "assistant",
				content: `Message ${i}`,
			}))

			await provider["createStream"](systemPrompt, messages)

			// Both calls should have the same number of messages
			const firstCallParams = mockCreate.mock.calls[0][0]
			const secondCallParams = mockCreate.mock.calls[1][0]
			expect(firstCallParams.messages.length).toBe(6) // system + 5 messages
			expect(secondCallParams.messages.length).toBe(6) // No truncation
		})
	})

	describe("completePrompt", () => {
		it("should retry with truncated prompt on HTTP 400 error", async () => {
			const mockResponse = {
				choices: [{ message: { content: "Response" } }],
			}

			mockCreate
				.mockRejectedValueOnce({ status: 400, message: "Bad Request" })
				.mockResolvedValueOnce(mockResponse)

			const longPrompt = "a".repeat(2000) // Long prompt
			const result = await provider.completePrompt(longPrompt)

			expect(result).toBe("Response")
			expect(mockCreate).toHaveBeenCalledTimes(2)

			// Verify second call had truncated prompt
			const secondCallPrompt = mockCreate.mock.calls[1][0].messages[0].content
			expect(secondCallPrompt.length).toBeLessThan(longPrompt.length)
		})

		it("should not retry for short prompts", async () => {
			mockCreate.mockRejectedValueOnce({ status: 400, message: "Bad Request" })

			const shortPrompt = "Hello"
			await expect(provider.completePrompt(shortPrompt)).rejects.toThrow()

			// Should not retry for short prompts
			expect(mockCreate).toHaveBeenCalledTimes(1)
		})

		it("should handle provider-specific error responses", async () => {
			const mockResponse = {
				base_resp: {
					status_code: 1001,
					status_msg: "Provider specific error",
				},
				choices: [],
			}

			mockCreate.mockResolvedValueOnce(mockResponse)

			await expect(provider.completePrompt("Test")).rejects.toThrow(
				"TestProvider API Error (1001): Provider specific error",
			)
		})
	})
})

// Helper function to create a mock stream
function createMockStream() {
	return {
		async *[Symbol.asyncIterator]() {
			yield {
				choices: [{ delta: { content: "Test" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}
		},
	}
}
