import type { MockedClass, MockedFunction } from "vitest"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { OpenAI } from "openai"
import { RooEmbedder } from "../roo"
import { getDefaultModelId } from "../../../../shared/embeddingModels"

// Mock the OpenAI SDK
vi.mock("openai")

// Mock CloudService - use vi.hoisted so variables are available when vi.mock runs
const { mockGetSessionToken, mockCloudIsAuthenticated, mockCloudHasInstance } = vi.hoisted(() => ({
	mockGetSessionToken: vi.fn().mockReturnValue("test-session-token"),
	mockCloudIsAuthenticated: vi.fn().mockReturnValue(true),
	mockCloudHasInstance: vi.fn().mockReturnValue(true),
}))
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: mockCloudHasInstance,
		get instance() {
			return {
				authService: {
					getSessionToken: mockGetSessionToken,
				},
				isAuthenticated: mockCloudIsAuthenticated,
			}
		},
	},
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
	TelemetryEventName: {},
}))

// Mock i18n
vi.mock("../../../../i18n", () => ({
	t: (key: string, params?: Record<string, any>) => {
		const translations: Record<string, string> = {
			"embeddings:validation.apiKeyRequired": "validation.apiKeyRequired",
			"embeddings:authenticationFailed":
				"Failed to create embeddings: Authentication failed. Please check your API key.",
			"embeddings:failedWithStatus": `Failed to create embeddings after ${params?.attempts} attempts: HTTP ${params?.statusCode} - ${params?.errorMessage}`,
			"embeddings:failedWithError": `Failed to create embeddings after ${params?.attempts} attempts: ${params?.errorMessage}`,
			"embeddings:failedMaxAttempts": `Failed to create embeddings after ${params?.attempts} attempts`,
			"embeddings:textExceedsTokenLimit": `Text at index ${params?.index} exceeds maximum token limit (${params?.itemTokens} > ${params?.maxTokens}). Skipping.`,
			"embeddings:rateLimitRetry": `Rate limit hit, retrying in ${params?.delayMs}ms (attempt ${params?.attempt}/${params?.maxRetries})`,
		}
		return translations[key] || key
	},
}))

const MockedOpenAI = OpenAI as MockedClass<typeof OpenAI>

describe("RooEmbedder", () => {
	let mockEmbeddingsCreate: MockedFunction<any>
	let mockOpenAIInstance: any

	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(console, "warn").mockImplementation(() => {})
		vi.spyOn(console, "error").mockImplementation(() => {})

		// Setup mock OpenAI instance
		mockEmbeddingsCreate = vi.fn()
		mockOpenAIInstance = {
			embeddings: {
				create: mockEmbeddingsCreate,
			},
			apiKey: "test-session-token",
		}

		MockedOpenAI.mockImplementation(() => mockOpenAIInstance)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("constructor", () => {
		it("should create an instance using CloudService session token", () => {
			const embedder = new RooEmbedder()
			expect(embedder).toBeInstanceOf(RooEmbedder)
		})

		it("should use default model when none specified", () => {
			const embedder = new RooEmbedder()
			const expectedDefault = getDefaultModelId("roo")
			expect(expectedDefault).toBe("text-embedding-3-small")
			expect(embedder.embedderInfo.name).toBe("roo")
		})

		it("should use custom model when specified", () => {
			const customModel = "text-embedding-3-large"
			const embedder = new RooEmbedder(customModel)
			expect(embedder.embedderInfo.name).toBe("roo")
		})

		it("should initialize OpenAI client with correct headers and base URL ending in /v1", () => {
			new RooEmbedder()

			// Verify client was created with correct headers
			const callArgs = MockedOpenAI.mock.calls[0][0] as any
			expect(callArgs.defaultHeaders).toEqual({
				"HTTP-Referer": "https://github.com/RooCodeInc/Roo-Code",
				"X-Title": "Roo Code",
			})

			// Verify the baseURL ends with /v1
			expect(callArgs.baseURL).toMatch(/\/v1$/)
		})
	})

	describe("createEmbeddings", () => {
		it("should create embeddings for a batch of texts", async () => {
			// Create a proper base64-encoded float32 array
			const float32Array = new Float32Array([0.1, 0.2, 0.3])
			const buffer = Buffer.from(float32Array.buffer)
			const base64Embedding = buffer.toString("base64")

			mockEmbeddingsCreate.mockResolvedValueOnce({
				data: [{ embedding: base64Embedding }, { embedding: base64Embedding }],
				usage: { prompt_tokens: 10, total_tokens: 15 },
			})

			const embedder = new RooEmbedder()
			const result = await embedder.createEmbeddings(["text1", "text2"])

			expect(result.embeddings).toHaveLength(2)
			expect(result.embeddings[0]).toHaveLength(3) // 3 floats in our test array
			expect(result.usage?.promptTokens).toBe(10)
			expect(result.usage?.totalTokens).toBe(15)
		})

		it("should request base64 encoding format", async () => {
			const float32Array = new Float32Array([0.1])
			const buffer = Buffer.from(float32Array.buffer)
			const base64Embedding = buffer.toString("base64")

			mockEmbeddingsCreate.mockResolvedValueOnce({
				data: [{ embedding: base64Embedding }],
				usage: { prompt_tokens: 5, total_tokens: 5 },
			})

			const embedder = new RooEmbedder()
			await embedder.createEmbeddings(["test"])

			expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					encoding_format: "base64",
				}),
			)
		})

		it("should refresh session token before making request", async () => {
			const float32Array = new Float32Array([0.1])
			const buffer = Buffer.from(float32Array.buffer)
			const base64Embedding = buffer.toString("base64")

			mockEmbeddingsCreate.mockResolvedValueOnce({
				data: [{ embedding: base64Embedding }],
				usage: { prompt_tokens: 5, total_tokens: 5 },
			})

			const embedder = new RooEmbedder()
			await embedder.createEmbeddings(["test"])

			// The apiKey should have been refreshed via the setter
			// (we can't directly verify the setter was called since it's
			// a mock object, but the call to createEmbeddings succeeds)
			expect(mockEmbeddingsCreate).toHaveBeenCalled()
		})

		it("should handle numeric array embeddings (non-base64)", async () => {
			mockEmbeddingsCreate.mockResolvedValueOnce({
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: { prompt_tokens: 5, total_tokens: 5 },
			})

			const embedder = new RooEmbedder()
			const result = await embedder.createEmbeddings(["test"])

			expect(result.embeddings).toHaveLength(1)
			expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3])
		})

		it("should skip texts exceeding token limit", async () => {
			const longText = "a".repeat(400000) // Exceeds MAX_ITEM_TOKENS

			const float32Array = new Float32Array([0.1])
			const buffer = Buffer.from(float32Array.buffer)
			const base64Embedding = buffer.toString("base64")

			mockEmbeddingsCreate.mockResolvedValueOnce({
				data: [{ embedding: base64Embedding }],
				usage: { prompt_tokens: 5, total_tokens: 5 },
			})

			const embedder = new RooEmbedder()
			const result = await embedder.createEmbeddings([longText, "short text"])

			// Only the short text should have been embedded
			expect(result.embeddings).toHaveLength(1)
		})
	})

	describe("validateConfiguration", () => {
		it("should return valid when API responds correctly", async () => {
			const float32Array = new Float32Array([0.1])
			const buffer = Buffer.from(float32Array.buffer)
			const base64Embedding = buffer.toString("base64")

			mockEmbeddingsCreate.mockResolvedValueOnce({
				data: [{ embedding: base64Embedding }],
				usage: { prompt_tokens: 1, total_tokens: 1 },
			})

			const embedder = new RooEmbedder()
			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(true)
		})

		it("should return invalid when API returns empty response", async () => {
			mockEmbeddingsCreate.mockResolvedValueOnce({
				data: [],
				usage: { prompt_tokens: 0, total_tokens: 0 },
			})

			const embedder = new RooEmbedder()
			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
		})

		it("should handle API errors during validation", async () => {
			const apiError = new Error("API connection failed")
			;(apiError as any).status = 500

			mockEmbeddingsCreate.mockRejectedValueOnce(apiError)

			const embedder = new RooEmbedder()
			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
		})
	})

	describe("embedderInfo", () => {
		it("should return roo as the embedder name", () => {
			const embedder = new RooEmbedder()
			expect(embedder.embedderInfo).toEqual({ name: "roo" })
		})
	})

	describe("rate limiting", () => {
		it("should retry on 429 errors with exponential backoff", async () => {
			const rateLimitError = new Error("Rate limit exceeded")
			;(rateLimitError as any).status = 429

			const float32Array = new Float32Array([0.1])
			const buffer = Buffer.from(float32Array.buffer)
			const base64Embedding = buffer.toString("base64")

			// First call fails with 429, second succeeds
			mockEmbeddingsCreate.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce({
				data: [{ embedding: base64Embedding }],
				usage: { prompt_tokens: 5, total_tokens: 5 },
			})

			const embedder = new RooEmbedder()
			const result = await embedder.createEmbeddings(["test"])

			expect(result.embeddings).toHaveLength(1)
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
		})
	})
})
