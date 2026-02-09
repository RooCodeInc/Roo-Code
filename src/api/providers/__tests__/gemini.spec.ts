// npx vitest run src/api/providers/__tests__/gemini.spec.ts

import { NoOutputGeneratedError } from "ai"

const mockCaptureException = vitest.fn()

vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: (...args: unknown[]) => mockCaptureException(...args),
		},
	},
}))

// Mock the AI SDK functions
const mockStreamText = vitest.fn()
const mockGenerateText = vitest.fn()

vitest.mock("ai", async (importOriginal) => {
	const original = await importOriginal<typeof import("ai")>()
	return {
		...original,
		streamText: (...args: unknown[]) => mockStreamText(...args),
		generateText: (...args: unknown[]) => mockGenerateText(...args),
	}
})

// Mock createGoogleGenerativeAI to capture constructor options
const mockCreateGoogleGenerativeAI = vitest.fn().mockReturnValue(() => ({}))

vitest.mock("@ai-sdk/google", async (importOriginal) => {
	const original = await importOriginal<typeof import("@ai-sdk/google")>()
	return {
		...original,
		createGoogleGenerativeAI: (...args: unknown[]) => mockCreateGoogleGenerativeAI(...args),
	}
})

import { Anthropic } from "@anthropic-ai/sdk"

import { type ModelInfo, geminiDefaultModelId, ApiProviderError } from "@roo-code/types"

import { t } from "i18next"
import { GeminiHandler } from "../gemini"

const GEMINI_MODEL_NAME = geminiDefaultModelId

describe("GeminiHandler", () => {
	let handler: GeminiHandler

	beforeEach(() => {
		// Reset mocks
		mockCaptureException.mockClear()
		mockStreamText.mockClear()
		mockGenerateText.mockClear()
		mockCreateGoogleGenerativeAI.mockClear()
		mockCreateGoogleGenerativeAI.mockReturnValue(() => ({}))

		handler = new GeminiHandler({
			apiKey: "test-key",
			apiModelId: GEMINI_MODEL_NAME,
			geminiApiKey: "test-key",
		})
	})

	describe("constructor", () => {
		it("should initialize with provided config", () => {
			expect(handler["options"].geminiApiKey).toBe("test-key")
			expect(handler["options"].apiModelId).toBe(GEMINI_MODEL_NAME)
		})

		it("should pass undefined baseURL when googleGeminiBaseUrl is empty string", () => {
			mockCreateGoogleGenerativeAI.mockClear()
			new GeminiHandler({
				apiModelId: GEMINI_MODEL_NAME,
				geminiApiKey: "test-key",
				googleGeminiBaseUrl: "",
			})
			expect(mockCreateGoogleGenerativeAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: undefined }))
		})

		it("should pass undefined baseURL when googleGeminiBaseUrl is not provided", () => {
			mockCreateGoogleGenerativeAI.mockClear()
			new GeminiHandler({
				apiModelId: GEMINI_MODEL_NAME,
				geminiApiKey: "test-key",
			})
			expect(mockCreateGoogleGenerativeAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: undefined }))
		})

		it("should pass custom baseURL when googleGeminiBaseUrl is a valid URL", () => {
			mockCreateGoogleGenerativeAI.mockClear()
			new GeminiHandler({
				apiModelId: GEMINI_MODEL_NAME,
				geminiApiKey: "test-key",
				googleGeminiBaseUrl: "https://custom-gemini.example.com/v1beta",
			})
			expect(mockCreateGoogleGenerativeAI).toHaveBeenCalledWith(
				expect.objectContaining({ baseURL: "https://custom-gemini.example.com/v1beta" }),
			)
		})
	})

	describe("createMessage", () => {
		const mockMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
			{
				role: "assistant",
				content: "Hi there!",
			},
		]

		const systemPrompt = "You are a helpful assistant"

		it("should handle text messages correctly", async () => {
			// Setup the mock implementation to return an async generator for fullStream
			// AI SDK text-delta events have a 'text' property (processAiSdkStreamPart casts to this)
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "Hello" }
				yield { type: "text-delta", text: " world!" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have 3 chunks: 'Hello', ' world!', and usage info
			expect(chunks.length).toBe(3)
			expect(chunks[0]).toEqual({ type: "text", text: "Hello" })
			expect(chunks[1]).toEqual({ type: "text", text: " world!" })
			expect(chunks[2]).toMatchObject({ type: "usage", inputTokens: 10, outputTokens: 5 })

			// Verify the call to streamText
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: systemPrompt,
					temperature: 1,
				}),
			)
		})

		it("should yield informative message when stream produces no text content", async () => {
			// Stream with only reasoning (no text-delta) simulates thinking-only response
			const mockFullStream = (async function* () {
				yield { type: "reasoning-delta", id: "1", text: "thinking..." }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have: reasoning chunk, empty-stream informative message, usage
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0]).toEqual({
				type: "text",
				text: "Model returned an empty response. This may be caused by an unsupported thinking configuration or content filtering.",
			})
		})

		it("should suppress NoOutputGeneratedError when no text content was yielded", async () => {
			// Empty stream - nothing yielded at all
			const mockFullStream = (async function* () {
				// empty stream
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.reject(new NoOutputGeneratedError({ message: "No output generated." })),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			// Should NOT throw - the error is suppressed
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have the informative empty-stream message only (no usage since it errored)
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0]).toMatchObject({
				type: "text",
				text: expect.stringContaining("empty response"),
			})
		})

		it("should re-throw NoOutputGeneratedError when text content was yielded", async () => {
			// Stream yields text content but usage still throws NoOutputGeneratedError (unexpected)
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "Hello" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.reject(new NoOutputGeneratedError({ message: "No output generated." })),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// consume stream
				}
			}).rejects.toThrow()
		})

		it("should handle API errors", async () => {
			const mockError = new Error("Gemini API error")
			// eslint-disable-next-line require-yield
			const mockFullStream = (async function* () {
				throw mockError
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should throw before yielding any chunks
				}
			}).rejects.toThrow()
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test response",
				providerMetadata: {},
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")

			// Verify the call to generateText
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
					temperature: 1,
				}),
			)
		})

		it("should handle API errors", async () => {
			const mockError = new Error("Gemini API error")
			mockGenerateText.mockRejectedValue(mockError)

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				t("common:errors.gemini.generate_complete_prompt", { error: "Gemini API error" }),
			)
		})

		it("should handle empty response", async () => {
			mockGenerateText.mockResolvedValue({
				text: "",
				providerMetadata: {},
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})

	describe("getModel", () => {
		it("should return correct model info", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe(GEMINI_MODEL_NAME)
			expect(modelInfo.info).toBeDefined()
		})

		it("should return default model if invalid model specified", () => {
			const invalidHandler = new GeminiHandler({
				apiModelId: "invalid-model",
				geminiApiKey: "test-key",
			})
			const modelInfo = invalidHandler.getModel()
			expect(modelInfo.id).toBe(geminiDefaultModelId) // Default model
		})
	})

	describe("calculateCost", () => {
		// Mock ModelInfo based on gemini-1.5-flash-latest pricing (per 1M tokens)
		// Removed 'id' and 'name' as they are not part of ModelInfo type directly
		const mockInfo: ModelInfo = {
			inputPrice: 0.125, // $/1M tokens
			outputPrice: 0.375, // $/1M tokens
			cacheWritesPrice: 0.125, // Assume same as input for test
			cacheReadsPrice: 0.125 * 0.25, // Assume 0.25x input for test
			contextWindow: 1_000_000,
			maxTokens: 8192,
			supportsPromptCache: true, // Enable cache calculations for tests
		}

		it("should calculate cost correctly based on input and output tokens", () => {
			const inputTokens = 10000 // Use larger numbers for per-million pricing
			const outputTokens = 20000
			// Added non-null assertions (!) as mockInfo guarantees these values
			const expectedCost =
				(inputTokens / 1_000_000) * mockInfo.inputPrice! + (outputTokens / 1_000_000) * mockInfo.outputPrice!

			const cost = handler.calculateCost({ info: mockInfo, inputTokens, outputTokens })
			expect(cost).toBeCloseTo(expectedCost)
		})

		it("should return 0 if token counts are zero", () => {
			// Note: The method expects numbers, not undefined. Passing undefined would be a type error.
			// The calculateCost method itself returns undefined if prices are missing, but 0 if tokens are 0 and prices exist.
			expect(handler.calculateCost({ info: mockInfo, inputTokens: 0, outputTokens: 0 })).toBe(0)
		})

		it("should handle only input tokens", () => {
			const inputTokens = 5000
			// Added non-null assertion (!)
			const expectedCost = (inputTokens / 1_000_000) * mockInfo.inputPrice!
			expect(handler.calculateCost({ info: mockInfo, inputTokens, outputTokens: 0 })).toBeCloseTo(expectedCost)
		})

		it("should handle only output tokens", () => {
			const outputTokens = 15000
			// Added non-null assertion (!)
			const expectedCost = (outputTokens / 1_000_000) * mockInfo.outputPrice!
			expect(handler.calculateCost({ info: mockInfo, inputTokens: 0, outputTokens })).toBeCloseTo(expectedCost)
		})

		it("should calculate cost with cache read tokens", () => {
			const inputTokens = 10000 // Total logical input
			const outputTokens = 20000
			const cacheReadTokens = 8000 // Part of inputTokens read from cache

			const uncachedReadTokens = inputTokens - cacheReadTokens
			// Added non-null assertions (!)
			const expectedInputCost = (uncachedReadTokens / 1_000_000) * mockInfo.inputPrice!
			const expectedOutputCost = (outputTokens / 1_000_000) * mockInfo.outputPrice!
			const expectedCacheReadCost = mockInfo.cacheReadsPrice! * (cacheReadTokens / 1_000_000)
			const expectedCost = expectedInputCost + expectedOutputCost + expectedCacheReadCost

			const cost = handler.calculateCost({ info: mockInfo, inputTokens, outputTokens, cacheReadTokens })
			expect(cost).toBeCloseTo(expectedCost)
		})

		it("should return undefined if pricing info is missing", () => {
			// Create a copy and explicitly set a price to undefined
			const incompleteInfo: ModelInfo = { ...mockInfo, outputPrice: undefined }
			const cost = handler.calculateCost({ info: incompleteInfo, inputTokens: 1000, outputTokens: 1000 })
			expect(cost).toBeUndefined()
		})
	})

	describe("error telemetry", () => {
		const mockMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
		]

		const systemPrompt = "You are a helpful assistant"

		it("should capture telemetry on createMessage error", async () => {
			const mockError = new Error("Gemini API error")
			// eslint-disable-next-line require-yield
			const mockFullStream = (async function* () {
				throw mockError
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should throw before yielding any chunks
				}
			}).rejects.toThrow()

			// Verify telemetry was captured
			expect(mockCaptureException).toHaveBeenCalledTimes(1)
			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Gemini API error",
					provider: "Gemini",
					modelId: GEMINI_MODEL_NAME,
					operation: "createMessage",
				}),
			)

			// Verify it's an ApiProviderError
			const capturedError = mockCaptureException.mock.calls[0][0]
			expect(capturedError).toBeInstanceOf(ApiProviderError)
		})

		it("should capture telemetry on completePrompt error", async () => {
			const mockError = new Error("Gemini completion error")
			mockGenerateText.mockRejectedValue(mockError)

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow()

			// Verify telemetry was captured
			expect(mockCaptureException).toHaveBeenCalledTimes(1)
			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Gemini completion error",
					provider: "Gemini",
					modelId: GEMINI_MODEL_NAME,
					operation: "completePrompt",
				}),
			)

			// Verify it's an ApiProviderError
			const capturedError = mockCaptureException.mock.calls[0][0]
			expect(capturedError).toBeInstanceOf(ApiProviderError)
		})

		it("should still throw the error after capturing telemetry", async () => {
			const mockError = new Error("Gemini API error")
			// eslint-disable-next-line require-yield
			const mockFullStream = (async function* () {
				throw mockError
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)

			// Verify the error is still thrown
			await expect(async () => {
				for await (const _chunk of stream) {
					// Should throw
				}
			}).rejects.toThrow()

			// Telemetry should have been captured before the error was thrown
			expect(mockCaptureException).toHaveBeenCalled()
		})
	})
})
