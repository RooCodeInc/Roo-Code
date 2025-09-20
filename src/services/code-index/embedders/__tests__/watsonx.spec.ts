import { vitest, describe, it, expect, beforeEach, afterEach } from "vitest"
import type { MockedClass, MockedFunction } from "vitest"
import { WatsonXAI } from "@ibm-cloud/watsonx-ai"
import { IamAuthenticator, CloudPakForDataAuthenticator } from "ibm-cloud-sdk-core"
import { WatsonxEmbedder } from "../watsonx"
import { MAX_ITEM_TOKENS } from "../../constants"

// Mock the WatsonXAI SDK
vitest.mock("@ibm-cloud/watsonx-ai")

// Mock the IBM Cloud SDK Core
vitest.mock("ibm-cloud-sdk-core")

// Mock TelemetryService
vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vitest.fn(),
		},
	},
}))

// Mock i18n
vitest.mock("../../../../i18n", () => ({
	t: (key: string, params?: Record<string, any>) => {
		const translations: Record<string, string> = {
			"embeddings:validation.apiKeyRequired": "API key is required for IBM watsonx embeddings",
			"embeddings:validation.authenticationFailed": "Failed to authenticate with IBM watsonx",
			"embeddings:textExceedsTokenLimit": `Text at index ${params?.index} exceeds maximum token limit (${params?.itemTokens} > ${params?.maxTokens}). Skipping.`,
			"embeddings:validation.invalidResponse": "Invalid response from IBM watsonx API",
			"embeddings:validation.unknownError": "Unknown error occurred",
			"embeddings:validation.invalidApiKey": "Invalid API key",
			"embeddings:validation.endpointNotFound": "Endpoint not found",
			"embeddings:validation.connectionTimeout": "Connection timeout",
			"embeddings:validation.invalidProjectId": "Invalid project ID",
			"embeddings:validation.invalidModelId": "Invalid model ID",
		}
		return translations[key] || key
	},
}))

// Mock console methods
const consoleMocks = {
	error: vitest.spyOn(console, "error").mockImplementation(() => {}),
	warn: vitest.spyOn(console, "warn").mockImplementation(() => {}),
	log: vitest.spyOn(console, "log").mockImplementation(() => {}),
}

describe("WatsonxEmbedder", () => {
	let embedder: WatsonxEmbedder
	let mockEmbedText: MockedFunction<any>
	let mockListFoundationModelSpecs: MockedFunction<any>
	let mockAuthenticate: MockedFunction<any>
	let MockedWatsonXAI: MockedClass<typeof WatsonXAI>
	let MockedIamAuthenticator: MockedClass<typeof IamAuthenticator>
	let MockedCloudPakForDataAuthenticator: MockedClass<typeof CloudPakForDataAuthenticator>

	beforeEach(() => {
		vitest.clearAllMocks()
		consoleMocks.error.mockClear()
		consoleMocks.warn.mockClear()
		consoleMocks.log.mockClear()

		// Set up mock functions first
		mockEmbedText = vitest.fn()
		mockListFoundationModelSpecs = vitest.fn()
		mockAuthenticate = vitest.fn()

		// Mock authenticators
		MockedIamAuthenticator = IamAuthenticator as MockedClass<typeof IamAuthenticator>
		MockedIamAuthenticator.mockImplementation(() => {
			return {
				authenticate: mockAuthenticate,
			} as any
		})

		MockedCloudPakForDataAuthenticator = CloudPakForDataAuthenticator as MockedClass<
			typeof CloudPakForDataAuthenticator
		>
		MockedCloudPakForDataAuthenticator.mockImplementation(() => {
			return {
				authenticate: mockAuthenticate,
			} as any
		})

		MockedWatsonXAI = WatsonXAI as MockedClass<typeof WatsonXAI>
		MockedWatsonXAI.mockImplementation(() => {
			return {
				embedText: mockEmbedText,
				listFoundationModelSpecs: mockListFoundationModelSpecs,
				getAuthenticator: () => ({
					authenticate: mockAuthenticate,
				}),
			} as any
		})

		// Default constructor parameters
		embedder = new WatsonxEmbedder("test-api-key")
	})

	afterEach(() => {
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with IBM Cloud authentication by default", () => {
			expect(MockedIamAuthenticator).toHaveBeenCalledWith({ apikey: "test-api-key" })
			expect(MockedWatsonXAI).toHaveBeenCalledWith({
				authenticator: expect.any(Object),
				serviceUrl: "https://us-south.ml.cloud.ibm.com",
				version: "2024-05-31",
			})
			expect(embedder.embedderInfo.name).toBe("watsonx")
		})

		it("should initialize with custom model ID", () => {
			new WatsonxEmbedder("test-api-key", "custom-model-id")
			// We can't directly test the modelId as it's private, but we can verify it was created
			expect(MockedWatsonXAI).toHaveBeenCalled()
		})

		it("should initialize with project ID", () => {
			new WatsonxEmbedder("test-api-key", undefined, "test-project-id")
			// We can't directly test the projectId as it's private, but we can verify it was created
			expect(MockedWatsonXAI).toHaveBeenCalled()
		})

		it("should initialize with custom region", () => {
			new WatsonxEmbedder("test-api-key", undefined, undefined, "ibmCloud", undefined, "eu-de")
			expect(MockedWatsonXAI).toHaveBeenCalledWith(
				expect.objectContaining({
					serviceUrl: "https://eu-de.ml.cloud.ibm.com",
				}),
			)
		})

		it("should initialize with Cloud Pak for Data authentication", () => {
			new WatsonxEmbedder(
				"test-api-key",
				undefined,
				undefined,
				"cloudPak",
				"https://cpd-instance.example.com",
				undefined,
				"test-username",
			)

			expect(MockedCloudPakForDataAuthenticator).toHaveBeenCalledWith({
				url: "https://cpd-instance.example.com",
				username: "test-username",
				apikey: "test-api-key",
			})

			expect(MockedWatsonXAI).toHaveBeenCalledWith(
				expect.objectContaining({
					serviceUrl: "https://cpd-instance.example.com",
				}),
			)
		})

		it("should initialize with Cloud Pak for Data using username/password", () => {
			new WatsonxEmbedder(
				"",
				undefined,
				undefined,
				"cloudPak",
				"https://cpd-instance.example.com",
				undefined,
				"test-username",
				"test-password",
			)

			expect(MockedCloudPakForDataAuthenticator).toHaveBeenCalledWith({
				url: "https://cpd-instance.example.com",
				username: "test-username",
				password: "test-password",
			})
		})

		it("should throw error if API key is not provided and no username/password", () => {
			expect(() => new WatsonxEmbedder("")).toThrow("API key is required for IBM watsonx embeddings")
		})

		it("should throw error if base URL is not provided for Cloud Pak", () => {
			expect(() => new WatsonxEmbedder("test-api-key", undefined, undefined, "cloudPak")).toThrow(
				"Base URL is required for IBM Cloud Pak for Data",
			)
		})

		it("should attempt authentication during initialization", () => {
			expect(mockAuthenticate).toHaveBeenCalled()
		})

		it("should throw error if authentication fails", () => {
			mockAuthenticate.mockImplementation(() => {
				throw new Error("Auth failed")
			})

			expect(() => new WatsonxEmbedder("test-api-key")).toThrow("Failed to authenticate with IBM watsonx")
		})
	})

	describe("createEmbeddings", () => {
		const testModelId = "ibm/slate-125m-english-rtrvr-v2"

		it("should create embeddings for a single text", async () => {
			const testTexts = ["Hello world"]
			const mockResponse = {
				result: {
					results: [{ embedding: [0.1, 0.2, 0.3] }],
					input_token_count: 10,
				},
			}
			mockEmbedText.mockResolvedValue(mockResponse)

			const result = await embedder.createEmbeddings(testTexts)

			expect(mockEmbedText).toHaveBeenCalledWith({
				modelId: testModelId,
				inputs: testTexts,
				projectId: undefined,
				parameters: expect.objectContaining({
					truncate_input_tokens: MAX_ITEM_TOKENS,
					return_options: { input_text: true },
				}),
			})

			expect(result).toEqual({
				embeddings: [[0.1, 0.2, 0.3]],
				usage: { promptTokens: 10, totalTokens: 10 },
			})
		})

		it("should create embeddings for multiple texts", async () => {
			const testTexts = ["Hello world", "Another text"]

			mockEmbedText
				.mockResolvedValueOnce({
					result: {
						results: [{ embedding: [0.1, 0.2, 0.3] }],
						input_token_count: 10,
					},
				})
				.mockResolvedValueOnce({
					result: {
						results: [{ embedding: [0.4, 0.5, 0.6] }],
						input_token_count: 10,
					},
				})

			const result = await embedder.createEmbeddings(testTexts)

			expect(mockEmbedText).toHaveBeenCalledTimes(2)
			expect(result).toEqual({
				embeddings: [
					[0.1, 0.2, 0.3],
					[0.4, 0.5, 0.6],
				],
				usage: { promptTokens: 20, totalTokens: 20 },
			})
		})

		it("should use custom model when provided", async () => {
			const testTexts = ["Hello world"]
			const customModel = "custom-model-id"
			const mockResponse = {
				result: {
					results: [{ embedding: [0.1, 0.2, 0.3] }],
					input_token_count: 10,
				},
			}
			mockEmbedText.mockResolvedValue(mockResponse)

			await embedder.createEmbeddings(testTexts, customModel)

			expect(mockEmbedText).toHaveBeenCalledWith(
				expect.objectContaining({
					modelId: customModel,
				}),
			)
		})

		it("should handle empty text with empty embedding", async () => {
			const testTexts = [""]

			const result = await embedder.createEmbeddings(testTexts)

			expect(mockEmbedText).not.toHaveBeenCalled()
			expect(result).toEqual({
				embeddings: [[]],
				usage: { promptTokens: 0, totalTokens: 0 },
			})
		})

		it("should warn and skip texts exceeding maximum token limit", async () => {
			// Create a text that exceeds MAX_ITEM_TOKENS (4 characters ≈ 1 token)
			const oversizedText = "a".repeat(MAX_ITEM_TOKENS * 4 + 100)
			const normalText = "normal text"
			const testTexts = [normalText, oversizedText, "another normal"]

			mockEmbedText
				.mockResolvedValueOnce({
					result: {
						results: [{ embedding: [0.1, 0.2, 0.3] }],
						input_token_count: 5,
					},
				})
				.mockResolvedValueOnce({
					result: {
						results: [{ embedding: [0.4, 0.5, 0.6] }],
						input_token_count: 5,
					},
				})

			const result = await embedder.createEmbeddings(testTexts)

			// Verify warning was logged
			expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("exceeds maximum token limit"))

			// Verify only normal texts were processed
			expect(mockEmbedText).toHaveBeenCalledTimes(2)
			expect(result.embeddings).toEqual([[0.1, 0.2, 0.3], [], [0.4, 0.5, 0.6]])
		})

		it("should retry on API errors", async () => {
			const testTexts = ["Hello world"]
			const apiError = new Error("API error")

			mockEmbedText
				.mockRejectedValueOnce(apiError)
				.mockRejectedValueOnce(apiError)
				.mockResolvedValueOnce({
					result: {
						results: [{ embedding: [0.1, 0.2, 0.3] }],
						input_token_count: 10,
					},
				})

			// Use fake timers to control setTimeout
			vitest.useFakeTimers()

			const resultPromise = embedder.createEmbeddings(testTexts)

			// Fast-forward through the delays
			await vitest.advanceTimersByTimeAsync(1000) // First retry delay
			await vitest.advanceTimersByTimeAsync(2000) // Second retry delay

			const result = await resultPromise

			// Restore real timers
			vitest.useRealTimers()

			expect(mockEmbedText).toHaveBeenCalledTimes(3)
			expect(result).toEqual({
				embeddings: [[0.1, 0.2, 0.3]],
				usage: { promptTokens: 10, totalTokens: 10 },
			})
		})

		it("should handle API errors after max retries", async () => {
			const testTexts = ["Hello world"]
			const apiError = new Error("API error")

			mockEmbedText.mockRejectedValue(apiError)

			// Use fake timers to control setTimeout
			vitest.useFakeTimers()

			const resultPromise = embedder.createEmbeddings(testTexts)

			// Fast-forward through all retry delays
			await vitest.advanceTimersByTimeAsync(1000) // First retry delay
			await vitest.advanceTimersByTimeAsync(2000) // Second retry delay
			await vitest.advanceTimersByTimeAsync(4000) // Third retry delay

			// Restore real timers
			vitest.useRealTimers()

			const result = await resultPromise

			expect(mockEmbedText).toHaveBeenCalledTimes(3)
			expect(console.error).toHaveBeenCalledWith(
				"Failed to embed text at index 0 after 3 attempts:",
				expect.any(Error),
			)
			expect(result.embeddings).toEqual([[]])
		})
	})

	describe("validateConfiguration", () => {
		it("should validate successfully with valid configuration", async () => {
			const mockResponse = {
				result: {
					results: [{ embedding: [0.1, 0.2, 0.3] }],
					input_token_count: 2,
				},
			}
			mockEmbedText.mockResolvedValue(mockResponse)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()
			expect(mockEmbedText).toHaveBeenCalledWith({
				modelId: "ibm/slate-125m-english-rtrvr-v2",
				inputs: ["test"],
				projectId: undefined,
				parameters: expect.objectContaining({
					truncate_input_tokens: MAX_ITEM_TOKENS,
					return_options: { input_text: true },
				}),
			})
		})

		it("should fail validation with invalid response format", async () => {
			const invalidResponse = {
				result: {
					// Missing results array
				},
			}
			mockEmbedText.mockResolvedValue(invalidResponse)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("embeddings:validation.invalidResponse")
		})

		it("should fail validation with authentication error", async () => {
			const authError = new Error("Unauthorized")
			authError.message = "401 unauthorized"
			mockEmbedText.mockRejectedValue(authError)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toContain("embeddings:validation.invalidApiKey")
		})

		it("should fail validation with endpoint not found error", async () => {
			const notFoundError = new Error("Not found")
			notFoundError.message = "404 not found"
			mockEmbedText.mockRejectedValue(notFoundError)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toContain("embeddings:validation.endpointNotFound")
		})

		it("should fail validation with connection timeout", async () => {
			const timeoutError = new Error("Connection timeout")
			timeoutError.message = "ECONNREFUSED"
			mockEmbedText.mockRejectedValue(timeoutError)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toContain("embeddings:validation.connectionTimeout")
		})

		it("should fail validation with project ID error", async () => {
			const projectError = new Error("Invalid project")
			projectError.message = "project not found"
			mockEmbedText.mockRejectedValue(projectError)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toContain("embeddings:validation.endpointNotFound")
		})

		it("should fail validation with model ID error", async () => {
			const modelError = new Error("Invalid model")
			modelError.message = "model not found"
			mockEmbedText.mockRejectedValue(modelError)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toContain("embeddings:validation.endpointNotFound")
		})

		it("should fail validation with unknown error", async () => {
			const unknownError = new Error("Unknown error")
			mockEmbedText.mockRejectedValue(unknownError)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toContain("embeddings:validation.unknownError")
		})
	})

	describe("getAvailableModels", () => {
		it("should return known models when API call fails", async () => {
			mockListFoundationModelSpecs.mockRejectedValue(new Error("API error"))

			const result = await embedder.getAvailableModels()

			expect(result).toEqual({
				"ibm/slate-125m-english-rtrvr-v2": { dimension: 768 },
			})
		})

		it("should return models from API response", async () => {
			mockListFoundationModelSpecs.mockResolvedValue({
				result: {
					models: [
						{
							id: "ibm/slate-125m-english-rtrvr-v2",
							dimension: 768,
							description: "Embedding model for retrieval",
						},
					],
				},
			})

			const result = await embedder.getAvailableModels()

			expect(result).toEqual(
				expect.objectContaining({
					"ibm/slate-125m-english-rtrvr-v2": { dimension: 768 },
				}),
			)
		})

		it("should handle alternative API response formats", async () => {
			mockListFoundationModelSpecs.mockResolvedValue({
				result: {
					resources: [
						{
							name: "ibm/slate-125m-english-rtrvr-v2",
							vector_size: 1536,
							description: "Embedding model for retrieval",
						},
					],
				},
			})

			const result = await embedder.getAvailableModels()

			expect(result).toEqual(
				expect.objectContaining({
					"ibm/slate-125m-english-rtrvr-v2": { dimension: 768 },
				}),
			)
		})

		it("should handle foundation_models response format", async () => {
			mockListFoundationModelSpecs.mockResolvedValue({
				result: {
					foundation_models: [
						{
							model_id: "ibm/slate-125m-english-rtrvr-v2",
							dimension: 768,
							description: "Embedding model for retrieval",
						},
					],
				},
			})

			const result = await embedder.getAvailableModels()

			expect(result).toEqual(
				expect.objectContaining({
					"ibm/slate-125m-english-rtrvr-v2": { dimension: 768 },
				}),
			)
		})

		it("should handle empty API response", async () => {
			mockListFoundationModelSpecs.mockResolvedValue({
				result: {},
			})

			const result = await embedder.getAvailableModels()

			expect(result).toEqual(
				expect.objectContaining({
					"ibm/slate-125m-english-rtrvr-v2": { dimension: 768 },
				}),
			)
		})
	})

	describe("embedderInfo", () => {
		it("should return correct embedder info", () => {
			expect(embedder.embedderInfo).toEqual({
				name: "watsonx",
			})
		})
	})
})

// Made with Bob
