import { describe, it, expect, beforeEach, vi } from "vitest"
import { OpenRouterEmbedder } from "../openrouter"
import { getModelDimension, getDefaultModelId } from "../../../../shared/embeddingModels"

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("OpenRouterEmbedder", () => {
	const mockApiKey = "test-api-key"

	describe("constructor", () => {
		it("should create an instance with valid API key", () => {
			const embedder = new OpenRouterEmbedder(mockApiKey)
			expect(embedder).toBeInstanceOf(OpenRouterEmbedder)
		})

		it("should throw error with empty API key", () => {
			expect(() => new OpenRouterEmbedder("")).toThrow("API key is required")
		})

		it("should use default model when none specified", () => {
			const embedder = new OpenRouterEmbedder(mockApiKey)
			const expectedDefault = getDefaultModelId("openrouter")
			expect(embedder.embedderInfo.name).toBe("openrouter")
		})

		it("should use custom model when specified", () => {
			const customModel = "openai/text-embedding-3-small"
			const embedder = new OpenRouterEmbedder(mockApiKey, customModel)
			expect(embedder.embedderInfo.name).toBe("openrouter")
		})
	})

	describe("embedderInfo", () => {
		it("should return correct embedder info", () => {
			const embedder = new OpenRouterEmbedder(mockApiKey)
			expect(embedder.embedderInfo).toEqual({
				name: "openrouter",
			})
		})
	})

	describe("createEmbeddings", () => {
		let embedder: OpenRouterEmbedder

		beforeEach(() => {
			embedder = new OpenRouterEmbedder(mockApiKey)
			mockFetch.mockClear()
		})

		it("should create embeddings successfully", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [
						{
							embedding: Buffer.from(new Float32Array([0.1, 0.2, 0.3]).buffer).toString("base64"),
						},
					],
					usage: {
						prompt_tokens: 5,
						total_tokens: 5,
					},
				}),
			}

			mockFetch.mockResolvedValue(mockResponse)

			const result = await embedder.createEmbeddings(["test text"])

			expect(result.embeddings).toHaveLength(1)
			expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3])
			expect(result.usage?.promptTokens).toBe(5)
			expect(result.usage?.totalTokens).toBe(5)
		})

		it("should handle multiple texts", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [
						{
							embedding: Buffer.from(new Float32Array([0.1, 0.2]).buffer).toString("base64"),
						},
						{
							embedding: Buffer.from(new Float32Array([0.3, 0.4]).buffer).toString("base64"),
						},
					],
					usage: {
						prompt_tokens: 10,
						total_tokens: 10,
					},
				}),
			}

			mockFetch.mockResolvedValue(mockResponse)

			const result = await embedder.createEmbeddings(["text1", "text2"])

			expect(result.embeddings).toHaveLength(2)
			expect(result.embeddings[0]).toEqual([0.1, 0.2])
			expect(result.embeddings[1]).toEqual([0.3, 0.4])
		})

		it("should use custom model when provided", async () => {
			const customModel = "mistralai/mistral-embed-2312"
			const embedderWithCustomModel = new OpenRouterEmbedder(mockApiKey, customModel)

			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [
						{
							embedding: Buffer.from(new Float32Array([0.1, 0.2]).buffer).toString("base64"),
						},
					],
					usage: {
						prompt_tokens: 5,
						total_tokens: 5,
					},
				}),
			}

			mockFetch.mockResolvedValue(mockResponse)

			await embedderWithCustomModel.createEmbeddings(["test"])

			// Verify the fetch was called with the custom model
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("openrouter.ai/api/v1/embeddings"),
				expect.objectContaining({
					body: expect.stringContaining(`"model":"${customModel}"`),
				}),
			)
		})
	})

	describe("validateConfiguration", () => {
		let embedder: OpenRouterEmbedder

		beforeEach(() => {
			embedder = new OpenRouterEmbedder(mockApiKey)
			mockFetch.mockClear()
		})

		it("should validate configuration successfully", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [
						{
							embedding: Buffer.from(new Float32Array([0.1, 0.2]).buffer).toString("base64"),
						},
					],
				}),
			}

			mockFetch.mockResolvedValue(mockResponse)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()
		})

		it("should handle validation failure", async () => {
			const mockResponse = {
				ok: false,
				status: 401,
				text: vi.fn().mockResolvedValue("Unauthorized"),
			}

			mockFetch.mockResolvedValue(mockResponse)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
		})
	})

	describe("integration with shared models", () => {
		it("should work with defined OpenRouter models", () => {
			const openRouterModels = [
				"openai/text-embedding-3-small",
				"openai/text-embedding-3-large",
				"openai/text-embedding-ada-002",
				"google/gemini-embedding-001",
				"mistralai/mistral-embed-2312",
				"mistralai/codestral-embed-2505",
				"qwen/qwen3-embedding-8b",
			]

			openRouterModels.forEach((model) => {
				const dimension = getModelDimension("openrouter", model)
				expect(dimension).toBeDefined()
				expect(dimension).toBeGreaterThan(0)

				const embedder = new OpenRouterEmbedder(mockApiKey, model)
				expect(embedder.embedderInfo.name).toBe("openrouter")
			})
		})

		it("should use correct default model", () => {
			const defaultModel = getDefaultModelId("openrouter")
			expect(defaultModel).toBe("openai/text-embedding-3-large")

			const dimension = getModelDimension("openrouter", defaultModel)
			expect(dimension).toBe(3072)
		})
	})
})
