import { describe, it, expect, vi, beforeEach } from "vitest"
import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"

import { OpenAiHandler } from "../openai"
import type { ApiHandlerOptions } from "../../../shared/api"

vi.mock("openai")

describe("OpenAI Handler - DeepSeek V3 BOS Token Handling", () => {
	let mockOpenAIClient: any
	let mockStream: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Create a mock async generator for streaming
		mockStream = (async function* () {
			yield {
				choices: [{ delta: { content: "Test response" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}
		})()

		mockOpenAIClient = {
			chat: {
				completions: {
					create: vi.fn().mockResolvedValue(mockStream),
				},
			},
		}

		vi.mocked(OpenAI).mockImplementation(() => mockOpenAIClient as any)
	})

	describe("Streaming mode", () => {
		it("should skip system message when openAiSkipSystemMessage is true for DeepSeek V3", async () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "deepseek-v3",
				openAiBaseUrl: "http://localhost:11434/v1",
				openAiStreamingEnabled: true,
				openAiSkipSystemMessage: true,
			}

			const handler = new OpenAiHandler(options)
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "user",
							content: expect.stringContaining("You are a helpful assistant"),
						}),
					]),
				}),
				expect.any(Object),
			)

			// Verify system message is not included separately
			const callArgs = mockOpenAIClient.chat.completions.create.mock.calls[0][0]
			expect(callArgs.messages.find((m: any) => m.role === "system")).toBeUndefined()
		})

		it("should include system message normally when openAiSkipSystemMessage is false", async () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "deepseek-v3",
				openAiBaseUrl: "http://localhost:11434/v1",
				openAiStreamingEnabled: true,
				openAiSkipSystemMessage: false,
			}

			const handler = new OpenAiHandler(options)
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "system",
							content: "You are a helpful assistant",
						}),
					]),
				}),
				expect.any(Object),
			)
		})

		it("should handle case when no user message exists", async () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "deepseek-v3.1",
				openAiBaseUrl: "http://localhost:11434/v1",
				openAiStreamingEnabled: true,
				openAiSkipSystemMessage: true,
			}

			const handler = new OpenAiHandler(options)
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "assistant", content: "Previous response" }]

			const stream = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			// Should create a user message with system prompt
			expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "user",
							content: "You are a helpful assistant",
						}),
					]),
				}),
				expect.any(Object),
			)
		})
	})

	describe("Non-streaming mode", () => {
		beforeEach(() => {
			mockOpenAIClient.chat.completions.create = vi.fn().mockResolvedValue({
				choices: [{ message: { content: "Test response" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			})
		})

		it("should skip system message in non-streaming mode when configured", async () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "deepseek-v3",
				openAiBaseUrl: "http://localhost:11434/v1",
				openAiStreamingEnabled: false,
				openAiSkipSystemMessage: true,
			}

			const handler = new OpenAiHandler(options)
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			const callArgs = mockOpenAIClient.chat.completions.create.mock.calls[0][0]
			// First message should be user message with merged system prompt
			expect(callArgs.messages[0]).toMatchObject({
				role: "user",
				content: expect.stringContaining("You are a helpful assistant"),
			})
			// No separate system message
			expect(callArgs.messages.find((m: any) => m.role === "system")).toBeUndefined()
		})
	})

	describe("Model detection", () => {
		it.each(["deepseek-v3", "deepseek-v3.1", "DeepSeek-V3", "DEEPSEEK-V3.1", "deepseek-chat"])(
			"should detect %s as DeepSeek model when skipSystemMessage is enabled",
			async (modelId) => {
				const options: ApiHandlerOptions = {
					openAiApiKey: "test-key",
					openAiModelId: modelId,
					openAiBaseUrl: "http://localhost:11434/v1",
					openAiStreamingEnabled: true,
					openAiSkipSystemMessage: true,
				}

				const handler = new OpenAiHandler(options)
				const systemPrompt = "System prompt"
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "User message" }]

				const stream = handler.createMessage(systemPrompt, messages)
				for await (const chunk of stream) {
					// Consume stream
				}

				const callArgs = mockOpenAIClient.chat.completions.create.mock.calls[0][0]
				// Should merge system prompt into user message
				expect(callArgs.messages[0].content).toContain("System prompt")
				expect(callArgs.messages.find((m: any) => m.role === "system")).toBeUndefined()
			},
		)

		it("should not apply skip logic to non-DeepSeek models", async () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "gpt-4",
				openAiBaseUrl: "http://localhost:11434/v1",
				openAiStreamingEnabled: true,
				openAiSkipSystemMessage: true,
			}

			const handler = new OpenAiHandler(options)
			const systemPrompt = "System prompt"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "User message" }]

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const chunk of stream) {
				// Consume stream
			}

			const callArgs = mockOpenAIClient.chat.completions.create.mock.calls[0][0]
			// Should still have system message for non-DeepSeek models
			expect(callArgs.messages[0]).toMatchObject({
				role: "system",
				content: "System prompt",
			})
		})
	})
})
