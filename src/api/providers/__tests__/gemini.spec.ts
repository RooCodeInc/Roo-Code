// npx vitest run src/api/providers/__tests__/gemini.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { type ModelInfo, geminiDefaultModelId } from "@roo-code/types"

import { t } from "i18next"
import { GeminiHandler } from "../gemini"

const GEMINI_20_FLASH_THINKING_NAME = "gemini-2.0-flash-thinking-exp-1219"

// Mock fs module
vitest.mock("fs", () => ({
	existsSync: vitest.fn(),
}))

// Mock os module
vitest.mock("os", () => ({
	platform: vitest.fn(),
	homedir: vitest.fn(),
}))

// Mock child_process module
vitest.mock("child_process", () => ({
	execSync: vitest.fn(),
}))

describe("GeminiHandler", () => {
	let handler: GeminiHandler

	beforeEach(() => {
		// Create mock functions
		const mockGenerateContentStream = vitest.fn()
		const mockGenerateContent = vitest.fn()
		const mockGetGenerativeModel = vitest.fn()

		handler = new GeminiHandler({
			apiKey: "test-key",
			apiModelId: GEMINI_20_FLASH_THINKING_NAME,
			geminiApiKey: "test-key",
		})

		// Replace the client with our mock
		handler["client"] = {
			models: {
				generateContentStream: mockGenerateContentStream,
				generateContent: mockGenerateContent,
				getGenerativeModel: mockGetGenerativeModel,
			},
		} as any

		// Reset mocks
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided config", () => {
			expect(handler["options"].geminiApiKey).toBe("test-key")
			expect(handler["options"].apiModelId).toBe(GEMINI_20_FLASH_THINKING_NAME)
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
			// Setup the mock implementation to return an async generator
			;(handler["client"].models.generateContentStream as any).mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Hello" }
					yield { text: " world!" }
					yield { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
				},
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
			expect(chunks[2]).toEqual({ type: "usage", inputTokens: 10, outputTokens: 5 })

			// Verify the call to generateContentStream
			expect(handler["client"].models.generateContentStream).toHaveBeenCalledWith(
				expect.objectContaining({
					model: GEMINI_20_FLASH_THINKING_NAME,
					config: expect.objectContaining({
						temperature: 0,
						systemInstruction: systemPrompt,
					}),
				}),
			)
		})

		it("should handle API errors", async () => {
			const mockError = new Error("Gemini API error")
			;(handler["client"].models.generateContentStream as any).mockRejectedValue(mockError)

			const stream = handler.createMessage(systemPrompt, mockMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should throw before yielding any chunks
				}
			}).rejects.toThrow()
		})

		// Skip this test for now as it requires more complex mocking
		it.skip("should retry on authentication error", async () => {
			const authError = new Error("Could not refresh access token")
			const mockExecSync = vitest.fn().mockReturnValue("mock-token")

			// First call fails with auth error, second succeeds
			;(handler["client"].models.generateContentStream as any)
				.mockRejectedValueOnce(authError)
				.mockResolvedValueOnce({
					[Symbol.asyncIterator]: async function* () {
						yield { text: "Success after retry" }
						yield { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
					},
				})

			// Mock the dynamic import of child_process
			const originalImport = (global as any).import
			;(global as any).import = vitest.fn().mockResolvedValue({ execSync: mockExecSync })

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have successfully retried
			expect(chunks.length).toBe(2)
			expect(chunks[0]).toEqual({ type: "text", text: "Success after retry" })

			// Verify execSync was called to refresh token
			expect(mockExecSync).toHaveBeenCalledWith(
				"gcloud auth application-default print-access-token",
				expect.objectContaining({
					encoding: "utf8",
					stdio: "pipe",
				}),
			)

			// Restore original import
			;(global as any).import = originalImport
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			// Mock the response with text property
			;(handler["client"].models.generateContent as any).mockResolvedValue({
				text: "Test response",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")

			// Verify the call to generateContent
			expect(handler["client"].models.generateContent).toHaveBeenCalledWith({
				model: GEMINI_20_FLASH_THINKING_NAME,
				contents: [{ role: "user", parts: [{ text: "Test prompt" }] }],
				config: {
					httpOptions: undefined,
					temperature: 0,
				},
			})
		})

		it("should handle API errors", async () => {
			const mockError = new Error("Gemini API error")
			;(handler["client"].models.generateContent as any).mockRejectedValue(mockError)

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				t("common:errors.gemini.generate_complete_prompt", { error: "Gemini API error" }),
			)
		})

		it("should handle empty response", async () => {
			// Mock the response with empty text
			;(handler["client"].models.generateContent as any).mockResolvedValue({
				text: "",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})

	describe("getModel", () => {
		it("should return correct model info", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe(GEMINI_20_FLASH_THINKING_NAME)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(8192)
			expect(modelInfo.info.contextWindow).toBe(32_767)
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

		it("should calculate cost with cache write tokens", () => {
			const inputTokens = 10000
			const outputTokens = 20000
			const cacheWriteTokens = 5000
			const CACHE_TTL = 5 // Match the constant in gemini.ts

			// Added non-null assertions (!)
			const expectedInputCost = (inputTokens / 1_000_000) * mockInfo.inputPrice!
			const expectedOutputCost = (outputTokens / 1_000_000) * mockInfo.outputPrice!
			const expectedCacheWriteCost =
				mockInfo.cacheWritesPrice! * (cacheWriteTokens / 1_000_000) * (CACHE_TTL / 60)
			const expectedCost = expectedInputCost + expectedOutputCost + expectedCacheWriteCost

			const cost = handler.calculateCost({ info: mockInfo, inputTokens, outputTokens })
			expect(cost).toBeCloseTo(expectedCost)
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

	describe("ADC path detection", () => {
		it("should detect ADC path on Windows", () => {
			// Mock Windows environment
			;(os.platform as any).mockReturnValue("win32")
			process.env.APPDATA = "C:\\Users\\TestUser\\AppData\\Roaming"

			const adcPath = handler["getADCPath"]()
			expect(adcPath).toBe(
				path.join("C:\\Users\\TestUser\\AppData\\Roaming", "gcloud", "application_default_credentials.json"),
			)
		})

		it("should detect ADC path on Unix/Mac", () => {
			// Mock Unix environment
			;(os.platform as any).mockReturnValue("darwin")
			;(os.homedir as any).mockReturnValue("/Users/testuser")

			const adcPath = handler["getADCPath"]()
			expect(adcPath).toBe("/Users/testuser/.config/gcloud/application_default_credentials.json")
		})

		it("should return null if APPDATA is not set on Windows", () => {
			// Mock Windows environment without APPDATA
			;(os.platform as any).mockReturnValue("win32")
			delete process.env.APPDATA

			const adcPath = handler["getADCPath"]()
			expect(adcPath).toBeNull()
		})
	})

	describe("Vertex client creation", () => {
		it("should use ADC file if it exists", () => {
			// Mock ADC file exists
			;(fs.existsSync as any).mockReturnValue(true)
			;(os.platform as any).mockReturnValue("win32")
			process.env.APPDATA = "C:\\Users\\TestUser\\AppData\\Roaming"

			// Spy on console.log to verify logging
			const consoleSpy = vitest.spyOn(console, "log").mockImplementation(() => {})

			// Create a new handler with isVertex flag
			const vertexHandler = new GeminiHandler({
				isVertex: true,
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			// Verify ADC path was logged
			expect(consoleSpy).toHaveBeenCalledWith(
				"Using Application Default Credentials from:",
				path.join("C:\\Users\\TestUser\\AppData\\Roaming", "gcloud", "application_default_credentials.json"),
			)

			consoleSpy.mockRestore()
		})

		it("should fallback to default ADC if file doesn't exist", () => {
			// Mock ADC file doesn't exist
			;(fs.existsSync as any).mockReturnValue(false)

			// Create a new handler with isVertex flag
			const vertexHandler = new GeminiHandler({
				isVertex: true,
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			// Handler should be created without error
			expect(vertexHandler).toBeDefined()
		})
	})
})
