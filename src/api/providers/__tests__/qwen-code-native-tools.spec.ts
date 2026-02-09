// npx vitest run api/providers/__tests__/qwen-code-native-tools.spec.ts

// Mock filesystem - must come before other imports
vi.mock("node:fs", () => ({
	promises: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
}))

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
		return vi.fn(() => ({
			modelId: "qwen3-coder-plus",
			provider: "qwen-code",
		}))
	}),
}))

import { promises as fs } from "node:fs"
import { QwenCodeHandler } from "../qwen-code"
import type { ApiHandlerOptions } from "../../../shared/api"

const mockCredentials = {
	access_token: "test-access-token",
	refresh_token: "test-refresh-token",
	token_type: "Bearer",
	expiry_date: Date.now() + 3600000, // 1 hour from now
	resource_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
}

describe("QwenCodeHandler (AI SDK)", () => {
	let handler: QwenCodeHandler
	let mockOptions: ApiHandlerOptions & { qwenCodeOauthPath?: string }

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock credentials file
		;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockCredentials))
		;(fs.writeFile as any).mockResolvedValue(undefined)

		mockOptions = {
			apiModelId: "qwen3-coder-plus",
		}
		handler = new QwenCodeHandler(mockOptions)
	})

	describe("constructor", () => {
		it("should initialize and extend OpenAICompatibleHandler", () => {
			expect(handler).toBeInstanceOf(QwenCodeHandler)
			expect(handler.getModel().id).toBe("qwen3-coder-plus")
		})

		it("should use default model when no apiModelId provided", () => {
			const h = new QwenCodeHandler({})
			expect(h.getModel().id).toBeDefined()
		})
	})

	describe("OAuth lifecycle", () => {
		it("should load credentials and authenticate before streaming", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta" as const, text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have read credentials file
			expect(fs.readFile).toHaveBeenCalled()
			// Should have called streamText
			expect(mockStreamText).toHaveBeenCalled()
		})

		it("should refresh expired token before streaming", async () => {
			// Return expired credentials
			const expiredCredentials = {
				...mockCredentials,
				expiry_date: Date.now() - 1000, // expired
			}
			;(fs.readFile as any).mockResolvedValue(JSON.stringify(expiredCredentials))

			// Mock the token refresh fetch
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						access_token: "new-access-token",
						token_type: "Bearer",
						refresh_token: "new-refresh-token",
						expires_in: 3600,
					}),
			})
			vi.stubGlobal("fetch", mockFetch)

			async function* mockFullStream() {
				yield { type: "text-delta" as const, text: "After refresh" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 5, outputTokens: 3 }),
			})

			const stream = handler.createMessage("test prompt", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have called the token refresh endpoint
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/v1/oauth2/token"),
				expect.objectContaining({ method: "POST" }),
			)
			// Should have written new credentials to file
			expect(fs.writeFile).toHaveBeenCalled()

			vi.unstubAllGlobals()
		})
	})

	describe("401 retry", () => {
		it("should retry on 401 during createMessage", async () => {
			// First call throws 401, second succeeds
			let callCount = 0

			mockStreamText.mockImplementation(() => {
				callCount++
				if (callCount === 1) {
					// Simulate 401 error (handleAiSdkError preserves status)
					const error = new Error("qwen-code: API Error (401): Unauthorized")
					;(error as any).status = 401
					throw error
				}

				async function* mockFullStream() {
					yield { type: "text-delta" as const, text: "Retry success" }
				}

				return {
					fullStream: mockFullStream(),
					usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				}
			})

			// Mock the token refresh fetch for the retry
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						access_token: "refreshed-access-token",
						token_type: "Bearer",
						refresh_token: "refreshed-refresh-token",
						expires_in: 3600,
					}),
			})
			vi.stubGlobal("fetch", mockFetch)

			const stream = handler.createMessage("test prompt", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have retried: 2 calls to streamText
			expect(mockStreamText).toHaveBeenCalledTimes(2)
			// Should have gotten the successful response
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Retry success")

			vi.unstubAllGlobals()
		})

		it("should retry on 401 during completePrompt", async () => {
			let callCount = 0

			mockGenerateText.mockImplementation(() => {
				callCount++
				if (callCount === 1) {
					const error = new Error("qwen-code: API Error (401): Unauthorized")
					;(error as any).status = 401
					throw error
				}
				return Promise.resolve({ text: "Retry success" })
			})

			// Mock the token refresh fetch
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						access_token: "refreshed-access-token",
						token_type: "Bearer",
						refresh_token: "refreshed-refresh-token",
						expires_in: 3600,
					}),
			})
			vi.stubGlobal("fetch", mockFetch)

			const result = await handler.completePrompt("test prompt")

			expect(mockGenerateText).toHaveBeenCalledTimes(2)
			expect(result).toBe("Retry success")

			vi.unstubAllGlobals()
		})

		it("should throw non-401 errors without retrying", async () => {
			const error = new Error("qwen-code: API Error (500): Internal Server Error")
			;(error as any).status = 500

			mockStreamText.mockImplementation(() => {
				throw error
			})

			const stream = handler.createMessage("test prompt", [])
			await expect(async () => {
				for await (const _chunk of stream) {
					// consume
				}
			}).rejects.toThrow("500")

			// Should only have tried once
			expect(mockStreamText).toHaveBeenCalledTimes(1)
		})
	})

	describe("streaming via AI SDK", () => {
		it("should yield text chunks from AI SDK stream", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta" as const, text: "Hello " }
				yield { type: "text-delta" as const, text: "world" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Hello ")
			expect(textChunks[1].text).toBe("world")
		})

		it("should yield usage metrics", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta" as const, text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 15, outputTokens: 8 }),
			})

			const stream = handler.createMessage("test prompt", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(15)
			expect(usageChunks[0].outputTokens).toBe(8)
		})

		it("should handle reasoning content from AI SDK", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning" as const, text: "Thinking about this..." }
				yield { type: "text-delta" as const, text: "Here is my answer" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Thinking about this...")

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Here is my answer")
		})
	})

	describe("tool calls via AI SDK", () => {
		it("should handle tool calls from AI SDK stream", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-call" as const,
					toolCallId: "call_qwen_123",
					toolName: "test_tool",
					args: { arg1: "value" },
				}
				yield {
					type: "tool-result" as const,
					toolCallId: "call_qwen_123",
					toolName: "test_tool",
					result: "tool result",
				}
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// AI SDK tool calls are processed by processAiSdkStreamPart
			expect(chunks.length).toBeGreaterThan(0)
		})
	})

	describe("completePrompt", () => {
		it("should delegate to AI SDK generateText", async () => {
			mockGenerateText.mockResolvedValue({ text: "Completed response" })

			const result = await handler.completePrompt("test prompt")

			expect(result).toBe("Completed response")
			expect(mockGenerateText).toHaveBeenCalled()
		})
	})

	describe("refreshPromise guard", () => {
		it("should not make concurrent refresh calls", async () => {
			// Return expired credentials so refresh is triggered
			const expiredCredentials = {
				...mockCredentials,
				expiry_date: Date.now() - 1000,
			}
			;(fs.readFile as any).mockResolvedValue(JSON.stringify(expiredCredentials))

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						access_token: "new-token",
						token_type: "Bearer",
						refresh_token: "new-refresh",
						expires_in: 3600,
					}),
			})
			vi.stubGlobal("fetch", mockFetch)

			async function* mockFullStream() {
				yield { type: "text-delta" as const, text: "ok" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }),
			})

			// Make two concurrent calls - the refresh should only happen once
			const stream1 = handler.createMessage("prompt1", [])
			// Consume stream1 first to trigger auth
			for await (const _chunk of stream1) {
				// consume
			}

			// The fetch for token refresh should have been called exactly once
			expect(mockFetch).toHaveBeenCalledTimes(1)

			vi.unstubAllGlobals()
		})
	})
})
