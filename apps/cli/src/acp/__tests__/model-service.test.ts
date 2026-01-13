/**
 * Tests for ModelService
 */

import { ModelService, createModelService } from "../model-service.js"
import { DEFAULT_MODELS } from "../types.js"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("ModelService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockFetch.mockReset()
	})

	describe("constructor", () => {
		it("should create a ModelService with default options", () => {
			const service = new ModelService()
			expect(service).toBeInstanceOf(ModelService)
		})

		it("should create a ModelService with custom options", () => {
			const service = new ModelService({
				apiUrl: "https://custom.api.com",
				apiKey: "test-key",
				timeout: 10000,
			})
			expect(service).toBeInstanceOf(ModelService)
		})
	})

	describe("createModelService factory", () => {
		it("should create a ModelService instance", () => {
			const service = createModelService()
			expect(service).toBeInstanceOf(ModelService)
		})

		it("should pass options to ModelService", () => {
			const service = createModelService({
				apiKey: "test-api-key",
			})
			expect(service).toBeInstanceOf(ModelService)
		})
	})

	describe("fetchAvailableModels", () => {
		it("should return cached models on subsequent calls", async () => {
			const service = new ModelService()

			// First call - should fetch from API
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					object: "list",
					data: [
						{ id: "model-1", owned_by: "test" },
						{ id: "model-2", owned_by: "test" },
					],
				}),
			})

			const firstResult = await service.fetchAvailableModels()
			expect(mockFetch).toHaveBeenCalledTimes(1)

			// Second call - should use cache
			const secondResult = await service.fetchAvailableModels()
			expect(mockFetch).toHaveBeenCalledTimes(1) // No additional fetch
			expect(secondResult).toEqual(firstResult)
		})

		it("should return DEFAULT_MODELS when API fails", async () => {
			const service = new ModelService()

			mockFetch.mockRejectedValueOnce(new Error("Network error"))

			const result = await service.fetchAvailableModels()
			expect(result).toEqual(DEFAULT_MODELS)
		})

		it("should return DEFAULT_MODELS when API returns non-OK status", async () => {
			const service = new ModelService()

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
			})

			const result = await service.fetchAvailableModels()
			expect(result).toEqual(DEFAULT_MODELS)
		})

		it("should return DEFAULT_MODELS when API returns invalid response", async () => {
			const service = new ModelService()

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ invalid: "response" }),
			})

			const result = await service.fetchAvailableModels()
			expect(result).toEqual(DEFAULT_MODELS)
		})

		it("should return DEFAULT_MODELS on timeout", async () => {
			const service = new ModelService({ timeout: 100 })

			// Mock a fetch that never resolves
			mockFetch.mockImplementationOnce(
				() =>
					new Promise((_, reject) => {
						setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 50)
					}),
			)

			const result = await service.fetchAvailableModels()
			expect(result).toEqual(DEFAULT_MODELS)
		})

		it("should transform API response to AcpModel format using name and description fields", async () => {
			const service = new ModelService()

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [
						{
							id: "anthropic/claude-3-sonnet",
							name: "Claude 3 Sonnet",
							description: "A balanced model for most tasks",
							owned_by: "anthropic",
						},
						{
							id: "openai/gpt-4",
							name: "GPT-4",
							description: "OpenAI's flagship model",
							owned_by: "openai",
						},
					],
				}),
			})

			const result = await service.fetchAvailableModels()

			// Should include transformed models with name and description from API
			expect(result).toHaveLength(2)
			expect(result).toContainEqual({
				modelId: "anthropic/claude-3-sonnet",
				name: "Claude 3 Sonnet",
				description: "A balanced model for most tasks",
			})
			expect(result).toContainEqual({
				modelId: "openai/gpt-4",
				name: "GPT-4",
				description: "OpenAI's flagship model",
			})
		})

		it("should sort models by model ID", async () => {
			const service = new ModelService()

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [
						{ id: "openai/gpt-4", name: "GPT-4" },
						{ id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet" },
						{ id: "google/gemini-pro", name: "Gemini Pro" },
					],
				}),
			})

			const result = await service.fetchAvailableModels()

			// Should be sorted by model ID
			expect(result[0]!.modelId).toBe("anthropic/claude-3-sonnet")
			expect(result[1]!.modelId).toBe("google/gemini-pro")
			expect(result[2]!.modelId).toBe("openai/gpt-4")
		})

		it("should include Authorization header when apiKey is provided", async () => {
			const service = new ModelService({ apiKey: "test-api-key" })

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
			})

			await service.fetchAvailableModels()

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-api-key",
					}),
				}),
			)
		})
	})

	describe("clearCache", () => {
		it("should clear the cached models", async () => {
			const service = new ModelService()

			// First fetch
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [{ id: "model-1" }],
				}),
			})

			await service.fetchAvailableModels()
			expect(mockFetch).toHaveBeenCalledTimes(1)

			// Clear cache
			service.clearCache()

			// Second fetch - should call API again
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [{ id: "model-2" }],
				}),
			})

			await service.fetchAvailableModels()
			expect(mockFetch).toHaveBeenCalledTimes(2)
		})
	})
})
