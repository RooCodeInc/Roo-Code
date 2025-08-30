import { describe, it, expect, vi, beforeEach } from "vitest"
import { GeminiCliHandler } from "../gemini-cli"
import { Anthropic } from "@anthropic-ai/sdk"

// Mock the @google/gemini-cli-core module
vi.mock("@google/gemini-cli-core", () => ({
	GeminiClient: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		startChat: vi.fn().mockResolvedValue(undefined),
		addHistory: vi.fn().mockResolvedValue(undefined),
		sendMessageStream: vi.fn().mockImplementation(async function* () {
			yield { type: "content", value: "Test response" }
			return {
				getDebugResponses: vi.fn().mockReturnValue([
					{
						usageMetadata: {
							promptTokenCount: 100,
							candidatesTokenCount: 50,
						},
					},
				]),
			}
		}),
		generateContent: vi.fn().mockResolvedValue({
			candidates: [
				{
					content: {
						parts: [{ text: "Test completion response" }],
					},
				},
			],
		}),
		getDebugResponses: vi.fn().mockReturnValue([
			{
				usageMetadata: {
					promptTokenCount: 100,
					candidatesTokenCount: 50,
				},
			},
		]),
	})),
	Config: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		getGeminiClient: vi.fn().mockReturnValue({
			initialize: vi.fn().mockResolvedValue(undefined),
			startChat: vi.fn().mockResolvedValue(undefined),
			addHistory: vi.fn().mockResolvedValue(undefined),
			sendMessageStream: vi.fn().mockImplementation(async function* () {
				yield { type: "content", value: "Test response" }
				return {
					getDebugResponses: vi.fn().mockReturnValue([
						{
							usageMetadata: {
								promptTokenCount: 100,
								candidatesTokenCount: 50,
							},
						},
					]),
				}
			}),
			generateContent: vi.fn().mockResolvedValue({
				candidates: [
					{
						content: {
							parts: [{ text: "Test completion response" }],
						},
					},
				],
			}),
		}),
	})),
	AuthType: {
		LOGIN_WITH_GOOGLE: "oauth-personal",
	},
	createContentGeneratorConfig: vi.fn().mockReturnValue({
		model: "gemini-2.0-flash-001",
		authType: "oauth-personal",
	}),
}))

describe("GeminiCliHandler", () => {
	let handler: GeminiCliHandler

	beforeEach(() => {
		vi.clearAllMocks()
		handler = new GeminiCliHandler({})
	})

	describe("constructor", () => {
		it("should create an instance", () => {
			expect(handler).toBeInstanceOf(GeminiCliHandler)
		})
	})

	describe("getModel", () => {
		it("should return default model when no apiModelId is provided", () => {
			const model = handler.getModel()
			expect(model.id).toBe("gemini-2.0-flash-001")
			expect(model.info).toBeDefined()
			expect(model.info.contextWindow).toBe(1_048_576)
		})

		it("should return specified model when apiModelId is provided", () => {
			const customHandler = new GeminiCliHandler({
				apiModelId: "gemini-1.5-flash-002",
			})
			const model = customHandler.getModel()
			expect(model.id).toBe("gemini-1.5-flash-002")
		})

		it("should fall back to default model for invalid apiModelId", () => {
			const customHandler = new GeminiCliHandler({
				apiModelId: "invalid-model",
			})
			const model = customHandler.getModel()
			expect(model.id).toBe("gemini-2.0-flash-001")
		})
	})

	describe("createMessage", () => {
		it("should stream messages from Gemini CLI", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello, how are you?",
				},
			]

			const stream = handler.createMessage(systemPrompt, messages)
			const results = []

			for await (const chunk of stream) {
				results.push(chunk)
			}

			// Should have at least text chunk
			expect(results.length).toBeGreaterThanOrEqual(1)
			expect(results[0]).toEqual({ type: "text", text: "Test response" })

			// Usage chunk may or may not be present depending on mock
			const usageChunk = results.find((r) => r.type === "usage")
			if (usageChunk) {
				expect(usageChunk).toMatchObject({
					type: "usage",
					inputTokens: expect.any(Number),
					outputTokens: expect.any(Number),
				})
			}
		})

		it("should handle reasoning/thought events", async () => {
			// Mock a thought event
			const mockClient = {
				initialize: vi.fn().mockResolvedValue(undefined),
				startChat: vi.fn().mockResolvedValue(undefined),
				addHistory: vi.fn().mockResolvedValue(undefined),
				sendMessageStream: vi.fn().mockImplementation(async function* () {
					yield { type: "thought", value: { subject: "Analysis", description: "Thinking about the problem" } }
					yield { type: "content", value: "Final answer" }
					return {
						getDebugResponses: vi.fn().mockReturnValue([]),
					}
				}),
			}

			const { Config } = await import("@google/gemini-cli-core")
			;(Config as any).mockImplementation(() => ({
				initialize: vi.fn().mockResolvedValue(undefined),
				getGeminiClient: vi.fn().mockReturnValue(mockClient),
			}))

			const customHandler = new GeminiCliHandler({})
			const stream = customHandler.createMessage("System", [{ role: "user", content: "Test" }])
			const results = []

			for await (const chunk of stream) {
				results.push(chunk)
			}

			expect(results[0]).toEqual({ type: "reasoning", text: "Analysis: Thinking about the problem" })
			expect(results[1]).toEqual({ type: "text", text: "Final answer" })
		})

		it("should handle authentication errors", async () => {
			const mockClient = {
				initialize: vi.fn().mockRejectedValue(new Error("OAuth authentication failed")),
			}

			const { Config } = await import("@google/gemini-cli-core")
			;(Config as any).mockImplementation(() => ({
				initialize: vi.fn().mockResolvedValue(undefined),
				getGeminiClient: vi.fn().mockReturnValue(mockClient),
			}))

			const customHandler = new GeminiCliHandler({})
			const stream = customHandler.createMessage("System", [{ role: "user", content: "Test" }])

			await expect(async () => {
				for await (const _ of stream) {
					// Should throw before yielding anything
				}
			}).rejects.toThrow(/auth/)
		})
	})

	describe("completePrompt", () => {
		it("should complete a prompt", async () => {
			// Need to mock the initialized client properly
			const mockClient = {
				initialize: vi.fn().mockResolvedValue(undefined),
				generateContent: vi.fn().mockResolvedValue({
					candidates: [
						{
							content: {
								parts: [{ text: "Test completion response" }],
							},
						},
					],
				}),
			}

			const { Config } = await import("@google/gemini-cli-core")
			;(Config as any).mockImplementation(() => ({
				initialize: vi.fn().mockResolvedValue(undefined),
				getGeminiClient: vi.fn().mockReturnValue(mockClient),
			}))

			const customHandler = new GeminiCliHandler({})
			const result = await customHandler.completePrompt("What is 2 + 2?")
			expect(result).toBe("Test completion response")
		})

		it("should handle empty response", async () => {
			const mockClient = {
				initialize: vi.fn().mockResolvedValue(undefined),
				generateContent: vi.fn().mockResolvedValue({
					candidates: [],
				}),
			}

			const { Config } = await import("@google/gemini-cli-core")
			;(Config as any).mockImplementation(() => ({
				initialize: vi.fn().mockResolvedValue(undefined),
				getGeminiClient: vi.fn().mockReturnValue(mockClient),
			}))

			const customHandler = new GeminiCliHandler({})
			const result = await customHandler.completePrompt("Test")
			expect(result).toBe("")
		})
	})

	describe("countTokens", () => {
		it("should fall back to base implementation", async () => {
			const content: Anthropic.Messages.ContentBlockParam[] = [
				{
					type: "text",
					text: "Test content for token counting",
				},
			]

			// The implementation falls back to the base class
			const count = await handler.countTokens(content)
			expect(count).toBeGreaterThan(0)
		})
	})
})
