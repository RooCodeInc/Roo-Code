import type { RooMessage } from "../../../core/task-persistence/rooMessage"
// npx vitest run api/providers/__tests__/openai-usage-tracking.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"

import { ApiHandlerOptions } from "../../../shared/api"
import { OpenAiHandler } from "../openai"

const { mockStreamText } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: vi.fn(),
	}
})

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: vi.fn(() => ({
		chat: vi.fn(() => ({
			modelId: "gpt-4",
			provider: "openai.chat",
		})),
	})),
}))

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: vi.fn(() => vi.fn((modelId: string) => ({ modelId, provider: "openai-compatible" }))),
}))

vi.mock("@ai-sdk/azure", () => ({
	createAzure: vi.fn(() => ({
		chat: vi.fn((modelId: string) => ({ modelId, provider: "azure.chat" })),
	})),
}))

describe("OpenAiHandler with usage tracking fix", () => {
	let handler: OpenAiHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			openAiApiKey: "test-api-key",
			openAiModelId: "gpt-4",
			openAiBaseUrl: "https://api.openai.com/v1",
		}
		handler = new OpenAiHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("usage metrics with streaming", () => {
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

		it("should only yield usage metrics once at the end of the stream", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test " }
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValueOnce({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
				}),
				providerMetadata: Promise.resolve(undefined),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Test ")
			expect(textChunks[1].text).toBe("response")

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
			})

			const lastChunk = chunks[chunks.length - 1]
			expect(lastChunk.type).toBe("usage")
			expect(lastChunk.inputTokens).toBe(10)
			expect(lastChunk.outputTokens).toBe(5)
		})

		it("should handle case where usage is provided after stream completes", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test " }
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValueOnce({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
				}),
				providerMetadata: Promise.resolve(undefined),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
			})
		})

		it("should handle case where no usage is provided", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValueOnce({
				fullStream: mockFullStream(),
				usage: Promise.resolve(undefined),
				providerMetadata: Promise.resolve(undefined),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(0)
		})

		it("should include reasoningTokens from usage.details", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValueOnce({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
					details: {
						reasoningTokens: 3,
					},
				}),
				providerMetadata: Promise.resolve(undefined),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toEqual(
				expect.objectContaining({
					type: "usage",
					inputTokens: 10,
					outputTokens: 5,
					reasoningTokens: 3,
				}),
			)
		})

		it("should extract cache and reasoning tokens from providerMetadata", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValueOnce({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 50,
				}),
				providerMetadata: Promise.resolve({
					openai: {
						cachedPromptTokens: 80,
						reasoningTokens: 20,
					},
				}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toEqual(
				expect.objectContaining({
					type: "usage",
					inputTokens: 100,
					outputTokens: 50,
					cacheReadTokens: 80,
					reasoningTokens: 20,
				}),
			)
		})
	})
})
