// npx vitest run api/providers/__tests__/openai-azure-anthropic.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { OpenAiHandler } from "../openai"
import { ApiHandlerOptions } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

const mockCreate = vi.fn()
const mockConstructor = vi.fn()

vitest.mock("openai", () => {
	const MockOpenAI = vi.fn().mockImplementation(function (this: any, config: any) {
		mockConstructor(config)
		this.chat = {
			completions: {
				create: mockCreate,
			},
		}
		return this
	})

	return {
		default: MockOpenAI,
		AzureOpenAI: MockOpenAI,
	}
})

describe("OpenAiHandler - Azure Anthropic Integration", () => {
	let handler: OpenAiHandler
	let azureAnthropicOptions: ApiHandlerOptions

	beforeEach(() => {
		vi.clearAllMocks()
		azureAnthropicOptions = {
			openAiModelId: "claude-sonnet-4-5",
			openAiBaseUrl: "https://my-resource.services.ai.azure.com/anthropic/v1/messages",
			openAiApiKey: "test-azure-anthropic-key",
		}
	})

	describe("Azure Anthropic endpoint detection", () => {
		it("should correctly identify Azure Anthropic endpoints", () => {
			handler = new OpenAiHandler(azureAnthropicOptions)

			// Check that the constructor was called with x-api-key header
			expect(mockConstructor).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: azureAnthropicOptions.openAiBaseUrl,
					apiKey: "not-provided",
					defaultHeaders: expect.objectContaining({
						"x-api-key": "test-azure-anthropic-key",
					}),
				}),
			)

			// Verify Authorization header is not present
			const headers = mockConstructor.mock.calls[0][0].defaultHeaders
			expect(headers).not.toHaveProperty("Authorization")
		})

		it("should use x-api-key header for Azure Anthropic instead of Authorization", () => {
			handler = new OpenAiHandler(azureAnthropicOptions)

			const callArgs = mockConstructor.mock.calls[0][0]
			expect(callArgs.defaultHeaders["x-api-key"]).toBe("test-azure-anthropic-key")
			expect(callArgs.apiKey).toBe("not-provided")
		})

		it("should not treat Azure Anthropic as Azure AI Inference", () => {
			handler = new OpenAiHandler(azureAnthropicOptions)

			// Azure Anthropic should not have the api-version query parameter
			// which is specific to Azure AI Inference
			const callArgs = mockConstructor.mock.calls[0][0]
			expect(callArgs.defaultQuery).toBeUndefined()
		})

		it("should handle multiple Azure Anthropic URL patterns", () => {
			const anthropicUrls = [
				"https://resource1.services.ai.azure.com/anthropic/v1/messages",
				"https://my-company-resource.services.ai.azure.com/anthropic/v1/messages",
				"https://test.services.ai.azure.com/anthropic/v1/complete",
			]

			anthropicUrls.forEach((url) => {
				vi.clearAllMocks()
				const options = {
					...azureAnthropicOptions,
					openAiBaseUrl: url,
				}
				handler = new OpenAiHandler(options)

				const callArgs = mockConstructor.mock.calls[0][0]
				expect(callArgs.defaultHeaders["x-api-key"]).toBe("test-azure-anthropic-key")
				expect(callArgs.apiKey).toBe("not-provided")
			})
		})
	})

	describe("Azure AI Inference exclusion of Anthropic", () => {
		it("should treat non-Anthropic Azure endpoints as AI Inference", () => {
			const nonAnthropicOptions: ApiHandlerOptions = {
				openAiModelId: "deepseek-chat",
				openAiBaseUrl: "https://my-deepseek.services.ai.azure.com/v1/chat/completions",
				openAiApiKey: "test-key",
			}

			handler = new OpenAiHandler(nonAnthropicOptions)

			const callArgs = mockConstructor.mock.calls[0][0]
			// Should have api-version for AI Inference
			expect(callArgs.defaultQuery).toEqual({ "api-version": "2024-05-01-preview" })
			// Should use regular apiKey, not x-api-key
			expect(callArgs.apiKey).toBe("test-key")
			expect(callArgs.defaultHeaders["x-api-key"]).toBeUndefined()
		})

		it("should not treat regular OpenAI endpoints as Azure", () => {
			const regularOptions: ApiHandlerOptions = {
				openAiModelId: "gpt-4",
				openAiBaseUrl: "https://api.openai.com/v1",
				openAiApiKey: "test-openai-key",
			}

			handler = new OpenAiHandler(regularOptions)

			const callArgs = mockConstructor.mock.calls[0][0]
			expect(callArgs.defaultQuery).toBeUndefined()
			expect(callArgs.apiKey).toBe("test-openai-key")
			expect(callArgs.defaultHeaders["x-api-key"]).toBeUndefined()
		})
	})

	describe("Azure Anthropic streaming mode", () => {
		it("should not append OPENAI_AZURE_AI_INFERENCE_PATH for Azure Anthropic", async () => {
			mockCreate.mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Hello" }, finish_reason: null }],
						usage: { prompt_tokens: 10, completion_tokens: 5 },
					}
				},
			})

			handler = new OpenAiHandler({
				...azureAnthropicOptions,
				openAiStreamingEnabled: true,
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			// Verify that create was called without the path option
			expect(mockCreate).toHaveBeenCalledWith(
				expect.any(Object),
				{}, // Empty options object, no path
			)
		})
	})

	describe("Azure Anthropic non-streaming mode", () => {
		it("should not append OPENAI_AZURE_AI_INFERENCE_PATH for Azure Anthropic", async () => {
			mockCreate.mockResolvedValue({
				choices: [{ message: { content: "Response" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			})

			handler = new OpenAiHandler({
				...azureAnthropicOptions,
				openAiStreamingEnabled: false,
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			// Verify that create was called without the path option
			expect(mockCreate).toHaveBeenCalledWith(
				expect.any(Object),
				{}, // Empty options object, no path
			)
		})
	})

	describe("Azure Anthropic completePrompt", () => {
		it("should not append path for Azure Anthropic in completePrompt", async () => {
			mockCreate.mockResolvedValue({
				choices: [{ message: { content: "Completed response" } }],
			})

			handler = new OpenAiHandler(azureAnthropicOptions)
			const result = await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "claude-sonnet-4-5",
					messages: [{ role: "user", content: "Test prompt" }],
				}),
				{}, // No path option
			)

			expect(result).toBe("Completed response")
		})
	})

	describe("Azure Anthropic with custom headers", () => {
		it("should preserve custom headers while adding x-api-key", () => {
			const optionsWithHeaders: ApiHandlerOptions = {
				...azureAnthropicOptions,
				openAiHeaders: {
					"Custom-Header": "custom-value",
					"Another-Header": "another-value",
				},
			}

			handler = new OpenAiHandler(optionsWithHeaders)

			const callArgs = mockConstructor.mock.calls[0][0]
			expect(callArgs.defaultHeaders["x-api-key"]).toBe("test-azure-anthropic-key")
			expect(callArgs.defaultHeaders["Custom-Header"]).toBe("custom-value")
			expect(callArgs.defaultHeaders["Another-Header"]).toBe("another-value")
			expect(callArgs.defaultHeaders["Authorization"]).toBeUndefined()
		})

		it("should override Authorization header if present in custom headers", () => {
			const optionsWithAuth: ApiHandlerOptions = {
				...azureAnthropicOptions,
				openAiHeaders: {
					Authorization: "Bearer should-be-removed",
				},
			}

			handler = new OpenAiHandler(optionsWithAuth)

			const callArgs = mockConstructor.mock.calls[0][0]
			expect(callArgs.defaultHeaders["x-api-key"]).toBe("test-azure-anthropic-key")
			expect(callArgs.defaultHeaders["Authorization"]).toBeUndefined()
		})
	})

	describe("Edge cases", () => {
		it("should handle URLs with trailing slashes", () => {
			const optionsWithTrailingSlash: ApiHandlerOptions = {
				...azureAnthropicOptions,
				openAiBaseUrl: "https://my-resource.services.ai.azure.com/anthropic/v1/messages/",
			}

			handler = new OpenAiHandler(optionsWithTrailingSlash)

			const callArgs = mockConstructor.mock.calls[0][0]
			expect(callArgs.defaultHeaders["x-api-key"]).toBe("test-azure-anthropic-key")
		})

		it("should handle URLs with query parameters", () => {
			const optionsWithQuery: ApiHandlerOptions = {
				...azureAnthropicOptions,
				openAiBaseUrl: "https://my-resource.services.ai.azure.com/anthropic/v1/messages?api-version=2024-05-01",
			}

			handler = new OpenAiHandler(optionsWithQuery)

			const callArgs = mockConstructor.mock.calls[0][0]
			expect(callArgs.defaultHeaders["x-api-key"]).toBe("test-azure-anthropic-key")
		})

		it("should not treat non-Azure Anthropic URLs as Azure Anthropic", () => {
			const nonAzureAnthropicOptions: ApiHandlerOptions = {
				openAiModelId: "claude-3-opus",
				openAiBaseUrl: "https://api.anthropic.com/v1/messages",
				openAiApiKey: "test-key",
			}

			handler = new OpenAiHandler(nonAzureAnthropicOptions)

			const callArgs = mockConstructor.mock.calls[0][0]
			expect(callArgs.apiKey).toBe("test-key")
			expect(callArgs.defaultHeaders["x-api-key"]).toBeUndefined()
		})
	})
})
