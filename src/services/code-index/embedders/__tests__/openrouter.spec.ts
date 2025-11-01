// npx vitest run src/services/code-index/embedders/__tests__/openrouter.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { OpenRouterEmbedder } from "../openrouter"
import { OpenAICompatibleEmbedder } from "../openai-compatible"
import { t } from "../../../../i18n"

vi.mock("../../../../i18n", () => ({
	t: (key: string, params?: any) => {
		const translations: Record<string, string> = {
			"embeddings:validation.apiKeyRequired": "API key is required",
		}
		return translations[key] || key
	},
}))

// Mock the parent class
vi.mock("../openai-compatible")

describe("OpenRouterEmbedder", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Mock the OpenAICompatibleEmbedder constructor
		vi.mocked(OpenAICompatibleEmbedder).mockImplementation(function (
			this: any,
			baseUrl: string,
			apiKey: string,
			modelId: string,
			maxTokens: number,
		) {
			// Store constructor arguments for verification
			this.baseUrl = baseUrl
			this.apiKey = apiKey
			this.modelId = modelId
			this.maxTokens = maxTokens

			// Mock methods
			this.createEmbeddings = vi.fn()
			this.validateConfiguration = vi.fn()

			// Return this for chaining
			return this
		} as any)
	})

	describe("constructor", () => {
		it("should create an instance with valid API key", () => {
			const embedder = new OpenRouterEmbedder("test-api-key")
			expect(embedder).toBeDefined()
			expect(OpenAICompatibleEmbedder).toHaveBeenCalledWith(
				"https://openrouter.ai/api/v1",
				"test-api-key",
				"openai/text-embedding-3-small",
				8191,
			)
		})

		it("should use custom model ID when provided", () => {
			const embedder = new OpenRouterEmbedder("test-api-key", "openai/text-embedding-3-large")
			expect(embedder).toBeDefined()
			expect(OpenAICompatibleEmbedder).toHaveBeenCalledWith(
				"https://openrouter.ai/api/v1",
				"test-api-key",
				"openai/text-embedding-3-large",
				8191,
			)
		})

		it("should use custom base URL when provided", () => {
			const embedder = new OpenRouterEmbedder("test-api-key", undefined, "https://custom.openrouter.ai/api/v1")
			expect(embedder).toBeDefined()
			expect(OpenAICompatibleEmbedder).toHaveBeenCalledWith(
				"https://custom.openrouter.ai/api/v1",
				"test-api-key",
				"openai/text-embedding-3-small",
				8191,
			)
		})

		it("should throw error when API key is not provided", () => {
			expect(() => new OpenRouterEmbedder(undefined as any)).toThrow("API key is required")
		})

		it("should throw error when API key is empty string", () => {
			expect(() => new OpenRouterEmbedder("")).toThrow("API key is required")
		})
	})

	describe("embedderInfo", () => {
		it("should return openrouter as the embedder name", () => {
			const embedder = new OpenRouterEmbedder("test-api-key")
			// The embedderInfo getter in OpenRouterEmbedder overrides the parent class
			expect(embedder.embedderInfo).toEqual({ name: "openrouter" })
		})
	})
})
