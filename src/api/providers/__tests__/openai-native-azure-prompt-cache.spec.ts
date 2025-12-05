// npx vitest run api/providers/__tests__/openai-native-azure-prompt-cache.spec.ts

import { OpenAiNativeHandler } from "../openai-native"
import { ApiHandlerOptions } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"

// Mock the OpenAI SDK
const mockResponsesCreate = vitest.fn()

vitest.mock("openai", () => ({
	__esModule: true,
	default: vitest.fn().mockImplementation(() => ({
		responses: {
			create: mockResponsesCreate.mockImplementation(async (requestBody) => {
				// Return a mock async iterable for streaming
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							type: "response.text.delta",
							delta: "Test response",
						}
						yield {
							type: "response.done",
							response: {
								usage: {
									input_tokens: 100,
									output_tokens: 50,
								},
							},
						}
					},
				}
			}),
		},
	})),
}))

describe("OpenAiNativeHandler - Azure OpenAI Prompt Caching", () => {
	let handler: OpenAiNativeHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockResponsesCreate.mockClear()
	})

	describe("Azure OpenAI with GPT-5.1 models", () => {
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

		it("should NOT include prompt_cache_retention when using Azure OpenAI with GPT-5.1", async () => {
			mockOptions = {
				openAiNativeApiKey: "test-api-key",
				apiModelId: "gpt-5.1",
				openAiNativeBaseUrl: "https://myinstance.openai.azure.com",
			}
			handler = new OpenAiNativeHandler(mockOptions)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockResponsesCreate).toHaveBeenCalled()
			const callArgs = mockResponsesCreate.mock.calls[0][0]

			// Should NOT have prompt_cache_retention because it's Azure
			expect(callArgs).not.toHaveProperty("prompt_cache_retention")
		})

		it("should NOT include prompt_cache_retention when using Azure OpenAI with GPT-5.1-Codex", async () => {
			mockOptions = {
				openAiNativeApiKey: "test-api-key",
				apiModelId: "gpt-5.1-codex",
				openAiNativeBaseUrl: "https://myinstance.openai.azure.com/openai",
			}
			handler = new OpenAiNativeHandler(mockOptions)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockResponsesCreate).toHaveBeenCalled()
			const callArgs = mockResponsesCreate.mock.calls[0][0]

			// Should NOT have prompt_cache_retention because it's Azure
			expect(callArgs).not.toHaveProperty("prompt_cache_retention")
		})

		it("should NOT include prompt_cache_retention when Azure is detected via URL pattern", async () => {
			mockOptions = {
				openAiNativeApiKey: "test-api-key",
				apiModelId: "gpt-5.1",
				openAiNativeBaseUrl: "https://something.azure.com/openai",
			}
			handler = new OpenAiNativeHandler(mockOptions)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockResponsesCreate).toHaveBeenCalled()
			const callArgs = mockResponsesCreate.mock.calls[0][0]

			// Should NOT have prompt_cache_retention because Azure is detected
			expect(callArgs).not.toHaveProperty("prompt_cache_retention")
		})

		it("SHOULD include prompt_cache_retention=24h when NOT using Azure OpenAI with GPT-5.1", async () => {
			mockOptions = {
				openAiNativeApiKey: "test-api-key",
				apiModelId: "gpt-5.1",
				openAiNativeBaseUrl: "https://api.openai.com",
			}
			handler = new OpenAiNativeHandler(mockOptions)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockResponsesCreate).toHaveBeenCalled()
			const callArgs = mockResponsesCreate.mock.calls[0][0]

			// SHOULD have prompt_cache_retention=24h when not Azure
			expect(callArgs.prompt_cache_retention).toBe("24h")
		})

		it("SHOULD include prompt_cache_retention=24h when NOT using Azure OpenAI with GPT-5.1-Codex", async () => {
			mockOptions = {
				openAiNativeApiKey: "test-api-key",
				apiModelId: "gpt-5.1-codex",
				openAiNativeBaseUrl: "https://api.openai.com",
			}
			handler = new OpenAiNativeHandler(mockOptions)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockResponsesCreate).toHaveBeenCalled()
			const callArgs = mockResponsesCreate.mock.calls[0][0]

			// SHOULD have prompt_cache_retention=24h when not Azure
			expect(callArgs.prompt_cache_retention).toBe("24h")
		})

		it("should NOT include prompt_cache_retention for non-GPT-5.1 models regardless of Azure", async () => {
			mockOptions = {
				openAiNativeApiKey: "test-api-key",
				apiModelId: "gpt-5",
				openAiNativeBaseUrl: "https://api.openai.com",
			}
			handler = new OpenAiNativeHandler(mockOptions)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockResponsesCreate).toHaveBeenCalled()
			const callArgs = mockResponsesCreate.mock.calls[0][0]

			// Should NOT have prompt_cache_retention for non-GPT-5.1 models
			expect(callArgs).not.toHaveProperty("prompt_cache_retention")
		})

		it("should handle completePrompt without prompt_cache_retention when using Azure", async () => {
			mockOptions = {
				openAiNativeApiKey: "test-api-key",
				apiModelId: "gpt-5.1",
				openAiNativeBaseUrl: "https://myinstance.openai.azure.com",
			}
			handler = new OpenAiNativeHandler(mockOptions)

			// Mock non-streaming response for completePrompt
			mockResponsesCreate.mockResolvedValueOnce({
				output: [
					{
						type: "message",
						content: [
							{
								type: "output_text",
								text: "Test completion response",
							},
						],
					},
				],
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Test completion response")
			expect(mockResponsesCreate).toHaveBeenCalled()
			const callArgs = mockResponsesCreate.mock.calls[0][0]

			// Should NOT have prompt_cache_retention because it's Azure
			expect(callArgs).not.toHaveProperty("prompt_cache_retention")
		})

		it("should handle completePrompt with prompt_cache_retention=24h when NOT using Azure", async () => {
			mockOptions = {
				openAiNativeApiKey: "test-api-key",
				apiModelId: "gpt-5.1",
				openAiNativeBaseUrl: "https://api.openai.com",
			}
			handler = new OpenAiNativeHandler(mockOptions)

			// Mock non-streaming response for completePrompt
			mockResponsesCreate.mockResolvedValueOnce({
				output: [
					{
						type: "message",
						content: [
							{
								type: "output_text",
								text: "Test completion response",
							},
						],
					},
				],
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Test completion response")
			expect(mockResponsesCreate).toHaveBeenCalled()
			const callArgs = mockResponsesCreate.mock.calls[0][0]

			// SHOULD have prompt_cache_retention=24h when not Azure
			expect(callArgs.prompt_cache_retention).toBe("24h")
		})
	})
})
