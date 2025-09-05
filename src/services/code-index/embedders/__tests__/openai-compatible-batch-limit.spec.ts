import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { OpenAICompatibleEmbedder } from "../openai-compatible"
import { OpenAI } from "openai"

// Mock OpenAI
vi.mock("openai")

// Mock the embeddingModels module
vi.mock("../../../../shared/embeddingModels", () => ({
	getDefaultModelId: vi.fn().mockReturnValue("text-embedding-3-small"),
	getModelQueryPrefix: vi.fn().mockReturnValue(undefined),
	getModelMaxBatchSize: vi.fn(),
}))

// Mock the translation function
vi.mock("../../../../i18n", () => ({
	t: (key: string, params?: any) => {
		const translations: Record<string, string> = {
			"embeddings:textExceedsTokenLimit": `Text at index ${params?.index} exceeds token limit`,
			"embeddings:failedMaxAttempts": `Failed after ${params?.attempts} attempts`,
		}
		return translations[key] || key
	},
}))

// Import mocked functions
import { getModelMaxBatchSize } from "../../../../shared/embeddingModels"
const mockGetModelMaxBatchSize = getModelMaxBatchSize as any

describe("OpenAICompatibleEmbedder - Batch Size Limits", () => {
	let mockOpenAIInstance: any
	let mockEmbeddingsCreate: any

	const testBaseUrl = "https://api.example.com/v1"
	const testApiKey = "test-api-key"

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup OpenAI mock
		mockEmbeddingsCreate = vi.fn()
		mockOpenAIInstance = {
			embeddings: {
				create: mockEmbeddingsCreate,
			},
		}
		;(OpenAI as any).mockImplementation(() => mockOpenAIInstance)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Model-specific batch size limits", () => {
		it("should respect model-specific batch size limit from profile", async () => {
			// Setup model with batch size limit of 10
			mockGetModelMaxBatchSize.mockReturnValue(10)

			const embedder = new OpenAICompatibleEmbedder(testBaseUrl, testApiKey, "qwen3-embedding")

			// Create 15 texts - should be split into 2 batches (10 + 5)
			const texts = Array.from({ length: 15 }, (_, i) => `Text ${i}`)

			// Mock successful responses
			mockEmbeddingsCreate
				.mockResolvedValueOnce({
					data: Array.from({ length: 10 }, (_, i) => ({
						embedding: Buffer.from(new Float32Array([i, i + 0.1, i + 0.2]).buffer).toString("base64"),
					})),
					usage: { prompt_tokens: 100, total_tokens: 150 },
				})
				.mockResolvedValueOnce({
					data: Array.from({ length: 5 }, (_, i) => ({
						embedding: Buffer.from(new Float32Array([i + 10, i + 10.1, i + 10.2]).buffer).toString(
							"base64",
						),
					})),
					usage: { prompt_tokens: 50, total_tokens: 75 },
				})

			const result = await embedder.createEmbeddings(texts)

			// Should have made 2 API calls
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)

			// First call should have 10 texts
			expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(10)

			// Second call should have 5 texts
			expect(mockEmbeddingsCreate.mock.calls[1][0].input).toHaveLength(5)

			// Result should contain all 15 embeddings
			expect(result.embeddings).toHaveLength(15)
		})

		it("should use constructor-provided maxBatchSize over model profile", async () => {
			// Model profile says 10, but constructor overrides to 5
			mockGetModelMaxBatchSize.mockReturnValue(10)

			const embedder = new OpenAICompatibleEmbedder(
				testBaseUrl,
				testApiKey,
				"qwen3-embedding",
				undefined, // maxItemTokens
				5, // maxBatchSize override
			)

			// Create 12 texts - should be split into 3 batches (5 + 5 + 2)
			const texts = Array.from({ length: 12 }, (_, i) => `Text ${i}`)

			// Mock successful responses
			mockEmbeddingsCreate
				.mockResolvedValueOnce({
					data: Array.from({ length: 5 }, (_, i) => ({
						embedding: Buffer.from(new Float32Array([i, i + 0.1, i + 0.2]).buffer).toString("base64"),
					})),
					usage: { prompt_tokens: 50, total_tokens: 75 },
				})
				.mockResolvedValueOnce({
					data: Array.from({ length: 5 }, (_, i) => ({
						embedding: Buffer.from(new Float32Array([i + 5, i + 5.1, i + 5.2]).buffer).toString("base64"),
					})),
					usage: { prompt_tokens: 50, total_tokens: 75 },
				})
				.mockResolvedValueOnce({
					data: Array.from({ length: 2 }, (_, i) => ({
						embedding: Buffer.from(new Float32Array([i + 10, i + 10.1, i + 10.2]).buffer).toString(
							"base64",
						),
					})),
					usage: { prompt_tokens: 20, total_tokens: 30 },
				})

			const result = await embedder.createEmbeddings(texts)

			// Should have made 3 API calls
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(3)

			// First two calls should have 5 texts each
			expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(5)
			expect(mockEmbeddingsCreate.mock.calls[1][0].input).toHaveLength(5)

			// Third call should have 2 texts
			expect(mockEmbeddingsCreate.mock.calls[2][0].input).toHaveLength(2)

			// Result should contain all 12 embeddings
			expect(result.embeddings).toHaveLength(12)
		})

		it("should handle no batch size limit (undefined)", async () => {
			// No batch size limit from model profile
			mockGetModelMaxBatchSize.mockReturnValue(undefined)

			const embedder = new OpenAICompatibleEmbedder(testBaseUrl, testApiKey, "text-embedding-3-small")

			// Create 100 small texts - should be batched by token limit only
			const texts = Array.from({ length: 100 }, (_, i) => `T${i}`) // Very short texts

			// Mock successful response for large batch
			mockEmbeddingsCreate.mockResolvedValue({
				data: Array.from({ length: 100 }, (_, i) => ({
					embedding: Buffer.from(new Float32Array([i, i + 0.1, i + 0.2]).buffer).toString("base64"),
				})),
				usage: { prompt_tokens: 200, total_tokens: 300 },
			})

			const result = await embedder.createEmbeddings(texts)

			// Should make only 1 API call since texts are small and no batch limit
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)
			expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(100)
			expect(result.embeddings).toHaveLength(100)
		})

		it("should respect batch size limit with mixed text sizes", async () => {
			// Set batch size limit to 10
			mockGetModelMaxBatchSize.mockReturnValue(10)

			const embedder = new OpenAICompatibleEmbedder(testBaseUrl, testApiKey, "qwen3-embedding")

			// Create 20 texts - should be split into 2 batches due to batch size limit
			const texts = Array.from({ length: 20 }, (_, i) => `Text content ${i}`)

			// Mock responses for 2 batches (10 + 10)
			mockEmbeddingsCreate
				.mockResolvedValueOnce({
					data: Array.from({ length: 10 }, (_, i) => ({
						embedding: Buffer.from(new Float32Array([i, i + 0.1, i + 0.2]).buffer).toString("base64"),
					})),
					usage: { prompt_tokens: 100, total_tokens: 150 },
				})
				.mockResolvedValueOnce({
					data: Array.from({ length: 10 }, (_, i) => ({
						embedding: Buffer.from(new Float32Array([i + 10, i + 10.1, i + 10.2]).buffer).toString(
							"base64",
						),
					})),
					usage: { prompt_tokens: 100, total_tokens: 150 },
				})

			const result = await embedder.createEmbeddings(texts)

			// Should have made 2 API calls
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)

			// Each call should have 10 texts (batch size limit)
			expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(10)
			expect(mockEmbeddingsCreate.mock.calls[1][0].input).toHaveLength(10)

			// Result should contain all 20 embeddings
			expect(result.embeddings).toHaveLength(20)
		})
	})

	describe("Aliyun Bailian specific models", () => {
		it("should handle qwen3-embedding model with 10-item batch limit", async () => {
			mockGetModelMaxBatchSize.mockReturnValue(10)

			const embedder = new OpenAICompatibleEmbedder(
				"https://dashscope.aliyuncs.com/compatible-mode/v1",
				testApiKey,
				"qwen3-embedding",
			)

			const texts = Array.from({ length: 25 }, (_, i) => `Text ${i}`)

			// Mock responses for 3 batches (10 + 10 + 5)
			mockEmbeddingsCreate
				.mockResolvedValueOnce({
					data: Array.from({ length: 10 }, (_, i) => ({
						embedding: Buffer.from(new Float32Array([i]).buffer).toString("base64"),
					})),
					usage: { prompt_tokens: 100, total_tokens: 150 },
				})
				.mockResolvedValueOnce({
					data: Array.from({ length: 10 }, (_, i) => ({
						embedding: Buffer.from(new Float32Array([i + 10]).buffer).toString("base64"),
					})),
					usage: { prompt_tokens: 100, total_tokens: 150 },
				})
				.mockResolvedValueOnce({
					data: Array.from({ length: 5 }, (_, i) => ({
						embedding: Buffer.from(new Float32Array([i + 20]).buffer).toString("base64"),
					})),
					usage: { prompt_tokens: 50, total_tokens: 75 },
				})

			const result = await embedder.createEmbeddings(texts)

			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(3)
			expect(result.embeddings).toHaveLength(25)
		})

		it("should handle text-embedding-v4 model with 10-item batch limit", async () => {
			mockGetModelMaxBatchSize.mockReturnValue(10)

			const embedder = new OpenAICompatibleEmbedder(
				"https://dashscope.aliyuncs.com/compatible-mode/v1",
				testApiKey,
				"text-embedding-v4",
			)

			const texts = Array.from({ length: 10 }, (_, i) => `Text ${i}`)

			mockEmbeddingsCreate.mockResolvedValueOnce({
				data: Array.from({ length: 10 }, (_, i) => ({
					embedding: Buffer.from(new Float32Array([i]).buffer).toString("base64"),
				})),
				usage: { prompt_tokens: 100, total_tokens: 150 },
			})

			const result = await embedder.createEmbeddings(texts)

			// Should make exactly 1 call for 10 items (at the limit)
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)
			expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(10)
			expect(result.embeddings).toHaveLength(10)
		})
	})
})
