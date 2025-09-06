import { vitest, describe, it, expect, beforeEach } from "vitest"
import type { MockedClass } from "vitest"
import { GeminiEmbedder } from "../gemini"
import { OpenAICompatibleEmbedder } from "../openai-compatible"

// Mock the OpenAICompatibleEmbedder
vitest.mock("../openai-compatible")

// Mock TelemetryService
vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vitest.fn(),
		},
	},
}))

const MockedOpenAICompatibleEmbedder = OpenAICompatibleEmbedder as MockedClass<typeof OpenAICompatibleEmbedder>

describe("GeminiEmbedder", () => {
	let embedder: GeminiEmbedder

	beforeEach(() => {
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should create an instance with default model when no model specified", () => {
			// Arrange
			const apiKey = "test-gemini-api-key"

			// Act
			embedder = new GeminiEmbedder(apiKey)

			// Assert
			expect(MockedOpenAICompatibleEmbedder).toHaveBeenCalledWith(
				"https://generativelanguage.googleapis.com/v1beta/openai/",
				apiKey,
				"gemini-embedding-001",
				2048,
			)
		})

		it("should create an instance with specified model", () => {
			// Arrange
			const apiKey = "test-gemini-api-key"
			const modelId = "text-embedding-004"

			// Act
			embedder = new GeminiEmbedder(apiKey, modelId)

			// Assert
			expect(MockedOpenAICompatibleEmbedder).toHaveBeenCalledWith(
				"https://generativelanguage.googleapis.com/v1beta/openai/",
				apiKey,
				"text-embedding-004",
				2048,
			)
		})

		it("should throw error when API key is not provided", () => {
			// Act & Assert
			expect(() => new GeminiEmbedder("")).toThrow("validation.apiKeyRequired")
			expect(() => new GeminiEmbedder(null as any)).toThrow("validation.apiKeyRequired")
			expect(() => new GeminiEmbedder(undefined as any)).toThrow("validation.apiKeyRequired")
		})
	})

	describe("embedderInfo", () => {
		it("should return correct embedder info", () => {
			// Arrange
			embedder = new GeminiEmbedder("test-api-key")

			// Act
			const info = embedder.embedderInfo

			// Assert
			expect(info).toEqual({
				name: "gemini",
			})
		})

		describe("createEmbeddings", () => {
			let mockCreateEmbeddings: any

			beforeEach(() => {
				mockCreateEmbeddings = vitest.fn()
				MockedOpenAICompatibleEmbedder.prototype.createEmbeddings = mockCreateEmbeddings
			})

			it("should use instance model when no model parameter provided", async () => {
				// Arrange
				embedder = new GeminiEmbedder("test-api-key")
				const texts = ["test text 1", "test text 2"]
				const mockResponse = {
					embeddings: [
						[0.1, 0.2],
						[0.3, 0.4],
					],
				}
				mockCreateEmbeddings.mockResolvedValue(mockResponse)

				// Act
				const result = await embedder.createEmbeddings(texts)

				// Assert
				expect(mockCreateEmbeddings).toHaveBeenCalledWith(texts, "gemini-embedding-001")
				expect(result).toEqual(mockResponse)
			})

			it("should use provided model parameter when specified", async () => {
				// Arrange
				embedder = new GeminiEmbedder("test-api-key", "text-embedding-004")
				const texts = ["test text 1", "test text 2"]
				const mockResponse = {
					embeddings: [
						[0.1, 0.2],
						[0.3, 0.4],
					],
				}
				mockCreateEmbeddings.mockResolvedValue(mockResponse)

				// Act
				const result = await embedder.createEmbeddings(texts, "gemini-embedding-001")

				// Assert
				expect(mockCreateEmbeddings).toHaveBeenCalledWith(texts, "gemini-embedding-001")
				expect(result).toEqual(mockResponse)
			})

			it("should handle errors from OpenAICompatibleEmbedder", async () => {
				// Arrange
				embedder = new GeminiEmbedder("test-api-key")
				const texts = ["test text"]
				const error = new Error("Embedding failed")
				mockCreateEmbeddings.mockRejectedValue(error)

				// Act & Assert
				await expect(embedder.createEmbeddings(texts)).rejects.toThrow("Embedding failed")
			})
		})
	})

	describe("validateConfiguration", () => {
		let mockValidateConfiguration: any

		beforeEach(() => {
			mockValidateConfiguration = vitest.fn()
			MockedOpenAICompatibleEmbedder.prototype.validateConfiguration = mockValidateConfiguration
		})

		it("should delegate validation to OpenAICompatibleEmbedder", async () => {
			// Arrange
			embedder = new GeminiEmbedder("test-api-key")
			mockValidateConfiguration.mockResolvedValue({ valid: true })

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(mockValidateConfiguration).toHaveBeenCalled()
			expect(result).toEqual({ valid: true })
		})

		it("should enhance authentication error messages with Gemini-specific guidance", async () => {
			// Arrange
			embedder = new GeminiEmbedder("test-api-key")
			mockValidateConfiguration.mockResolvedValue({
				valid: false,
				error: "Authentication failed (HTTP 401)",
			})

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(mockValidateConfiguration).toHaveBeenCalled()
			expect(result.valid).toBe(false)
			expect(result.error).toContain("Authentication failed (HTTP 401)")
			expect(result.error).toContain("Google AI Studio")
			expect(result.error).toContain("makersuite.google.com/app/apikey")
		})

		it("should enhance model error messages with supported models list", async () => {
			// Arrange
			embedder = new GeminiEmbedder("test-api-key", "invalid-model")
			mockValidateConfiguration.mockResolvedValue({
				valid: false,
				error: "Model not found (HTTP 404)",
			})

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(false)
			expect(result.error).toContain("Model not found")
			expect(result.error).toContain("text-embedding-004")
			expect(result.error).toContain("gemini-embedding-001")
			expect(result.error).toContain("dimension: 768")
			expect(result.error).toContain("dimension: 2048")
		})

		it("should enhance connection error messages with API endpoint info", async () => {
			// Arrange
			embedder = new GeminiEmbedder("test-api-key")
			mockValidateConfiguration.mockResolvedValue({
				valid: false,
				error: "connection refused",
			})

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(false)
			expect(result.error).toContain("connection refused")
			expect(result.error).toContain("https://generativelanguage.googleapis.com/v1beta/openai/")
		})

		it("should pass through validation errors without enhancement for non-specific errors", async () => {
			// Arrange
			embedder = new GeminiEmbedder("test-api-key")
			mockValidateConfiguration.mockResolvedValue({
				valid: false,
				error: "Some other error",
			})

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(mockValidateConfiguration).toHaveBeenCalled()
			expect(result).toEqual({
				valid: false,
				error: "Some other error",
			})
		})

		it("should handle validation exceptions with detailed error message", async () => {
			// Arrange
			embedder = new GeminiEmbedder("test-api-key", "test-model")
			mockValidateConfiguration.mockRejectedValue(new Error("Network error"))

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(false)
			expect(result.error).toContain("Gemini embedder validation failed")
			expect(result.error).toContain("Network error")
			expect(result.error).toContain("test-model")
		})

		it("should handle non-Error exceptions gracefully", async () => {
			// Arrange
			embedder = new GeminiEmbedder("test-api-key", "test-model")
			mockValidateConfiguration.mockRejectedValue("String error")

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(false)
			expect(result.error).toContain("Gemini embedder validation failed")
			expect(result.error).toContain("String error")
			expect(result.error).toContain("test-model")
		})
	})
})
