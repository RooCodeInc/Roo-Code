// npx vitest run src/services/code-index/embedders/__tests__/roo.spec.ts

import { RooEmbedder } from "../roo"
import { OpenAI } from "openai"
import { CloudService } from "@roo-code/cloud"

// Mock OpenAI
vi.mock("openai", () => ({
	OpenAI: vi.fn(),
}))

// Mock CloudService
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn(),
		instance: {
			authService: {
				getSessionToken: vi.fn(),
			},
		},
	},
}))

// Mock the TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock handleOpenAIError
vi.mock("../../../../api/providers/utils/openai-error-handler", () => ({
	handleOpenAIError: vi.fn((error) => error),
}))

const MockedOpenAI = vi.mocked(OpenAI)
const MockedCloudService = vi.mocked(CloudService)

describe("RooEmbedder", () => {
	let embedder: RooEmbedder
	let mockEmbeddingsCreate: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()

		// Set up CloudService mock to return a valid session token
		MockedCloudService.hasInstance.mockReturnValue(true)
		;(MockedCloudService.instance.authService!.getSessionToken as ReturnType<typeof vi.fn>).mockReturnValue(
			"test-session-token",
		)

		// Set up OpenAI mock
		mockEmbeddingsCreate = vi.fn()
		MockedOpenAI.mockImplementation(
			() =>
				({
					embeddings: {
						create: mockEmbeddingsCreate,
					},
					apiKey: "test-session-token",
				}) as any,
		)
	})

	describe("constructor", () => {
		it("should create RooEmbedder with default model", () => {
			// Act
			embedder = new RooEmbedder()

			// Assert
			expect(MockedOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.roocode.com/proxy/v1",
					apiKey: "test-session-token",
					defaultHeaders: {
						"HTTP-Referer": "https://github.com/RooCodeInc/Roo-Code",
						"X-Title": "Roo Code",
					},
				}),
			)
		})

		it("should create RooEmbedder with custom model", () => {
			// Arrange
			const customModel = "openai/text-embedding-3-small"

			// Act
			embedder = new RooEmbedder(customModel)

			// Assert
			expect(MockedOpenAI).toHaveBeenCalled()
			// The embedder should store the custom model
			expect(embedder.embedderInfo.name).toBe("roo")
		})

		it("should handle unauthenticated state", () => {
			// Arrange
			MockedCloudService.hasInstance.mockReturnValue(false)

			// Act
			embedder = new RooEmbedder()

			// Assert - Should use "unauthenticated" as apiKey
			expect(MockedOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "unauthenticated",
				}),
			)
		})
	})

	describe("createEmbeddings", () => {
		beforeEach(() => {
			embedder = new RooEmbedder()
		})

		it("should create embeddings for text input", async () => {
			// Arrange
			const texts = ["test text 1", "test text 2"]
			const base64Embedding1 = Buffer.from(new Float32Array([0.1, 0.2, 0.3]).buffer).toString("base64")
			const base64Embedding2 = Buffer.from(new Float32Array([0.4, 0.5, 0.6]).buffer).toString("base64")

			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: base64Embedding1 }, { embedding: base64Embedding2 }],
				usage: { prompt_tokens: 10, total_tokens: 10 },
			})

			// Act
			const result = await embedder.createEmbeddings(texts)

			// Assert
			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: texts,
				model: "openai/text-embedding-3-large",
				encoding_format: "base64",
			})
			expect(result.embeddings).toHaveLength(2)
			expect(result.usage?.promptTokens).toBe(10)
			expect(result.usage?.totalTokens).toBe(10)
		})

		it("should use custom model when provided", async () => {
			// Arrange
			const texts = ["test text"]
			const customModel = "google/gemini-embedding-001"
			const base64Embedding = Buffer.from(new Float32Array([0.1, 0.2]).buffer).toString("base64")

			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: base64Embedding }],
				usage: { prompt_tokens: 5, total_tokens: 5 },
			})

			// Act
			const result = await embedder.createEmbeddings(texts, customModel)

			// Assert
			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: texts,
				model: customModel,
				encoding_format: "base64",
			})
			expect(result.embeddings).toHaveLength(1)
		})

		it("should handle batch processing for large inputs", async () => {
			// Arrange
			// Create texts that would exceed batch limits
			const texts = Array(100).fill("test text")
			const base64Embedding = Buffer.from(new Float32Array([0.1, 0.2]).buffer).toString("base64")

			mockEmbeddingsCreate.mockResolvedValue({
				data: texts.map(() => ({ embedding: base64Embedding })),
				usage: { prompt_tokens: 500, total_tokens: 500 },
			})

			// Act
			const result = await embedder.createEmbeddings(texts)

			// Assert
			expect(result.embeddings).toHaveLength(100)
		})

		it("should skip texts exceeding token limit", async () => {
			// Arrange
			// Create a very long text that exceeds MAX_ITEM_TOKENS
			const longText = "a".repeat(100000) // Way more than 8191 tokens
			const normalText = "normal text"
			const texts = [longText, normalText]
			const base64Embedding = Buffer.from(new Float32Array([0.1, 0.2]).buffer).toString("base64")

			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: base64Embedding }],
				usage: { prompt_tokens: 5, total_tokens: 5 },
			})

			// Act
			const result = await embedder.createEmbeddings(texts)

			// Assert - Only the normal text should be processed
			expect(mockEmbeddingsCreate).toHaveBeenCalled()
			expect(result.embeddings).toHaveLength(1)
		})

		it("should handle API errors", async () => {
			// Arrange
			const texts = ["test text"]
			mockEmbeddingsCreate.mockRejectedValue(new Error("API error"))

			// Act & Assert
			await expect(embedder.createEmbeddings(texts)).rejects.toThrow()
		})
	})

	describe("validateConfiguration", () => {
		beforeEach(() => {
			embedder = new RooEmbedder()
		})

		it("should return valid when authenticated and API works", async () => {
			// Arrange
			const base64Embedding = Buffer.from(new Float32Array([0.1]).buffer).toString("base64")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: base64Embedding }],
				usage: { prompt_tokens: 1, total_tokens: 1 },
			})

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()
		})

		it("should return invalid when not authenticated", async () => {
			// Arrange - Reset and set up unauthenticated state
			MockedCloudService.hasInstance.mockReturnValue(false)
			embedder = new RooEmbedder()

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(false)
			expect(result.error).toBe("embeddings:validation.rooAuthenticationRequired")
		})

		it("should return invalid when API call fails", async () => {
			// Arrange
			mockEmbeddingsCreate.mockRejectedValue(new Error("API error"))

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(false)
		})

		it("should return invalid when response is empty", async () => {
			// Arrange
			mockEmbeddingsCreate.mockResolvedValue({
				data: [],
				usage: { prompt_tokens: 0, total_tokens: 0 },
			})

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(false)
			expect(result.error).toBe("embeddings:validation.invalidResponse")
		})
	})

	describe("embedderInfo", () => {
		it("should return correct embedder info", () => {
			// Arrange
			embedder = new RooEmbedder()

			// Act
			const info = embedder.embedderInfo

			// Assert
			expect(info).toEqual({
				name: "roo",
			})
		})
	})

	describe("rate limiting", () => {
		beforeEach(() => {
			embedder = new RooEmbedder()
		})

		it("should handle 429 rate limit errors with retry", async () => {
			// Arrange
			const texts = ["test text"]
			const rateLimitError = new Error("Rate limited") as any
			rateLimitError.status = 429

			const base64Embedding = Buffer.from(new Float32Array([0.1]).buffer).toString("base64")

			// First call fails with 429, second succeeds
			mockEmbeddingsCreate.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce({
				data: [{ embedding: base64Embedding }],
				usage: { prompt_tokens: 1, total_tokens: 1 },
			})

			// Act
			const result = await embedder.createEmbeddings(texts)

			// Assert
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
			expect(result.embeddings).toHaveLength(1)
		})
	})
})
