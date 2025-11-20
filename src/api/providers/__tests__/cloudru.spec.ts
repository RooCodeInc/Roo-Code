// npx vitest run api/providers/__tests__/cloudru.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { CloudRuHandler } from "../cloudru"

// Create mock functions
const mockCreate = vi.fn()

// Mock OpenAI module
vi.mock("openai", () => ({
	default: vi.fn(() => ({
		chat: {
			completions: {
				create: mockCreate,
			},
		},
	})),
}))

describe("CloudRuHandler", () => {
	let handler: CloudRuHandler

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Constructor", () => {
		it("should create handler with cloudRuApiKey", () => {
			expect(() => {
				handler = new CloudRuHandler({
					cloudRuApiKey: "test-cloudru-api-key",
				})
			}).not.toThrow()
		})

		it("should create handler with generic apiKey as fallback", () => {
			expect(() => {
				handler = new CloudRuHandler({
					apiKey: "test-api-key",
				})
			}).not.toThrow()
		})

		it("should throw error when no API key is provided", () => {
			expect(() => {
				handler = new CloudRuHandler({})
			}).toThrow("Cloud.ru API key is required")
		})

		it("should use custom base URL when provided", () => {
			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
				cloudRuBaseUrl: "https://custom.cloudru.api/v1",
			})

			// The base URL is passed to the parent class
			expect(handler).toBeDefined()
		})

		it("should use default base URL when not provided", () => {
			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
			})

			// The default URL is used
			expect(handler).toBeDefined()
		})
	})

	describe("Model selection", () => {
		it("should use default model when apiModelId is not provided", () => {
			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
			})

			const model = handler.getModel()
			expect(model.id).toBe("GigaChat-Max")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(32768)
		})

		it("should use specified model when apiModelId is provided", () => {
			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
				apiModelId: "GigaChat-Pro",
			})

			const model = handler.getModel()
			expect(model.id).toBe("GigaChat-Pro")
			expect(model.info).toBeDefined()
		})

		it("should fallback to default model for invalid apiModelId", () => {
			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
				apiModelId: "invalid-model",
			})

			const model = handler.getModel()
			expect(model.id).toBe("GigaChat-Max")
		})

		it("should support Qwen models", () => {
			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
				apiModelId: "Qwen3-Coder-480B-A35B-Instruct",
			})

			const model = handler.getModel()
			expect(model.id).toBe("Qwen3-Coder-480B-A35B-Instruct")
			expect(model.info.description).toContain("Qwen 3 Coder")
		})
	})

	describe("Message creation", () => {
		it("should create message stream with correct parameters", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							return { done: true }
						},
					}),
				}
			})

			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
			})

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const messageGenerator = handler.createMessage(systemPrompt, messages)
			await messageGenerator.next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "GigaChat-Max",
					temperature: 0.7,
					messages: expect.arrayContaining([{ role: "system", content: systemPrompt }]),
					stream: true,
					stream_options: { include_usage: true },
				}),
				undefined,
			)
		})

		it("should handle streaming responses", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						next: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [{ delta: { content: "Hello from " } }],
								},
							})
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [{ delta: { content: "Cloud.ru!" } }],
								},
							})
							.mockResolvedValueOnce({ done: true }),
					}),
				}
			})

			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
			})

			const stream = handler.createMessage("system", [])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "text", text: "Hello from " },
				{ type: "text", text: "Cloud.ru!" },
			])
		})

		it("should handle usage data in stream", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						next: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [{ delta: { content: "Response" } }],
									usage: { prompt_tokens: 10, completion_tokens: 5 },
								},
							})
							.mockResolvedValueOnce({ done: true }),
					}),
				}
			})

			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
			})

			const stream = handler.createMessage("system", [])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toContainEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
			})
		})
	})

	describe("Prompt completion", () => {
		it("should complete prompt successfully", async () => {
			mockCreate.mockResolvedValueOnce({
				choices: [
					{
						message: {
							content: "Completed response from Cloud.ru",
						},
					},
				],
			})

			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Completed response from Cloud.ru")
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "GigaChat-Max",
					messages: [{ role: "user", content: "Test prompt" }],
				}),
			)
		})

		it("should handle empty response", async () => {
			mockCreate.mockResolvedValueOnce({
				choices: [
					{
						message: {
							content: null,
						},
					},
				],
			})

			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("")
		})
	})

	describe("Temperature configuration", () => {
		it("should use custom temperature when provided", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							return { done: true }
						},
					}),
				}
			})

			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
				modelTemperature: 0.3,
			})

			const messageGenerator = handler.createMessage("system", [])
			await messageGenerator.next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.3,
				}),
				undefined,
			)
		})

		it("should use default temperature when not provided", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						async next() {
							return { done: true }
						},
					}),
				}
			})

			handler = new CloudRuHandler({
				cloudRuApiKey: "test-key",
			})

			const messageGenerator = handler.createMessage("system", [])
			await messageGenerator.next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.7,
				}),
				undefined,
			)
		})
	})
})
