// Mocks must come first, before imports
vi.mock("axios")

import type { Mock } from "vitest"
import axios from "axios"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import {
	getSapAiCoreModels,
	getCachedSapAiCoreModels,
	clearSapAiCoreCache,
	getSapAiCoreDeployedModelNames,
	type SapAiCoreFetcherOptions,
} from "../sapaicore"
import { DEFAULT_HEADERS } from "../../constants"

const mockedAxios = axios as typeof axios & {
	get: Mock
	post: Mock
	isAxiosError: Mock
}

describe("SAP AI Core Fetcher", () => {
	const mockOptions: SapAiCoreFetcherOptions = {
		sapAiCoreClientId: "test-client-id",
		sapAiCoreClientSecret: "test-client-secret",
		sapAiCoreTokenUrl: "https://test.authentication.sap.hana.ondemand.com",
		sapAiCoreBaseUrl: "https://api.ai.ml.hana.ondemand.com",
		sapAiResourceGroup: "default",
	}

	const mockTokenResponse = {
		access_token: "mock-access-token",
		expires_in: 3600,
		scope: "test-scope",
		jti: "test-jti",
		token_type: "Bearer",
	}

	const mockDeploymentsResponse = {
		resources: [
			{
				id: "deployment-1",
				targetStatus: "RUNNING",
				details: {
					resources: {
						backendDetails: {
							model: {
								name: "anthropic--claude-3.5-sonnet",
								version: "1.0.0",
							},
						},
					},
				},
			},
			{
				id: "deployment-2",
				targetStatus: "RUNNING",
				details: {
					resources: {
						backend_details: {
							model: {
								name: "gpt-4o",
								version: "2.0.0",
							},
						},
					},
				},
			},
			{
				id: "deployment-3",
				targetStatus: "STOPPED",
				details: {
					resources: {
						backendDetails: {
							model: {
								name: "gemini-2.5-pro",
								version: "1.0.0",
							},
						},
					},
				},
			},
		],
	}

	beforeEach(() => {
		vi.clearAllMocks()
		clearSapAiCoreCache()
	})

	afterEach(() => {
		clearSapAiCoreCache()
	})

	describe("getSapAiCoreModels", () => {
		it("should successfully fetch and parse SAP AI Core models", async () => {
			// Mock authentication request
			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})

			// Mock deployments request
			mockedAxios.get.mockResolvedValue({
				data: mockDeploymentsResponse,
			})

			const models = await getSapAiCoreModels(mockOptions)

			expect(models).toBeDefined()
			expect(Object.keys(models)).toHaveLength(2) // Only RUNNING deployments
			expect(models["anthropic--claude-3.5-sonnet"]).toBeDefined()
			expect(models["gpt-4o"]).toBeDefined()
			expect(models["gemini-2.5-pro"]).toBeUndefined() // STOPPED deployment

			// Verify authentication call
			expect(mockedAxios.post).toHaveBeenCalledWith(
				"https://test.authentication.sap.hana.ondemand.com/oauth/token",
				expect.any(URLSearchParams),
				expect.objectContaining({
					headers: expect.objectContaining({
						"Content-Type": "application/x-www-form-urlencoded",
					}),
				}),
			)

			// Verify deployments call
			expect(mockedAxios.get).toHaveBeenCalledWith(
				"https://api.ai.ml.hana.ondemand.com/v2/lm/deployments?$top=10000&$skip=0",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer mock-access-token",
						"AI-Resource-Group": "default",
						"Content-Type": "application/json",
						"AI-Client-Type": "Roo-Code",
					}),
				}),
			)
		})

		it("should handle authentication failure", async () => {
			mockedAxios.post.mockRejectedValue(new Error("Authentication failed"))

			const models = await getSapAiCoreModels(mockOptions)

			expect(models).toEqual({})
			expect(mockedAxios.get).not.toHaveBeenCalled()
		})

		it("should handle deployments fetch failure", async () => {
			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})

			mockedAxios.get.mockRejectedValue(new Error("Deployments fetch failed"))

			const models = await getSapAiCoreModels(mockOptions)

			expect(models).toEqual({})
		})

		it("should validate HTTPS URLs", async () => {
			const invalidOptions = {
				...mockOptions,
				sapAiCoreTokenUrl: "http://insecure.example.com",
			}

			const models = await getSapAiCoreModels(invalidOptions)

			expect(models).toEqual({})
			expect(mockedAxios.post).not.toHaveBeenCalled()
		})

		it("should handle missing credentials gracefully", async () => {
			const incompleteOptions = {
				...mockOptions,
				sapAiCoreClientId: "",
				sapAiCoreClientSecret: "",
			}

			const models = await getSapAiCoreModels(incompleteOptions)

			expect(models).toEqual({})
			expect(mockedAxios.post).not.toHaveBeenCalled()
		})

		it("should use cached models when available", async () => {
			// First call - should make API requests
			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})
			mockedAxios.get.mockResolvedValue({
				data: mockDeploymentsResponse,
			})

			const models1 = await getSapAiCoreModels(mockOptions)

			// Second call - should use cache
			const models2 = await getSapAiCoreModels(mockOptions)

			expect(models1).toEqual(models2)
			expect(mockedAxios.post).toHaveBeenCalledTimes(1)
			expect(mockedAxios.get).toHaveBeenCalledTimes(1)
		})

		it("should handle invalid token response format", async () => {
			mockedAxios.post.mockResolvedValue({
				data: { invalid: "response" },
			})

			const models = await getSapAiCoreModels(mockOptions)

			expect(models).toEqual({})
		})

		it("should handle invalid deployments response format", async () => {
			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})

			mockedAxios.get.mockResolvedValue({
				data: { invalid: "response" },
			})

			const models = await getSapAiCoreModels(mockOptions)

			expect(models).toEqual({})
		})

		it("should handle deployments with missing model information", async () => {
			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})

			const incompleteDeploymentsResponse = {
				resources: [
					{
						id: "deployment-1",
						targetStatus: "RUNNING",
						details: {
							resources: {
								backendDetails: {
									// Missing model information
								},
							},
						},
					},
					{
						id: "deployment-2",
						targetStatus: "RUNNING",
						details: {
							resources: {
								backendDetails: {
									model: {
										// Missing name
										version: "1.0.0",
									},
								},
							},
						},
					},
				],
			}

			mockedAxios.get.mockResolvedValue({
				data: incompleteDeploymentsResponse,
			})

			const models = await getSapAiCoreModels(mockOptions)

			expect(models).toEqual({})
		})

		it("should handle token expiration and refresh", async () => {
			// First authentication
			mockedAxios.post.mockResolvedValue({
				data: { ...mockTokenResponse, expires_in: -1 }, // Expired token
			})

			mockedAxios.get.mockResolvedValue({
				data: mockDeploymentsResponse,
			})

			await getSapAiCoreModels(mockOptions)

			// Second call should trigger re-authentication
			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})

			mockedAxios.get.mockResolvedValue({
				data: mockDeploymentsResponse,
			})

			await getSapAiCoreModels(mockOptions)

			expect(mockedAxios.post).toHaveBeenCalledTimes(2)
		})
	})

	describe("getSapAiCoreDeployedModelNames", () => {
		it("should return sorted model names", async () => {
			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})

			mockedAxios.get.mockResolvedValue({
				data: mockDeploymentsResponse,
			})

			const modelNames = await getSapAiCoreDeployedModelNames(mockOptions)

			expect(modelNames).toEqual(["anthropic--claude-3.5-sonnet", "gpt-4o"])
		})

		it("should handle errors gracefully", async () => {
			mockedAxios.post.mockRejectedValue(new Error("Network error"))

			const modelNames = await getSapAiCoreDeployedModelNames(mockOptions)

			expect(modelNames).toEqual([])
		})
	})

	describe("Cache functions", () => {
		it("should return null when no cache exists", () => {
			const cached = getCachedSapAiCoreModels()
			expect(cached).toBeNull()
		})

		it("should return cached models after successful fetch", async () => {
			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})

			mockedAxios.get.mockResolvedValue({
				data: mockDeploymentsResponse,
			})

			await getSapAiCoreModels(mockOptions)

			const cached = getCachedSapAiCoreModels()
			expect(cached).toBeDefined()
			expect(Object.keys(cached!)).toHaveLength(2)
		})

		it("should clear cache when requested", async () => {
			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})

			mockedAxios.get.mockResolvedValue({
				data: mockDeploymentsResponse,
			})

			await getSapAiCoreModels(mockOptions)
			expect(getCachedSapAiCoreModels()).toBeDefined()

			clearSapAiCoreCache()
			expect(getCachedSapAiCoreModels()).toBeNull()
		})
	})

	describe("Model information parsing", () => {
		it("should include deployment ID in model description", async () => {
			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})

			mockedAxios.get.mockResolvedValue({
				data: mockDeploymentsResponse,
			})

			const models = await getSapAiCoreModels(mockOptions)

			expect(models["anthropic--claude-3.5-sonnet"].description).toContain("deployment-1")
			expect(models["gpt-4o"].description).toContain("deployment-2")
		})

		it("should handle unknown models with fallback information", async () => {
			const unknownModelResponse = {
				resources: [
					{
						id: "deployment-unknown",
						targetStatus: "RUNNING",
						details: {
							resources: {
								backendDetails: {
									model: {
										name: "unknown-model",
										version: "1.0.0",
									},
								},
							},
						},
					},
				],
			}

			mockedAxios.post.mockResolvedValue({
				data: mockTokenResponse,
			})

			mockedAxios.get.mockResolvedValue({
				data: unknownModelResponse,
			})

			const models = await getSapAiCoreModels(mockOptions)

			expect(models["unknown-model"]).toBeDefined()
			expect(models["unknown-model"].description).toContain("Unknown model")
			expect(models["unknown-model"].maxTokens).toBe(8192)
			expect(models["unknown-model"].contextWindow).toBe(200000)
		})
	})

	describe("Error handling", () => {
		it("should handle network timeouts", async () => {
			const timeoutError = new Error("timeout")
			timeoutError.name = "ECONNABORTED"
			mockedAxios.post.mockRejectedValue(timeoutError)

			const models = await getSapAiCoreModels(mockOptions)

			expect(models).toEqual({})
		})

		it("should handle HTTP error responses", async () => {
			const httpError = {
				response: {
					status: 401,
					statusText: "Unauthorized",
					data: "Invalid credentials",
				},
				isAxiosError: true,
			}

			mockedAxios.post.mockRejectedValue(httpError)

			const models = await getSapAiCoreModels(mockOptions)

			expect(models).toEqual({})
		})

		it("should handle malformed JSON responses", async () => {
			mockedAxios.post.mockResolvedValue({
				data: "invalid json",
			})

			const models = await getSapAiCoreModels(mockOptions)

			expect(models).toEqual({})
		})
	})
})
