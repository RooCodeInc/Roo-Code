import type { RooMessage } from "../../../core/task-persistence/rooMessage"
// npx vitest run api/providers/__tests__/openai-native-usage.spec.ts

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

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: vi.fn(() => {
		const provider = vi.fn(() => ({
			modelId: "gpt-4.1",
			provider: "openai",
		}))
		;(provider as any).responses = vi.fn(() => ({
			modelId: "gpt-4.1",
			provider: "openai.responses",
		}))
		return provider
	}),
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import { openAiNativeModels } from "@roo-code/types"

import { OpenAiNativeHandler } from "../openai-native"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("OpenAiNativeHandler - usage metrics", () => {
	let handler: OpenAiNativeHandler
	const systemPrompt = "You are a helpful assistant."
	const messages: RooMessage[] = [{ role: "user", content: "Hello!" }]

	beforeEach(() => {
		handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4.1",
		})
		vi.clearAllMocks()
	})

	describe("basic token counts", () => {
		it("should handle basic input and output tokens", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(100)
			expect(usageChunks[0].outputTokens).toBe(50)
		})

		it("should handle zero tokens", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(0)
			expect(usageChunks[0].outputTokens).toBe(0)
		})
	})

	describe("cache metrics", () => {
		it("should handle cached input tokens from usage details", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 50,
					details: {
						cachedInputTokens: 30,
					},
				}),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].cacheReadTokens).toBe(30)
		})

		it("should handle no cache information", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 50, outputTokens: 25 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].cacheReadTokens).toBeUndefined()
			expect(usageChunks[0].cacheWriteTokens).toBeUndefined()
		})
	})

	describe("reasoning tokens", () => {
		it("should handle reasoning tokens in usage details", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning-delta", text: "thinking..." }
				yield { type: "text-delta", text: "answer" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 50,
					details: {
						reasoningTokens: 30,
					},
				}),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].reasoningTokens).toBe(30)
		})

		it("should omit reasoning tokens when not present", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "answer" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 50,
				}),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].reasoningTokens).toBeUndefined()
		})
	})

	describe("cost calculation", () => {
		it("should include totalCost in usage metrics", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 1000,
					outputTokens: 500,
				}),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(typeof usageChunks[0].totalCost).toBe("number")
			expect(usageChunks[0].totalCost).toBeGreaterThanOrEqual(0)
		})

		it("should handle all details together", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 200,
					outputTokens: 100,
					details: {
						cachedInputTokens: 50,
						reasoningTokens: 25,
					},
				}),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(200)
			expect(usageChunks[0].outputTokens).toBe(100)
			expect(usageChunks[0].cacheReadTokens).toBe(50)
			expect(usageChunks[0].reasoningTokens).toBe(25)
			expect(typeof usageChunks[0].totalCost).toBe("number")
		})
	})

	describe("prompt cache retention", () => {
		it("should set promptCacheRetention=24h for gpt-5.1 models that support prompt caching", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const h = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: "gpt-5.1",
			})

			const stream = h.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			const modelInfo = openAiNativeModels["gpt-5.1"]
			if (modelInfo.supportsPromptCache && modelInfo.promptCacheRetention === "24h") {
				expect(callArgs.providerOptions.openai.promptCacheRetention).toBe("24h")
			}
		})

		it("should not set promptCacheRetention for non-gpt-5.1 models", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions.openai.promptCacheRetention).toBeUndefined()
		})

		it("should not set promptCacheRetention when the model does not support prompt caching", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			// o3-mini doesn't support prompt caching
			const h = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-key",
				apiModelId: "o3-mini-high",
			})

			const stream = h.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions.openai.promptCacheRetention).toBeUndefined()
		})
	})
})
