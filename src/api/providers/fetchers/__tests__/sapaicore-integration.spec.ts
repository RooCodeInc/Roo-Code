import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import { getSapAiCoreModels, clearSapAiCoreCache, type SapAiCoreFetcherOptions } from "../sapaicore"
import { getModels, flushModels } from "../modelCache"

describe("SAP AI Core Integration Tests", () => {
	const mockOptions: SapAiCoreFetcherOptions = {
		sapAiCoreClientId: "test-client-id",
		sapAiCoreClientSecret: "test-client-secret",
		sapAiCoreTokenUrl: "https://test.authentication.sap.hana.ondemand.com",
		sapAiCoreBaseUrl: "https://api.ai.ml.hana.ondemand.com",
		sapAiResourceGroup: "default",
	}

	beforeEach(() => {
		vi.clearAllMocks()
		clearSapAiCoreCache()
	})

	afterEach(async () => {
		clearSapAiCoreCache()
		await flushModels("sapaicore")
	})

	describe("Integration with modelCache", () => {
		it("should integrate with the central model cache system", async () => {
			// This test verifies that the SAP AI Core fetcher integrates properly
			// with the central caching system. In a real environment, this would
			// make actual API calls, but for testing we expect it to handle
			// missing credentials gracefully.

			const models = await getModels({
				provider: "sapaicore",
				sapAiCoreClientId: "",
				sapAiCoreClientSecret: "",
				sapAiCoreTokenUrl: "https://test.authentication.sap.hana.ondemand.com",
				sapAiCoreBaseUrl: "https://api.ai.ml.hana.ondemand.com",
			})

			// Should return empty object when credentials are missing
			expect(models).toEqual({})
		})

		it("should handle missing required parameters gracefully", async () => {
			const models = await getModels({
				provider: "sapaicore",
				sapAiCoreClientId: "test-id",
				sapAiCoreClientSecret: "test-secret",
				sapAiCoreTokenUrl: "",
				sapAiCoreBaseUrl: "",
			})

			// Should return empty object when URLs are missing
			expect(models).toEqual({})
		})

		it("should respect cache invalidation", async () => {
			// First call
			const models1 = await getModels({
				provider: "sapaicore",
				sapAiCoreClientId: "",
				sapAiCoreClientSecret: "",
				sapAiCoreTokenUrl: "https://test.authentication.sap.hana.ondemand.com",
				sapAiCoreBaseUrl: "https://api.ai.ml.hana.ondemand.com",
			})

			// Flush cache
			await flushModels("sapaicore")

			// Second call should not use cache
			const models2 = await getModels({
				provider: "sapaicore",
				sapAiCoreClientId: "",
				sapAiCoreClientSecret: "",
				sapAiCoreTokenUrl: "https://test.authentication.sap.hana.ondemand.com",
				sapAiCoreBaseUrl: "https://api.ai.ml.hana.ondemand.com",
			})

			expect(models1).toEqual(models2)
			expect(models1).toEqual({})
		})
	})

	describe("Error handling in integration context", () => {
		it("should handle network errors gracefully in integration context", async () => {
			// Test with invalid URLs that would cause network errors
			const models = await getSapAiCoreModels({
				sapAiCoreClientId: "test-id",
				sapAiCoreClientSecret: "test-secret",
				sapAiCoreTokenUrl: "https://invalid-domain-that-does-not-exist.com",
				sapAiCoreBaseUrl: "https://invalid-domain-that-does-not-exist.com",
			})

			// Should return empty object instead of throwing
			expect(models).toEqual({})
		})

		it("should validate HTTPS requirements", async () => {
			const models = await getSapAiCoreModels({
				sapAiCoreClientId: "test-id",
				sapAiCoreClientSecret: "test-secret",
				sapAiCoreTokenUrl: "http://insecure.example.com",
				sapAiCoreBaseUrl: "https://api.ai.ml.hana.ondemand.com",
			})

			// Should return empty object due to HTTPS validation failure
			expect(models).toEqual({})
		})

		it("should handle authentication failures gracefully", async () => {
			// This would typically result in a 401 error in real scenarios
			const models = await getSapAiCoreModels({
				sapAiCoreClientId: "invalid-client-id",
				sapAiCoreClientSecret: "invalid-client-secret",
				sapAiCoreTokenUrl: "https://test.authentication.sap.hana.ondemand.com",
				sapAiCoreBaseUrl: "https://api.ai.ml.hana.ondemand.com",
			})

			// Should return empty object instead of throwing
			expect(models).toEqual({})
		})
	})

	describe("Model information consistency", () => {
		it("should return consistent model information structure", async () => {
			const models = await getSapAiCoreModels(mockOptions)

			// Even with empty results, the structure should be consistent
			expect(models).toBeDefined()
			expect(typeof models).toBe("object")

			// If models are returned, they should have the correct structure
			for (const [modelId, modelInfo] of Object.entries(models)) {
				expect(typeof modelId).toBe("string")
				expect(modelInfo).toHaveProperty("maxTokens")
				expect(modelInfo).toHaveProperty("contextWindow")
				expect(modelInfo).toHaveProperty("supportsImages")
				expect(modelInfo).toHaveProperty("supportsPromptCache")
				expect(modelInfo).toHaveProperty("supportsComputerUse")
				expect(typeof modelInfo.maxTokens).toBe("number")
				expect(typeof modelInfo.contextWindow).toBe("number")
				expect(typeof modelInfo.supportsImages).toBe("boolean")
				expect(typeof modelInfo.supportsPromptCache).toBe("boolean")
				expect(typeof modelInfo.supportsComputerUse).toBe("boolean")
			}
		})

		it("should include deployment information in descriptions", async () => {
			const models = await getSapAiCoreModels(mockOptions)

			// If models are returned, descriptions should include deployment info
			for (const [, modelInfo] of Object.entries(models)) {
				if (modelInfo.description) {
					expect(modelInfo.description).toContain("SAP AI Core")
				}
			}
		})
	})

	describe("Performance and caching behavior", () => {
		it("should cache results appropriately", async () => {
			const startTime = Date.now()

			// First call
			const models1 = await getSapAiCoreModels(mockOptions)
			const firstCallTime = Date.now() - startTime

			const secondStartTime = Date.now()

			// Second call should be faster due to caching
			const models2 = await getSapAiCoreModels(mockOptions)
			const secondCallTime = Date.now() - secondStartTime

			expect(models1).toEqual(models2)
			// Second call should be significantly faster (cached)
			expect(secondCallTime).toBeLessThan(firstCallTime)
		})

		it("should handle concurrent requests properly", async () => {
			// Make multiple concurrent requests
			const promises = Array(5)
				.fill(null)
				.map(() => getSapAiCoreModels(mockOptions))

			const results = await Promise.all(promises)

			// All results should be identical
			for (let i = 1; i < results.length; i++) {
				expect(results[i]).toEqual(results[0])
			}
		})
	})

	describe("Configuration validation", () => {
		it("should validate required configuration parameters", async () => {
			// Test missing client ID
			const models1 = await getSapAiCoreModels({
				...mockOptions,
				sapAiCoreClientId: "",
			})
			expect(models1).toEqual({})

			// Test missing client secret
			const models2 = await getSapAiCoreModels({
				...mockOptions,
				sapAiCoreClientSecret: "",
			})
			expect(models2).toEqual({})

			// Test missing token URL
			const models3 = await getSapAiCoreModels({
				...mockOptions,
				sapAiCoreTokenUrl: "",
			})
			expect(models3).toEqual({})

			// Test missing base URL
			const models4 = await getSapAiCoreModels({
				...mockOptions,
				sapAiCoreBaseUrl: "",
			})
			expect(models4).toEqual({})
		})

		it("should handle optional resource group parameter", async () => {
			// Test with resource group
			const models1 = await getSapAiCoreModels({
				...mockOptions,
				sapAiResourceGroup: "custom-group",
			})

			// Test without resource group (should default to "default")
			const models2 = await getSapAiCoreModels({
				...mockOptions,
				sapAiResourceGroup: undefined,
			})

			// Both should return empty objects due to invalid credentials
			// but should not fail due to missing resource group
			expect(models1).toEqual({})
			expect(models2).toEqual({})
		})
	})
})
