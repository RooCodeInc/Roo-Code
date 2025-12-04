import { beforeEach, describe, expect, it, vi } from "vitest"
import { OpenAICompatibleEmbedder } from "../openai-compatible"
import { OpenAI } from "openai"

// Mock the i18n module
vi.mock("../../../../i18n", () => ({
	t: (key: string, params?: any) => {
		const translations: Record<string, string> = {
			"embeddings:validation.baseUrlRequired": "Base URL is required",
			"embeddings:validation.apiKeyRequired": "API key is required",
			"embeddings:textExceedsTokenLimit": `Text at index ${params?.index} exceeds maximum token limit`,
			"embeddings:failedMaxAttempts": `Failed after ${params?.attempts} attempts`,
			"embeddings:rateLimitRetry": `Rate limit hit, retrying in ${params?.delayMs}ms`,
		}
		return translations[key] || key
	},
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock OpenAI SDK
vi.mock("openai", () => {
	const mockCreate = vi.fn()
	const mockOpenAI = vi.fn().mockImplementation(() => ({
		embeddings: {
			create: mockCreate,
		},
	}))
	return { OpenAI: mockOpenAI }
})

describe("OpenAICompatibleEmbedder - Batch Size Limits", () => {
	let mockEmbeddingsCreate: any

	beforeEach(() => {
		vi.clearAllMocks()
		mockEmbeddingsCreate = vi.fn()
		;(OpenAI as any).mockImplementation(() => ({
			embeddings: {
				create: mockEmbeddingsCreate,
			},
		}))
	})

	describe("Batch size limiting for Qwen models", () => {
		it("should automatically limit batch size to 10 for text-embedding-v4 model", async () => {
			const embedder = new OpenAICompatibleEmbedder(
				"https://dashscope.aliyuncs.com/compatible-mode/v1/",
				"test-api-key",
				"text-embedding-v4",
			)

			// Mock successful responses for each batch
			mockEmbeddingsCreate
				.mockResolvedValueOnce({
					data: Array(10)
						.fill(null)
						.map(() => ({ embedding: "base64data1" })),
					usage: { prompt_tokens: 50, total_tokens: 50 },
				})
				.mockResolvedValueOnce({
					data: Array(5)
						.fill(null)
						.map(() => ({ embedding: "base64data2" })),
					usage: { prompt_tokens: 25, total_tokens: 25 },
				})

			// Create 15 texts
			const texts = Array(15)
				.fill(null)
				.map((_, i) => `test text ${i}`)
			const result = await embedder.createEmbeddings(texts)

			// Should have been called twice: once with 10 items, once with 5
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)

			// First call should have 10 texts
			expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(10)
			expect(mockEmbeddingsCreate.mock.calls[0][0].input).toEqual(texts.slice(0, 10))

			// Second call should have 5 texts
			expect(mockEmbeddingsCreate.mock.calls[1][0].input).toHaveLength(5)
			expect(mockEmbeddingsCreate.mock.calls[1][0].input).toEqual(texts.slice(10))

			// Result should have all 15 embeddings
			expect(result.embeddings).toHaveLength(15)
			expect(result.usage?.promptTokens).toBe(75)
		})

		it("should limit batch size to 10 for models containing 'qwen' in the name", async () => {
			const embedder = new OpenAICompatibleEmbedder(
				"https://api.example.com/v1/",
				"test-api-key",
				"qwen-3-embedding",
			)

			// Mock successful responses
			mockEmbeddingsCreate
				.mockResolvedValueOnce({
					data: Array(10)
						.fill(null)
						.map(() => ({ embedding: "base64data" })),
					usage: { prompt_tokens: 50, total_tokens: 50 },
				})
				.mockResolvedValueOnce({
					data: Array(2)
						.fill(null)
						.map(() => ({ embedding: "base64data" })),
					usage: { prompt_tokens: 10, total_tokens: 10 },
				})

			const texts = Array(12)
				.fill(null)
				.map((_, i) => `text ${i}`)
			await embedder.createEmbeddings(texts)

			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
			expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(10)
			expect(mockEmbeddingsCreate.mock.calls[1][0].input).toHaveLength(2)
		})

		it("should respect custom batch size when explicitly provided", async () => {
			const embedder = new OpenAICompatibleEmbedder(
				"https://api.example.com/v1/",
				"test-api-key",
				"custom-model",
				8191, // maxItemTokens
				5, // maxBatchSize
			)

			// Mock successful responses
			mockEmbeddingsCreate
				.mockResolvedValueOnce({
					data: Array(5)
						.fill(null)
						.map(() => ({ embedding: "base64data" })),
					usage: { prompt_tokens: 25, total_tokens: 25 },
				})
				.mockResolvedValueOnce({
					data: Array(3)
						.fill(null)
						.map(() => ({ embedding: "base64data" })),
					usage: { prompt_tokens: 15, total_tokens: 15 },
				})

			const texts = Array(8)
				.fill(null)
				.map((_, i) => `text ${i}`)
			await embedder.createEmbeddings(texts)

			// Should batch into 5 and 3
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
			expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(5)
			expect(mockEmbeddingsCreate.mock.calls[1][0].input).toHaveLength(3)
		})

		it("should not limit batch size for non-Qwen models by default", async () => {
			const embedder = new OpenAICompatibleEmbedder(
				"https://api.openai.com/v1/",
				"test-api-key",
				"text-embedding-3-small",
			)

			// Create 20 small texts that fit within token limits
			const texts = Array(20)
				.fill(null)
				.map((_, i) => `t${i}`) // Very short to stay under token limits

			// Mock successful response for all 20 items at once
			mockEmbeddingsCreate.mockResolvedValueOnce({
				data: Array(20)
					.fill(null)
					.map(() => ({ embedding: "base64data" })),
				usage: { prompt_tokens: 100, total_tokens: 100 },
			})

			await embedder.createEmbeddings(texts)

			// Should be called only once with all 20 items
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)
			expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(20)
		})

		it("should handle token limits and batch size limits together", async () => {
			const embedder = new OpenAICompatibleEmbedder(
				"https://dashscope.aliyuncs.com/compatible-mode/v1/",
				"test-api-key",
				"text-embedding-v4",
			)

			// Create texts with varying lengths
			// Each text is about 10000 chars = ~2500 tokens
			const longTexts = Array(15)
				.fill(null)
				.map((_, i) => `${"x".repeat(10000)} ${i}`)

			// Mock responses - expecting batches due to both token and size limits
			mockEmbeddingsCreate.mockImplementation(() =>
				Promise.resolve({
					data: Array(mockEmbeddingsCreate.mock.calls.length <= 1 ? 10 : 5)
						.fill(null)
						.map(() => ({ embedding: "base64data" })),
					usage: { prompt_tokens: 50, total_tokens: 50 },
				}),
			)

			await embedder.createEmbeddings(longTexts)

			// Should have multiple calls due to both batch size and token limits
			expect(mockEmbeddingsCreate.mock.calls.length).toBeGreaterThan(1)
			// No batch should exceed 10 items for Qwen
			mockEmbeddingsCreate.mock.calls.forEach((call: any[]) => {
				expect(call[0].input.length).toBeLessThanOrEqual(10)
			})
		})
	})

	describe("Batch size detection for various model patterns", () => {
		const testCases = [
			{ model: "text-embedding-v4", shouldLimit: true },
			{ model: "text-embedding-v3", shouldLimit: true },
			{ model: "qwen-3-embedding", shouldLimit: true },
			{ model: "qwen3-embedding-0.6b", shouldLimit: true },
			{ model: "QWEN-Embedding-Large", shouldLimit: true },
			{ model: "text-embedding-3d-large", shouldLimit: true },
			{ model: "text-embedding-ada-002", shouldLimit: false },
			{ model: "text-embedding-3-small", shouldLimit: false },
			{ model: "mistral-embed", shouldLimit: false },
		]

		testCases.forEach(({ model, shouldLimit }) => {
			it(`should ${shouldLimit ? "limit" : "not limit"} batch size for model: ${model}`, async () => {
				const embedder = new OpenAICompatibleEmbedder("https://api.example.com/v1/", "test-api-key", model)

				// Create 12 texts
				const texts = Array(12)
					.fill(null)
					.map((_, i) => `text ${i}`)

				if (shouldLimit) {
					// Mock two batches for limited models
					mockEmbeddingsCreate
						.mockResolvedValueOnce({
							data: Array(10)
								.fill(null)
								.map(() => ({ embedding: "base64data" })),
							usage: { prompt_tokens: 50, total_tokens: 50 },
						})
						.mockResolvedValueOnce({
							data: Array(2)
								.fill(null)
								.map(() => ({ embedding: "base64data" })),
							usage: { prompt_tokens: 10, total_tokens: 10 },
						})
				} else {
					// Mock single batch for unlimited models
					mockEmbeddingsCreate.mockResolvedValueOnce({
						data: Array(12)
							.fill(null)
							.map(() => ({ embedding: "base64data" })),
						usage: { prompt_tokens: 60, total_tokens: 60 },
					})
				}

				await embedder.createEmbeddings(texts)

				if (shouldLimit) {
					expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
					expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(10)
					expect(mockEmbeddingsCreate.mock.calls[1][0].input).toHaveLength(2)
				} else {
					expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)
					expect(mockEmbeddingsCreate.mock.calls[0][0].input).toHaveLength(12)
				}
			})
		})
	})
})
