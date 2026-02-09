// npx vitest run api/providers/__tests__/openai-usage-tracking.spec.ts

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

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import type { ApiHandlerOptions } from "../../../shared/api"
import { OpenAiHandler } from "../openai"

describe("OpenAiHandler with usage tracking (AI SDK)", () => {
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

		it("should only yield usage metrics once at the end of the stream", async () => {
			// AI SDK provides usage once after the stream completes
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test " }
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
				}),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Check we have text chunks
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Test ")
			expect(textChunks[1].text).toBe("response")

			// Check we only have one usage chunk and it's the last one
			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheWriteTokens: undefined,
				cacheReadTokens: undefined,
			})

			// Check the usage chunk is the last one
			const lastChunk = chunks[chunks.length - 1]
			expect(lastChunk.type).toBe("usage")
			expect(lastChunk.inputTokens).toBe(10)
			expect(lastChunk.outputTokens).toBe(5)
		})

		it("should handle case where usage includes cache details", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
					details: {
						cachedInputTokens: 3,
					},
				}),
				providerMetadata: Promise.resolve({
					openai: {
						cacheCreationInputTokens: 7,
					},
				}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Check usage metrics include cache info
			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheReadTokens: 3,
				cacheWriteTokens: 7,
			})
		})

		it("should handle case where no usage is provided", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve(undefined),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Check we don't have any usage chunks when usage is undefined
			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(0)
		})
	})
})
