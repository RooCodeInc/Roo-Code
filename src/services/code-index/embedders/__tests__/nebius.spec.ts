import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NebiusEmbedder } from "../nebius"
import { OpenAICompatibleEmbedder } from "../openai-compatible"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

// Mock the OpenAICompatibleEmbedder
vi.mock("../openai-compatible", () => ({
	OpenAICompatibleEmbedder: vi.fn().mockImplementation(() => ({
		createEmbeddings: vi.fn(),
		validateConfiguration: vi.fn(),
	})),
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock i18n
vi.mock("../../../../i18n", () => ({
	t: (key: string, params?: any) => {
		if (params) {
			return `${key} ${JSON.stringify(params)}`
		}
		return key
	},
}))

describe("NebiusEmbedder", () => {
	let embedder: NebiusEmbedder
	const mockApiKey = "test-nebius-api-key"
	const mockOpenAICompatibleEmbedder = {
		createEmbeddings: vi.fn(),
		validateConfiguration: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
		// Reset the mock implementation
		;(OpenAICompatibleEmbedder as any).mockImplementation(() => mockOpenAICompatibleEmbedder)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe("constructor", () => {
		it("should create an instance with default model", () => {
			embedder = new NebiusEmbedder(mockApiKey)
			expect(OpenAICompatibleEmbedder).toHaveBeenCalledWith(
				"https://api.studio.nebius.com/v1",
				mockApiKey,
				"Qwen/Qwen3-Embedding-8B",
				8191, // MAX_ITEM_TOKENS
			)
		})

		it("should create an instance with custom model", () => {
			const customModel = "custom-model-id"
			embedder = new NebiusEmbedder(mockApiKey, customModel)
			expect(OpenAICompatibleEmbedder).toHaveBeenCalledWith(
				"https://api.studio.nebius.com/v1",
				mockApiKey,
				customModel,
				8191,
			)
		})

		it("should throw error if API key is not provided", () => {
			expect(() => new NebiusEmbedder("")).toThrow("embeddings:validation.apiKeyRequired")
		})
	})

	describe("createEmbeddings", () => {
		beforeEach(() => {
			embedder = new NebiusEmbedder(mockApiKey)
		})

		it("should delegate to OpenAICompatibleEmbedder with rate limiting", async () => {
			const texts = ["test text 1", "test text 2"]
			const mockResponse = {
				embeddings: [
					[0.1, 0.2],
					[0.3, 0.4],
				],
				usage: { promptTokens: 10, totalTokens: 10 },
			}
			mockOpenAICompatibleEmbedder.createEmbeddings.mockResolvedValue(mockResponse)

			const result = await embedder.createEmbeddings(texts)

			expect(mockOpenAICompatibleEmbedder.createEmbeddings).toHaveBeenCalledWith(texts, "Qwen/Qwen3-Embedding-8B")
			expect(result).toEqual(mockResponse)
		})

		it("should use custom model if provided", async () => {
			const customModel = "custom-model"
			const texts = ["test text"]
			const mockResponse = {
				embeddings: [[0.1, 0.2]],
				usage: { promptTokens: 5, totalTokens: 5 },
			}
			mockOpenAICompatibleEmbedder.createEmbeddings.mockResolvedValue(mockResponse)

			const result = await embedder.createEmbeddings(texts, customModel)

			expect(mockOpenAICompatibleEmbedder.createEmbeddings).toHaveBeenCalledWith(texts, customModel)
			expect(result).toEqual(mockResponse)
		})

		it("should handle rate limiting when exceeding requests per minute", async () => {
			const texts = ["test"]
			const mockResponse = {
				embeddings: [[0.1, 0.2]],
				usage: { promptTokens: 5, totalTokens: 5 },
			}
			mockOpenAICompatibleEmbedder.createEmbeddings.mockResolvedValue(mockResponse)

			// Make 10,000 requests to hit the RPM limit
			const promises = []
			for (let i = 0; i < 10000; i++) {
				promises.push(embedder.createEmbeddings(texts))
			}
			await Promise.all(promises)

			// The next request should be rate limited
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// This request should trigger rate limiting
			const rateLimitedPromise = embedder.createEmbeddings(texts)

			// Should log rate limit warning
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("embeddings:nebius.rateLimitExceeded"))

			// Fast-forward time to allow rate limit to reset
			vi.advanceTimersByTime(60000)

			await rateLimitedPromise

			consoleWarnSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should handle rate limiting when exceeding tokens per minute", async () => {
			// Create very large texts that will exceed 600,000 TPM
			const largeText = "a".repeat(150000) // ~37,500 tokens per text
			const texts = Array(20).fill(largeText) // ~750,000 tokens total
			const mockResponse = {
				embeddings: Array(20).fill([0.1, 0.2]),
				usage: { promptTokens: 750000, totalTokens: 750000 },
			}
			mockOpenAICompatibleEmbedder.createEmbeddings.mockResolvedValue(mockResponse)

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// This should trigger token rate limiting
			const promise = embedder.createEmbeddings(texts)

			// Should log rate limit warning
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("embeddings:nebius.rateLimitExceeded"))

			// Fast-forward time to allow rate limit to reset
			vi.advanceTimersByTime(60000)

			await promise

			consoleWarnSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should capture telemetry on error", async () => {
			const texts = ["test text"]
			const error = new Error("Test error")
			mockOpenAICompatibleEmbedder.createEmbeddings.mockRejectedValue(error)

			await expect(embedder.createEmbeddings(texts)).rejects.toThrow(error)

			expect(TelemetryService.instance.captureEvent).toHaveBeenCalledWith(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error.message,
				stack: error.stack,
				location: "NebiusEmbedder:createEmbeddings",
			})
		})
	})

	describe("validateConfiguration", () => {
		beforeEach(() => {
			embedder = new NebiusEmbedder(mockApiKey)
		})

		it("should delegate validation to OpenAICompatibleEmbedder", async () => {
			const mockValidationResult = { valid: true }
			mockOpenAICompatibleEmbedder.validateConfiguration.mockResolvedValue(mockValidationResult)

			const result = await embedder.validateConfiguration()

			expect(mockOpenAICompatibleEmbedder.validateConfiguration).toHaveBeenCalled()
			expect(result).toEqual(mockValidationResult)
		})

		it("should handle validation errors", async () => {
			const error = new Error("Validation failed")
			mockOpenAICompatibleEmbedder.validateConfiguration.mockRejectedValue(error)

			await expect(embedder.validateConfiguration()).rejects.toThrow(error)

			expect(TelemetryService.instance.captureEvent).toHaveBeenCalledWith(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error.message,
				stack: error.stack,
				location: "NebiusEmbedder:validateConfiguration",
			})
		})
	})

	describe("embedderInfo", () => {
		it("should return correct embedder info", () => {
			embedder = new NebiusEmbedder(mockApiKey)
			expect(embedder.embedderInfo).toEqual({ name: "nebius" })
		})
	})

	describe("modelDimension", () => {
		it("should return the correct model dimension", () => {
			expect(NebiusEmbedder.modelDimension).toBe(4096)
		})
	})

	describe("rate limiting", () => {
		beforeEach(() => {
			embedder = new NebiusEmbedder(mockApiKey)
			mockOpenAICompatibleEmbedder.createEmbeddings.mockResolvedValue({
				embeddings: [[0.1, 0.2]],
				usage: { promptTokens: 10, totalTokens: 10 },
			})
		})

		it("should reset rate limits after window expires", async () => {
			const texts = ["test"]

			// Make requests up to the limit
			for (let i = 0; i < 9999; i++) {
				await embedder.createEmbeddings(texts)
			}

			// Advance time to reset the window
			vi.advanceTimersByTime(60001)

			// Should be able to make requests again
			const result = await embedder.createEmbeddings(texts)
			expect(result).toBeDefined()
			expect(mockOpenAICompatibleEmbedder.createEmbeddings).toHaveBeenCalled()
		})

		it("should log debug information about rate limit usage", async () => {
			const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})

			const texts = ["test text"]
			const mockResponse = {
				embeddings: [[0.1, 0.2]],
				usage: { promptTokens: 100, totalTokens: 100 },
			}
			mockOpenAICompatibleEmbedder.createEmbeddings.mockResolvedValue(mockResponse)

			await embedder.createEmbeddings(texts)

			expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining("Nebius AI embedding usage"))

			consoleDebugSpy.mockRestore()
		})
	})
})
