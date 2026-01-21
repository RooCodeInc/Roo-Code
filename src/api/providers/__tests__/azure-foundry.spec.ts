// npx vitest run api/providers/__tests__/azure-foundry.spec.ts

import { AzureFoundryHandler } from "../azure-foundry"
import { ApiHandlerOptions } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

const mockCreate = vitest.fn()

vitest.mock("openai", () => {
	const mockConstructor = vitest.fn()
	return {
		__esModule: true,
		default: mockConstructor.mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate.mockImplementation(async (options) => {
						if (!options.stream) {
							return {
								id: "test-completion",
								choices: [
									{
										message: { role: "assistant", content: "Test response", refusal: null },
										finish_reason: "stop",
										index: 0,
									},
								],
								usage: {
									prompt_tokens: 10,
									completion_tokens: 5,
									total_tokens: 15,
								},
							}
						}

						return {
							[Symbol.asyncIterator]: async function* () {
								yield {
									choices: [
										{
											delta: { content: "Test response" },
											index: 0,
										},
									],
									usage: null,
								}
								yield {
									choices: [
										{
											delta: {},
											index: 0,
										},
									],
									usage: {
										prompt_tokens: 10,
										completion_tokens: 5,
										total_tokens: 15,
									},
								}
							},
						}
					}),
				},
			},
		})),
	}
})

describe("AzureFoundryHandler", () => {
	let handler: AzureFoundryHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			azureFoundryBaseUrl:
				"https://my-endpoint.openai.azure.com/openai/deployments/gpt-5.2-codex/chat/completions?api-version=2024-02-15-preview",
			azureFoundryApiKey: "test-api-key",
			azureFoundryModelId: "gpt-5.2-codex",
		}
		handler = new AzureFoundryHandler(mockOptions)
		mockCreate.mockClear()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(AzureFoundryHandler)
			expect(handler.getModel().id).toBe(mockOptions.azureFoundryModelId)
		})

		it("should handle undefined base URL gracefully", () => {
			const handlerWithoutUrl = new AzureFoundryHandler({
				...mockOptions,
				azureFoundryBaseUrl: undefined,
			})
			expect(handlerWithoutUrl).toBeInstanceOf(AzureFoundryHandler)
		})

		it("should handle undefined API key gracefully", () => {
			const handlerWithoutKey = new AzureFoundryHandler({
				...mockOptions,
				azureFoundryApiKey: undefined,
			})
			expect(handlerWithoutKey).toBeInstanceOf(AzureFoundryHandler)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text" as const,
						text: "Hello!",
					},
				],
			},
		]

		it("should handle streaming responses", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
		})

		it("should include usage information", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((chunk) => chunk.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.inputTokens).toBe(10)
			expect(usageChunk?.outputTokens).toBe(5)
		})

		it("should NOT include prompt_cache_retention parameter (Azure Foundry incompatibility)", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("prompt_cache_retention")
		})

		it("should include stream_options with include_usage", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					stream: true,
					stream_options: { include_usage: true },
				}),
			)
		})

		it("should use provided model ID", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gpt-5.2-codex",
				}),
			)
		})

		it("should handle tool calls in streaming responses", async () => {
			mockCreate.mockImplementation(async (options) => {
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [
								{
									delta: {
										tool_calls: [
											{
												index: 0,
												id: "call_1",
												function: { name: "test_tool", arguments: "" },
											},
										],
									},
									finish_reason: null,
								},
							],
						}
						yield {
							choices: [
								{
									delta: {
										tool_calls: [{ index: 0, function: { arguments: '{"arg":' } }],
									},
									finish_reason: null,
								},
							],
						}
						yield {
							choices: [
								{
									delta: {
										tool_calls: [{ index: 0, function: { arguments: '"value"}' } }],
									},
									finish_reason: "tool_calls",
								},
							],
						}
					},
				}
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolCallPartialChunks = chunks.filter((chunk) => chunk.type === "tool_call_partial")
			expect(toolCallPartialChunks).toHaveLength(3)
			expect(toolCallPartialChunks[0]).toEqual({
				type: "tool_call_partial",
				index: 0,
				id: "call_1",
				name: "test_tool",
				arguments: "",
			})

			const toolCallEndChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")
			expect(toolCallEndChunks).toHaveLength(1)
		})

		it("should include max_tokens when includeMaxTokens is true", async () => {
			const optionsWithMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: true,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithMaxTokens = new AzureFoundryHandler(optionsWithMaxTokens)
			const stream = handlerWithMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.max_completion_tokens).toBe(4096)
		})

		it("should not include max_tokens when includeMaxTokens is false", async () => {
			const optionsWithoutMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: false,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithoutMaxTokens = new AzureFoundryHandler(optionsWithoutMaxTokens)
			const stream = handlerWithoutMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.max_completion_tokens).toBeUndefined()
		})

		it("should use user-configured modelMaxTokens instead of model default", async () => {
			const optionsWithUserMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: true,
				modelMaxTokens: 32000,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithUserMaxTokens = new AzureFoundryHandler(optionsWithUserMaxTokens)
			const stream = handlerWithUserMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.max_completion_tokens).toBe(32000)
		})
	})

	describe("error handling", () => {
		const testMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text" as const,
						text: "Hello",
					},
				],
			},
		]

		it("should handle API errors", async () => {
			mockCreate.mockRejectedValueOnce(new Error("API Error"))

			const stream = handler.createMessage("system prompt", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow("API Error")
		})

		it("should handle rate limiting", async () => {
			const rateLimitError = new Error("Rate limit exceeded")
			rateLimitError.name = "Error"
			;(rateLimitError as any).status = 429
			mockCreate.mockRejectedValueOnce(rateLimitError)

			const stream = handler.createMessage("system prompt", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow("Rate limit exceeded")
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockCreate).toHaveBeenCalledWith({
				model: mockOptions.azureFoundryModelId,
				messages: [{ role: "user", content: "Test prompt" }],
			})
		})

		it("should handle API errors", async () => {
			mockCreate.mockRejectedValueOnce(new Error("API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				"Azure Foundry completion error: API Error",
			)
		})

		it("should handle empty response", async () => {
			mockCreate.mockImplementationOnce(() => ({
				choices: [{ message: { content: "" } }],
			}))
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})

	describe("getModel", () => {
		it("should return model info with sane defaults", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.azureFoundryModelId)
			expect(model.info).toBeDefined()
			expect(model.info.contextWindow).toBe(128_000)
			expect(model.info.supportsImages).toBe(true)
		})

		it("should handle undefined model ID", () => {
			const handlerWithoutModel = new AzureFoundryHandler({
				...mockOptions,
				azureFoundryModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe("")
			expect(model.info).toBeDefined()
		})

		it("should use custom model info when provided", () => {
			const customModelInfo = {
				contextWindow: 200_000,
				maxTokens: 8192,
				supportsPromptCache: true,
				supportsImages: false,
			}
			const handlerWithCustomInfo = new AzureFoundryHandler({
				...mockOptions,
				openAiCustomModelInfo: customModelInfo,
			})
			const model = handlerWithCustomInfo.getModel()
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.maxTokens).toBe(8192)
		})
	})

	describe("Azure Foundry specific behavior", () => {
		it("should use full Azure Foundry URL with API version", async () => {
			// This verifies the handler correctly initializes with Azure Foundry's URL pattern
			const azureFoundryUrl =
				"https://my-resource.openai.azure.com/openai/deployments/my-model/chat/completions?api-version=2024-06-01-preview"
			const handlerWithFullUrl = new AzureFoundryHandler({
				...mockOptions,
				azureFoundryBaseUrl: azureFoundryUrl,
			})

			expect(handlerWithFullUrl).toBeInstanceOf(AzureFoundryHandler)

			// The handler should be able to create messages
			const stream = handlerWithFullUrl.createMessage("System prompt", [{ role: "user", content: "Test" }])
			for await (const _chunk of stream) {
				// Consume the stream
			}

			// Verify the OpenAI client was called (constructor called with baseURL)
			expect(vi.mocked(OpenAI)).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: azureFoundryUrl,
					apiKey: mockOptions.azureFoundryApiKey,
				}),
			)
		})

		it("should support different API versions in URL", () => {
			const urls = [
				"https://my-endpoint.openai.azure.com/openai/deployments/gpt-5.2/chat/completions?api-version=2024-02-15-preview",
				"https://my-endpoint.openai.azure.com/openai/deployments/gpt-5.2/chat/completions?api-version=2024-06-01-preview",
				"https://my-endpoint.openai.azure.com/openai/deployments/gpt-5.2/chat/completions",
			]

			for (const url of urls) {
				const testHandler = new AzureFoundryHandler({
					...mockOptions,
					azureFoundryBaseUrl: url,
				})
				expect(testHandler).toBeInstanceOf(AzureFoundryHandler)
			}
		})
	})
})
