import { describe, it, expect, vi, beforeEach } from "vitest"
import OpenAI from "openai"
import { OpenAiHandler } from "../openai"
import type { ApiHandlerOptions } from "../../../shared/api"

vi.mock("openai", () => {
	const mockCreate = vi.fn()
	const MockOpenAI = vi.fn(() => ({
		chat: {
			completions: {
				create: mockCreate,
			},
		},
	}))

	// Make mock functions accessible
	;(MockOpenAI as any).mockCreate = mockCreate

	return {
		default: MockOpenAI,
		OpenAI: MockOpenAI,
	}
})

describe("MLflow Provider", () => {
	let mockCreate: any

	beforeEach(() => {
		vi.clearAllMocks()
		const OpenAIMock = vi.mocked(OpenAI)
		mockCreate = (OpenAIMock as any).mockCreate
	})

	const createHandler = (baseUrl: string, modelId: string = "test-model") => {
		const options: ApiHandlerOptions = {
			openAiBaseUrl: baseUrl,
			openAiApiKey: "test-api-key",
			openAiModelId: modelId,
			openAiStreamingEnabled: true,
		}
		return new OpenAiHandler(options)
	}

	describe("MLflow URL Detection", () => {
		it("should detect Databricks MLflow GenAI endpoint", async () => {
			const handler = createHandler("https://example.databricks.com/api/2.0/genai/llm/v1/chat")

			// Set up mock streaming response
			mockCreate.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Test response" } }],
					}
				},
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await stream.next()

			// Verify that stream_options is NOT included for MLflow
			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					stream_options: expect.anything(),
				}),
				expect.anything(),
			)
		})

		it("should detect self-hosted MLflow endpoint with /llm/v1/chat pattern", async () => {
			const handler = createHandler("https://mlflow.company.com/llm/v1/chat")

			mockCreate.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Test response" } }],
					}
				},
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await stream.next()

			// Verify that stream_options is NOT included
			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					stream_options: expect.anything(),
				}),
				expect.anything(),
			)
		})

		it("should detect Databricks endpoint with /v1/chat pattern", async () => {
			const handler = createHandler("https://workspace.cloud.databricks.com/serving-endpoints/v1/chat")

			mockCreate.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Test response" } }],
					}
				},
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await stream.next()

			// Verify that stream_options is NOT included
			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					stream_options: expect.anything(),
				}),
				expect.anything(),
			)
		})
	})

	describe("Stream Options Behavior", () => {
		it("should exclude stream_options for MLflow endpoints during streaming", async () => {
			const handler = createHandler("https://example.databricks.com/api/2.0/genai/llm/v1/chat")

			mockCreate.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Response chunk" } }],
					}
					yield {
						choices: [{ delta: {} }],
						usage: { prompt_tokens: 10, completion_tokens: 5 },
					}
				},
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			// Consume the entire stream
			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			// Verify the create call
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "test-model",
					stream: true,
					messages: expect.any(Array),
				}),
				expect.anything(),
			)

			// Ensure stream_options is NOT in the request
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("stream_options")

			// Verify we got the expected chunks
			expect(results).toContainEqual(
				expect.objectContaining({
					type: "text",
					text: "Response chunk",
				}),
			)
		})

		it("should include stream_options for non-MLflow, non-Grok endpoints", async () => {
			const handler = createHandler("https://api.openai.com/v1")

			mockCreate.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "OpenAI response" } }],
					}
				},
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await stream.next()

			// Verify that stream_options IS included for standard OpenAI
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					stream_options: { include_usage: true },
				}),
				expect.anything(),
			)
		})

		it("should exclude stream_options for Grok endpoints", async () => {
			const handler = createHandler("https://api.x.ai/v1")

			mockCreate.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Grok response" } }],
					}
				},
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await stream.next()

			// Verify that stream_options is NOT included for Grok
			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					stream_options: expect.anything(),
				}),
				expect.anything(),
			)
		})
	})

	describe("Non-streaming Requests", () => {
		it("should work with non-streaming MLflow requests", async () => {
			const options: ApiHandlerOptions = {
				openAiBaseUrl: "https://mlflow.company.com/llm/v1/chat",
				openAiApiKey: "test-api-key",
				openAiModelId: "test-model",
				openAiStreamingEnabled: false,
			}
			const handler = new OpenAiHandler(options)

			mockCreate.mockResolvedValue({
				choices: [
					{
						message: {
							content: "Non-streaming response",
						},
					},
				],
				usage: {
					prompt_tokens: 20,
					completion_tokens: 10,
				},
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			// Verify the response
			expect(results).toContainEqual(
				expect.objectContaining({
					type: "text",
					text: "Non-streaming response",
				}),
			)
			expect(results).toContainEqual(
				expect.objectContaining({
					type: "usage",
					inputTokens: 20,
					outputTokens: 10,
				}),
			)
		})
	})
})
