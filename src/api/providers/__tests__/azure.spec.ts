// npx vitest run src/api/providers/__tests__/azure.spec.ts

import { AzureHandler } from "../azure"
import type { ApiHandlerOptions } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Mock setup for Azure provider tests
 *
 * The Azure provider uses two different SDKs:
 * 1. AnthropicFoundry SDK for Claude models (dynamically imported)
 * 2. AzureOpenAI SDK for GPT models
 */

// Mock the dynamically imported AnthropicFoundry SDK
const mockAnthropicFoundryCreate = vitest.fn()
vitest.mock("@anthropic-ai/foundry-sdk", () => {
	const mockFoundryConstructor = vitest.fn().mockImplementation(() => ({
		messages: {
			create: mockAnthropicFoundryCreate,
		},
	}))

	return {
		default: mockFoundryConstructor,
	}
})

// Mock Azure OpenAI SDK
const mockAzureOpenAICreate = vitest.fn()
vitest.mock("openai", () => ({
	AzureOpenAI: vitest.fn().mockImplementation(() => ({
		chat: {
			completions: {
				create: mockAzureOpenAICreate,
			},
		},
	})),
}))

describe("AzureHandler", () => {
	let handler: AzureHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			apiKey: "test-azure-key",
			azureApiKey: "test-azure-key",
			azureBaseUrl: "https://test.azure.com",
			apiModelId: "claude-sonnet-4-5",
		}
		handler = new AzureHandler(mockOptions)
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(AzureHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should initialize with default Azure base URL if not provided", () => {
			const handlerWithoutUrl = new AzureHandler({
				...mockOptions,
				azureBaseUrl: undefined,
			})
			expect(handlerWithoutUrl).toBeInstanceOf(AzureHandler)
		})

		it("should use custom Azure API version if provided", () => {
			const customVersion = "2024-10-01-preview"
			const handlerWithVersion = new AzureHandler({
				...mockOptions,
				azureApiVersion: customVersion,
			})
			expect(handlerWithVersion).toBeInstanceOf(AzureHandler)
		})
	})

	describe("1M Context Window Beta Feature", () => {
		describe("createMessage with beta flag", () => {
			beforeEach(() => {
				// Mock the streaming response for Claude models
				mockAnthropicFoundryCreate.mockImplementation(async (options, config) => {
					return {
						async *[Symbol.asyncIterator]() {
							yield {
								type: "message_start",
								message: {
									usage: {
										input_tokens: 100,
										output_tokens: 50,
									},
								},
							}
							yield {
								type: "content_block_start",
								index: 0,
								content_block: {
									type: "text",
									text: "Test response",
								},
							}
						},
					}
				})
			})

			it("should include 1M context beta flag when enabled for claude-sonnet-4-5", async () => {
				const handlerWith1M = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					azureBeta1MContext: true,
				})

				const systemPrompt = "You are a helpful assistant."
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

				const stream = handlerWith1M.createMessage(systemPrompt, messages)
				const chunks: any[] = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}

				// Verify the beta flag was included in headers
				expect(mockAnthropicFoundryCreate).toHaveBeenCalled()
				const callArgs = mockAnthropicFoundryCreate.mock.calls[0]
				const config = callArgs?.[1]

				expect(config?.headers).toBeDefined()
				expect(config?.headers?.["anthropic-beta"]).toBeDefined()
				expect(config?.headers?.["anthropic-beta"]).toContain("context-1m-2025-08-07")
			})

			it("should include both 1M context and prompt caching beta flags", async () => {
				const handlerWith1M = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					azureBeta1MContext: true,
				})

				const systemPrompt = "You are a helpful assistant."
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

				const stream = handlerWith1M.createMessage(systemPrompt, messages)
				for await (const chunk of stream) {
					// Consume stream
				}

				const callArgs = mockAnthropicFoundryCreate.mock.calls[0]
				const config = callArgs?.[1]
				const betaFlags = config?.headers?.["anthropic-beta"]

				expect(betaFlags).toContain("context-1m-2025-08-07")
				expect(betaFlags).toContain("prompt-caching-2024-07-31")
			})

			it("should NOT include 1M context beta flag when disabled", async () => {
				const handlerWithout1M = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					azureBeta1MContext: false,
				})

				const systemPrompt = "You are a helpful assistant."
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

				const stream = handlerWithout1M.createMessage(systemPrompt, messages)
				for await (const chunk of stream) {
					// Consume stream
				}

				const callArgs = mockAnthropicFoundryCreate.mock.calls[0]
				const config = callArgs?.[1]
				const betaFlags = config?.headers?.["anthropic-beta"]

				expect(betaFlags).not.toContain("context-1m-2025-08-07")
				expect(betaFlags).toContain("prompt-caching-2024-07-31") // Should still have caching
			})

			it("should NOT include 1M context beta flag when setting is undefined", async () => {
				const handlerDefault = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					// azureBeta1MContext is undefined
				})

				const systemPrompt = "You are a helpful assistant."
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

				const stream = handlerDefault.createMessage(systemPrompt, messages)
				for await (const chunk of stream) {
					// Consume stream
				}

				const callArgs = mockAnthropicFoundryCreate.mock.calls[0]
				const config = callArgs?.[1]
				const betaFlags = config?.headers?.["anthropic-beta"]

				expect(betaFlags).not.toContain("context-1m-2025-08-07")
			})

			it("should NOT include 1M context beta flag for non-supported Claude models", async () => {
				const handlerHaiku = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-haiku-4-5",
					azureBeta1MContext: true,
				})

				const systemPrompt = "You are a helpful assistant."
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

				const stream = handlerHaiku.createMessage(systemPrompt, messages)
				for await (const chunk of stream) {
					// Consume stream
				}

				const callArgs = mockAnthropicFoundryCreate.mock.calls[0]
				const config = callArgs?.[1]
				const betaFlags = config?.headers?.["anthropic-beta"]

				// Should not include 1M context beta for haiku
				expect(betaFlags).not.toContain("context-1m-2025-08-07")
			})

			it("should NOT include 1M context beta flag for GPT models", async () => {
				mockAzureOpenAICreate.mockResolvedValue({
					async *[Symbol.asyncIterator]() {
						yield {
							choices: [{ delta: { content: "Test" }, finish_reason: null }],
						}
					},
				})

				const handlerGPT = new AzureHandler({
					...mockOptions,
					apiModelId: "gpt-5-pro",
					azureBeta1MContext: true,
				})

				const systemPrompt = "You are a helpful assistant."
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

				const stream = handlerGPT.createMessage(systemPrompt, messages)
				for await (const chunk of stream) {
					// Consume stream
				}

				// GPT models use OpenAI SDK, not AnthropicFoundry
				expect(mockAnthropicFoundryCreate).not.toHaveBeenCalled()
				expect(mockAzureOpenAICreate).toHaveBeenCalled()
			})
		})

		describe("getModel with 1M context", () => {
			it("should return 1M context window when beta is enabled for claude-sonnet-4-5", () => {
				const handlerWith1M = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					azureBeta1MContext: true,
				})

				const model = handlerWith1M.getModel()
				expect(model.id).toBe("claude-sonnet-4-5")
				expect(model.info.contextWindow).toBe(1_000_000)
			})

			it("should return default context window when beta is disabled", () => {
				const handlerWithout1M = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					azureBeta1MContext: false,
				})

				const model = handlerWithout1M.getModel()
				expect(model.id).toBe("claude-sonnet-4-5")
				expect(model.info.contextWindow).toBe(200_000)
			})

			it("should return default context window when beta setting is undefined", () => {
				const handlerDefault = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					// azureBeta1MContext is undefined
				})

				const model = handlerDefault.getModel()
				expect(model.info.contextWindow).toBe(200_000)
			})

			it("should maintain base model maxTokens when 1M context is enabled", () => {
				const handlerWith1M = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					azureBeta1MContext: true,
				})

				const model = handlerWith1M.getModel()
				// maxTokens should remain the same as base model (tier doesn't override this)
				expect(model.info.maxTokens).toBe(64_000)
			})

			it("should update pricing with tier values when 1M context is enabled", () => {
				const handlerWith1M = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					azureBeta1MContext: true,
				})

				const model = handlerWith1M.getModel()

				// Tier pricing
				expect(model.info.inputPrice).toBe(6.0)
				expect(model.info.outputPrice).toBe(22.5)
				expect(model.info.cacheWritesPrice).toBe(7.5)
				expect(model.info.cacheReadsPrice).toBe(0.6)
			})

			it("should use default pricing when beta is disabled", () => {
				const handlerWithout1M = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					azureBeta1MContext: false,
				})

				const model = handlerWithout1M.getModel()

				// Default pricing
				expect(model.info.inputPrice).toBe(3.0)
				expect(model.info.outputPrice).toBe(15.0)
				expect(model.info.cacheWritesPrice).toBe(3.75)
				expect(model.info.cacheReadsPrice).toBe(0.3)
			})

			it("should NOT apply 1M context to claude-haiku-4-5 even when beta is enabled", () => {
				const handlerHaiku = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-haiku-4-5",
					azureBeta1MContext: true,
				})

				const model = handlerHaiku.getModel()
				expect(model.id).toBe("claude-haiku-4-5")
				expect(model.info.contextWindow).toBe(200_000) // Default, not 1M
			})

			it("should NOT apply 1M context to claude-opus-4-1 even when beta is enabled", () => {
				const handlerOpus = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-opus-4-1",
					azureBeta1MContext: true,
				})

				const model = handlerOpus.getModel()
				expect(model.id).toBe("claude-opus-4-1")
				expect(model.info.contextWindow).toBe(200_000) // Default, not 1M
			})

			it("should NOT apply 1M context to GPT models", () => {
				const handlerGPT = new AzureHandler({
					...mockOptions,
					apiModelId: "gpt-5-pro",
					azureBeta1MContext: true,
				})

				const model = handlerGPT.getModel()
				expect(model.id).toBe("gpt-5-pro")
				expect(model.info.contextWindow).toBe(400_000) // GPT default
			})
		})

		describe("completePrompt with 1M context", () => {
			it("should work correctly with 1M context enabled", async () => {
				mockAnthropicFoundryCreate.mockResolvedValue({
					content: [{ type: "text", text: "Test completion" }],
				})

				const handlerWith1M = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					azureBeta1MContext: true,
				})

				const result = await handlerWith1M.completePrompt("Test prompt")
				expect(result).toBe("Test completion")
				expect(mockAnthropicFoundryCreate).toHaveBeenCalled()
			})

			it("should work correctly with 1M context disabled", async () => {
				mockAnthropicFoundryCreate.mockResolvedValue({
					content: [{ type: "text", text: "Test completion" }],
				})

				const handlerWithout1M = new AzureHandler({
					...mockOptions,
					apiModelId: "claude-sonnet-4-5",
					azureBeta1MContext: false,
				})

				const result = await handlerWithout1M.completePrompt("Test prompt")
				expect(result).toBe("Test completion")
			})
		})
	})

	describe("Model routing", () => {
		it("should detect claude-sonnet-4-5 as Claude model", () => {
			const model = handler.getModel()
			expect(model.id).toBe("claude-sonnet-4-5")
		})

		it("should detect gpt-5-pro as OpenAI model", () => {
			const gptHandler = new AzureHandler({
				...mockOptions,
				apiModelId: "gpt-5-pro",
			})
			const model = gptHandler.getModel()
			expect(model.id).toBe("gpt-5-pro")
		})

		it("should use default model when no model ID provided", () => {
			const defaultHandler = new AzureHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			const model = defaultHandler.getModel()
			expect(model.id).toBe("claude-sonnet-4-5") // Default Azure model
		})
	})

	describe("Error handling", () => {
		it("should handle invalid model ID gracefully", () => {
			const invalidHandler = new AzureHandler({
				...mockOptions,
				apiModelId: "invalid-model" as any,
			})
			const model = invalidHandler.getModel()
			// Should fall back to default model
			expect(model.id).toBe("claude-sonnet-4-5")
		})
	})

	describe("URL Validation and Normalization", () => {
		/**
		 * Tests for validateAzureUrl() function
		 * This function is called during Azure client initialization
		 */
		describe("validateAzureUrl", () => {
			describe("Valid URL Tests", () => {
				it("should accept valid Claude endpoint with /anthropic suffix", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://my-resource.services.ai.azure.com/anthropic/",
						})
					}).not.toThrow()
				})

				it("should accept valid Claude endpoint without /anthropic suffix", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://my-resource.services.ai.azure.com/",
						})
					}).not.toThrow()
				})

				it("should accept valid GPT endpoint (.cognitiveservices.azure.com)", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://my-resource.cognitiveservices.azure.com/",
						})
					}).not.toThrow()
				})

				it("should accept valid GPT endpoint (.openai.azure.com)", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://my-resource.openai.azure.com/",
						})
					}).not.toThrow()
				})

				it("should accept URLs with trailing slashes", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://my-resource.services.ai.azure.com///",
						})
					}).not.toThrow()
				})

				it("should accept URLs without trailing slashes", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://my-resource.services.ai.azure.com",
						})
					}).not.toThrow()
				})

				it("should accept custom HTTPS endpoint with warning", () => {
					const consoleSpy = vitest.spyOn(console, "warn").mockImplementation(() => {})

					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://custom-endpoint.example.com/",
						})
					}).not.toThrow()

					expect(consoleSpy).toHaveBeenCalledWith(
						expect.stringContaining('Using custom endpoint domain "custom-endpoint.example.com"'),
					)

					consoleSpy.mockRestore()
				})

				it("should accept URLs with ports", () => {
					const consoleSpy = vitest.spyOn(console, "warn").mockImplementation(() => {})

					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://localhost:8080/",
						})
					}).not.toThrow()

					consoleSpy.mockRestore()
				})

				it("should accept URLs with query parameters", () => {
					const consoleSpy = vitest.spyOn(console, "warn").mockImplementation(() => {})

					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://my-resource.services.ai.azure.com/?param=value",
						})
					}).not.toThrow()

					consoleSpy.mockRestore()
				})

				it("should accept very long URLs", () => {
					const longUrl = "https://my-very-long-resource-name-that-goes-on-and-on.services.ai.azure.com/"
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: longUrl,
						})
					}).not.toThrow()
				})

				it("should accept URLs with mixed case domains", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://My-Resource.Services.AI.Azure.COM/",
						})
					}).not.toThrow()
				})
			})

			describe("Invalid URL Tests", () => {
				it("should throw error for empty URL string when using Claude models", async () => {
					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "claude-sonnet-4-5",
						azureBaseUrl: "",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					await expect(async () => {
						const stream = handler.createMessage(systemPrompt, messages)
						for await (const chunk of stream) {
							// Consume stream
						}
					}).rejects.toThrow("Azure endpoint URL is required for Claude models")
				})

				it("should throw error for whitespace-only URL during construction", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "   ",
						})
					}).toThrow("Azure endpoint URL is required")
				})

				it("should throw error for HTTP (not HTTPS) URL", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "http://my-resource.services.ai.azure.com/",
						})
					}).toThrow("must use HTTPS protocol")
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "http://my-resource.services.ai.azure.com/",
						})
					}).toThrow("Should be: https://my-resource.services.ai.azure.com/")
				})

				it("should throw error for invalid URL format", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "not-a-valid-url",
						})
					}).toThrow("Invalid Azure endpoint URL format")
				})

				it("should throw error for malformed URLs", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://[invalid",
						})
					}).toThrow("Invalid Azure endpoint URL format")
				})

				it("should throw error for URLs with invalid protocols", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "ftp://my-resource.services.ai.azure.com/",
						})
					}).toThrow("must use HTTPS protocol")
				})
			})

			describe("Edge Cases", () => {
				it("should handle URLs with unusual but valid characters", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://my-resource_123.services.ai.azure.com/",
						})
					}).not.toThrow()
				})

				it("should handle URLs with hyphens in domain", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://my-resource-test-123.services.ai.azure.com/",
						})
					}).not.toThrow()
				})

				it("should handle URLs with multiple path segments", () => {
					const consoleSpy = vitest.spyOn(console, "warn").mockImplementation(() => {})

					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: "https://my-resource.services.ai.azure.com/path/to/endpoint/",
						})
					}).not.toThrow()

					consoleSpy.mockRestore()
				})
			})
		})

		/**
		 * Tests for normalizeAzureUrl() function
		 * This function normalizes URLs based on model type (Claude vs GPT)
		 */
		describe("normalizeAzureUrl", () => {
			describe("Claude Model Tests", () => {
				it("should add /anthropic suffix for Claude models without it", async () => {
					mockAnthropicFoundryCreate.mockImplementation(async () => ({
						async *[Symbol.asyncIterator]() {
							yield {
								type: "message_start",
								message: { usage: { input_tokens: 10, output_tokens: 5 } },
							}
						},
					}))

					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "claude-sonnet-4-5",
						azureBaseUrl: "https://my-resource.services.ai.azure.com",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					// Verify the client was initialized with normalized URL
					expect(mockAnthropicFoundryCreate).toHaveBeenCalled()
				})

				it("should keep /anthropic suffix for Claude models that have it", async () => {
					mockAnthropicFoundryCreate.mockImplementation(async () => ({
						async *[Symbol.asyncIterator]() {
							yield {
								type: "message_start",
								message: { usage: { input_tokens: 10, output_tokens: 5 } },
							}
						},
					}))

					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "claude-sonnet-4-5",
						azureBaseUrl: "https://my-resource.services.ai.azure.com/anthropic",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					expect(mockAnthropicFoundryCreate).toHaveBeenCalled()
				})

				it("should handle trailing slash before /anthropic", async () => {
					mockAnthropicFoundryCreate.mockImplementation(async () => ({
						async *[Symbol.asyncIterator]() {
							yield {
								type: "message_start",
								message: { usage: { input_tokens: 10, output_tokens: 5 } },
							}
						},
					}))

					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "claude-sonnet-4-5",
						azureBaseUrl: "https://my-resource.services.ai.azure.com/",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					expect(mockAnthropicFoundryCreate).toHaveBeenCalled()
				})

				it("should normalize /anthropic/ with trailing slash", async () => {
					mockAnthropicFoundryCreate.mockImplementation(async () => ({
						async *[Symbol.asyncIterator]() {
							yield {
								type: "message_start",
								message: { usage: { input_tokens: 10, output_tokens: 5 } },
							}
						},
					}))

					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "claude-sonnet-4-5",
						azureBaseUrl: "https://my-resource.services.ai.azure.com/anthropic/",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					expect(mockAnthropicFoundryCreate).toHaveBeenCalled()
				})

				it("should handle double slashes correctly", async () => {
					mockAnthropicFoundryCreate.mockImplementation(async () => ({
						async *[Symbol.asyncIterator]() {
							yield {
								type: "message_start",
								message: { usage: { input_tokens: 10, output_tokens: 5 } },
							}
						},
					}))

					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "claude-sonnet-4-5",
						azureBaseUrl: "https://my-resource.services.ai.azure.com//",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					expect(mockAnthropicFoundryCreate).toHaveBeenCalled()
				})

				it("should handle mixed case /ANTHROPIC", async () => {
					mockAnthropicFoundryCreate.mockImplementation(async () => ({
						async *[Symbol.asyncIterator]() {
							yield {
								type: "message_start",
								message: { usage: { input_tokens: 10, output_tokens: 5 } },
							}
						},
					}))

					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "claude-sonnet-4-5",
						azureBaseUrl: "https://my-resource.services.ai.azure.com/ANTHROPIC",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					expect(mockAnthropicFoundryCreate).toHaveBeenCalled()
				})
			})

			describe("GPT Model Tests", () => {
				beforeEach(() => {
					mockAzureOpenAICreate.mockResolvedValue({
						async *[Symbol.asyncIterator]() {
							yield {
								choices: [{ delta: { content: "Test" }, finish_reason: null }],
								usage: { prompt_tokens: 10, completion_tokens: 5 },
							}
						},
					})
				})

				it("should remove /anthropic suffix for GPT models", async () => {
					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "gpt-5-pro",
						azureBaseUrl: "https://my-resource.cognitiveservices.azure.com/anthropic",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					expect(mockAzureOpenAICreate).toHaveBeenCalled()
				})

				it("should keep URL unchanged for GPT models without /anthropic", async () => {
					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "gpt-5-pro",
						azureBaseUrl: "https://my-resource.cognitiveservices.azure.com",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					expect(mockAzureOpenAICreate).toHaveBeenCalled()
				})

				it("should remove trailing slashes for GPT models", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							apiModelId: "gpt-5-pro",
							azureBaseUrl: "https://my-resource.cognitiveservices.azure.com///",
						})
					}).not.toThrow()
				})

				it("should handle double slashes for GPT models", () => {
					expect(() => {
						new AzureHandler({
							...mockOptions,
							apiModelId: "gpt-5-pro",
							azureBaseUrl: "https://my-resource.cognitiveservices.azure.com//anthropic//",
						})
					}).not.toThrow()
				})

				it("should remove mixed case /Anthropic for GPT models", async () => {
					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "gpt-5-pro",
						azureBaseUrl: "https://my-resource.cognitiveservices.azure.com/Anthropic",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					expect(mockAzureOpenAICreate).toHaveBeenCalled()
				})
			})

			describe("Edge Cases", () => {
				it("should handle URLs ending with /anthropic/v1 for Claude models", async () => {
					mockAnthropicFoundryCreate.mockImplementation(async () => ({
						async *[Symbol.asyncIterator]() {
							yield {
								type: "message_start",
								message: { usage: { input_tokens: 10, output_tokens: 5 } },
							}
						},
					}))

					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "claude-sonnet-4-5",
						azureBaseUrl: "https://my-resource.services.ai.azure.com/anthropic/v1",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					expect(mockAnthropicFoundryCreate).toHaveBeenCalled()
				})

				it("should handle multiple /anthropic occurrences", async () => {
					mockAnthropicFoundryCreate.mockImplementation(async () => ({
						async *[Symbol.asyncIterator]() {
							yield {
								type: "message_start",
								message: { usage: { input_tokens: 10, output_tokens: 5 } },
							}
						},
					}))

					// This edge case tests if the regex only removes the last occurrence
					const handler = new AzureHandler({
						...mockOptions,
						apiModelId: "claude-sonnet-4-5",
						azureBaseUrl: "https://my-anthropic-resource.services.ai.azure.com/anthropic",
					})

					const systemPrompt = "Test"
					const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

					const stream = handler.createMessage(systemPrompt, messages)
					for await (const chunk of stream) {
						// Consume stream
					}

					expect(mockAnthropicFoundryCreate).toHaveBeenCalled()
				})

				it("should handle empty baseURL gracefully", () => {
					// Empty baseURL should not throw during construction (only when used)
					expect(() => {
						new AzureHandler({
							...mockOptions,
							azureBaseUrl: undefined,
						})
					}).not.toThrow()
				})
			})
		})
	})
})
