import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildApiHandler } from "../../index"
import { OpenAiHandler } from "../openai"

vi.mock("openai", () => {
	const mockCreate = vi.fn()
	return {
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		})),
		OpenAI: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		})),
		AzureOpenAI: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		})),
	}
})

describe("OpenAI Compatible Provider", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should create OpenAiHandler when apiProvider is 'openai-compatible'", () => {
		const handler = buildApiHandler({
			apiProvider: "openai-compatible",
			openAiApiKey: "test-key",
			openAiBaseUrl: "https://api.example.com/v1",
			openAiModelId: "test-model",
		})

		expect(handler).toBeInstanceOf(OpenAiHandler)
	})

	it("should handle token usage correctly for openai-compatible provider", async () => {
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield {
					choices: [{ delta: { content: "Hello" } }],
				}
				yield {
					choices: [{ delta: { content: " world" } }],
				}
				yield {
					choices: [{ delta: {} }],
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
						total_tokens: 15,
					},
				}
			},
		}

		const OpenAI = (await import("openai")).default
		const mockCreate = vi.fn().mockResolvedValue(mockStream)
		;(OpenAI as any).mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		}))

		const handler = buildApiHandler({
			apiProvider: "openai-compatible",
			openAiApiKey: "test-key",
			openAiBaseUrl: "https://api.example.com/v1",
			openAiModelId: "test-model",
		})

		const messages = [{ role: "user" as const, content: "Test message" }]
		const stream = handler.createMessage("System prompt", messages)

		const chunks = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		// Check that we got text chunks
		const textChunks = chunks.filter((c) => c.type === "text")
		expect(textChunks).toHaveLength(2)
		expect(textChunks[0].text).toBe("Hello")
		expect(textChunks[1].text).toBe(" world")

		// Check that we got usage data
		const usageChunk = chunks.find((c) => c.type === "usage")
		expect(usageChunk).toBeDefined()
		expect(usageChunk).toEqual({
			type: "usage",
			inputTokens: 10,
			outputTokens: 5,
		})
	})

	it("should use the same configuration as openai provider", () => {
		const config = {
			openAiApiKey: "test-key",
			openAiBaseUrl: "https://api.example.com/v1",
			openAiModelId: "test-model",
			openAiCustomModelInfo: {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsPromptCache: false,
				inputPrice: 0.001,
				outputPrice: 0.002,
			},
		}

		const openaiHandler = buildApiHandler({
			apiProvider: "openai",
			...config,
		})

		const openaiCompatibleHandler = buildApiHandler({
			apiProvider: "openai-compatible",
			...config,
		})

		// Both should be instances of OpenAiHandler
		expect(openaiHandler).toBeInstanceOf(OpenAiHandler)
		expect(openaiCompatibleHandler).toBeInstanceOf(OpenAiHandler)

		// Both should have the same model configuration
		expect(openaiHandler.getModel()).toEqual(openaiCompatibleHandler.getModel())
	})
})
