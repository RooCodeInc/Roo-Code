// npx vitest run api/providers/__tests__/openai-native.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"

import { OpenAiNativeHandler } from "../openai-native"
import type { ApiHandlerCreateMessageMetadata } from "../../index"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock OpenAI client - now everything uses Responses API
const mockResponsesCreate = vitest.fn()

vitest.mock("openai", () => {
	return {
		__esModule: true,
		default: vitest.fn().mockImplementation(() => ({
			responses: {
				create: mockResponsesCreate,
			},
		})),
	}
})

describe("OpenAiNativeHandler", () => {
	let handler: OpenAiNativeHandler
	let mockOptions: ApiHandlerOptions
	const systemPrompt = "You are a helpful assistant."
	const messages: Anthropic.Messages.MessageParam[] = [
		{
			role: "user",
			content: "Hello!",
		},
	]

	beforeEach(() => {
		mockOptions = {
			apiModelId: "gpt-4.1",
			openAiNativeApiKey: "test-api-key",
		}
		handler = new OpenAiNativeHandler(mockOptions)
		mockResponsesCreate.mockClear()
		// Clear fetch mock if it exists
		if ((global as any).fetch) {
			delete (global as any).fetch
		}
	})

	afterEach(() => {
		// Clean up fetch mock
		if ((global as any).fetch) {
			delete (global as any).fetch
		}
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(OpenAiNativeHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should initialize with empty API key", () => {
			const handlerWithoutKey = new OpenAiNativeHandler({
				apiModelId: "gpt-4.1",
				openAiNativeApiKey: "",
			})
			expect(handlerWithoutKey).toBeInstanceOf(OpenAiNativeHandler)
		})
	})

	describe("createMessage", () => {
		it("should handle streaming responses via Responses API", async () => {
			// Mock fetch for Responses API fallback
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.text.delta","delta":"Test"}\n\n'),
						)
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.text.delta","delta":" response"}\n\n'),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.done","response":{"usage":{"prompt_tokens":10,"completion_tokens":2}}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail so it falls back to fetch
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Test")
			expect(textChunks[1].text).toBe(" response")
		})

		it("should handle API errors", async () => {
			// Mock fetch to return error
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: false,
				status: 500,
				text: async () => "Internal Server Error",
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const stream = handler.createMessage(systemPrompt, messages)
			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow("OpenAI service error")
		})
	})

	describe("completePrompt", () => {
		it("should handle non-streaming completion using Responses API", async () => {
			// Mock the responses.create method to return a non-streaming response
			mockResponsesCreate.mockResolvedValue({
				output: [
					{
						type: "message",
						content: [
							{
								type: "output_text",
								text: "This is the completion response",
							},
						],
					},
				],
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("This is the completion response")
			expect(mockResponsesCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gpt-4.1",
					stream: false,
					store: false,
					input: [
						{
							role: "user",
							content: [{ type: "input_text", text: "Test prompt" }],
						},
					],
				}),
				expect.objectContaining({
					signal: expect.any(Object),
				}),
			)
		})

		it("should handle SDK errors in completePrompt", async () => {
			// Mock SDK to throw an error
			mockResponsesCreate.mockRejectedValue(new Error("API Error"))

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				"OpenAI Native completion error: API Error",
			)
		})

		it("should return empty string when no text in response", async () => {
			// Mock the responses.create method to return a response without text
			mockResponsesCreate.mockResolvedValue({
				output: [
					{
						type: "message",
						content: [],
					},
				],
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("")
		})
	})

	describe("getModel", () => {
		it("should return model info", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe(mockOptions.apiModelId)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(32768)
			expect(modelInfo.info.contextWindow).toBe(1047576)
		})

		it("should handle undefined model ID", () => {
			const handlerWithoutModel = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-api-key",
			})
			const modelInfo = handlerWithoutModel.getModel()
			expect(modelInfo.id).toBe("gpt-5.1-codex-max") // Default model
			expect(modelInfo.info).toBeDefined()
		})
	})

	describe("GPT-5 models", () => {
		it("should handle GPT-5 model with Responses API", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						// Simulate actual GPT-5 Responses API SSE stream format
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.created","response":{"id":"test","status":"in_progress"}}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"Hello"}}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":" world"}}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.done","response":{"usage":{"prompt_tokens":10,"completion_tokens":2}}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail so it uses fetch
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify Responses API is called with correct parameters
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer test-api-key",
						Accept: "text/event-stream",
					}),
					body: expect.any(String),
				}),
			)
			const body1 = (mockFetch.mock.calls[0][1] as any).body as string
			const parsedBody = JSON.parse(body1)
			expect(parsedBody.model).toBe("gpt-5.1")
			expect(parsedBody.instructions).toBe("You are a helpful assistant.")
			// Now using structured format with content arrays (no system prompt in input; it's provided via `instructions`)
			expect(parsedBody.input).toEqual([
				{
					role: "user",
					content: [{ type: "input_text", text: "Hello!" }],
				},
			])
			expect(parsedBody.reasoning?.effort).toBe("medium")
			expect(parsedBody.reasoning?.summary).toBe("auto")
			expect(parsedBody.text?.verbosity).toBe("medium")
			// GPT-5 models don't include temperature
			expect(parsedBody.temperature).toBeUndefined()
			expect(parsedBody.max_output_tokens).toBeDefined()

			// Verify the streamed content
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Hello")
			expect(textChunks[1].text).toBe(" world")
		})

		it("should handle GPT-5-mini model with Responses API", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"Response"}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5-mini-2025-08-07",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify correct model and default parameters
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					body: expect.stringContaining('"model":"gpt-5-mini-2025-08-07"'),
				}),
			)
		})

		it("should handle GPT-5-nano model with Responses API", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"Nano response"}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5-nano-2025-08-07",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify correct model
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					body: expect.stringContaining('"model":"gpt-5-nano-2025-08-07"'),
				}),
			)
		})

		it("should support verbosity control for GPT-5", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"Low verbosity"}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				verbosity: "low", // Set verbosity through options
			})

			// Create a message to verify verbosity is passed
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify that verbosity is passed in the request
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					body: expect.stringContaining('"verbosity":"low"'),
				}),
			)
		})

		it("should support minimal reasoning effort for GPT-5", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"Minimal effort"}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				reasoningEffort: "minimal" as any, // GPT-5 supports minimal
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// With minimal reasoning effort, the model should pass it through
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					body: expect.stringContaining('"effort":"minimal"'),
				}),
			)
		})

		it("should support xhigh reasoning effort for GPT-5.1 Codex Max", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"XHigh effort"}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1-codex-max",
				reasoningEffort: "xhigh",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// drain
			}

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					body: expect.stringContaining('"effort":"xhigh"'),
				}),
			)
		})

		it("should omit reasoning when selection is 'disable'", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"No reasoning"}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				reasoningEffort: "disable" as any,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// drain
			}

			const bodyStr = (mockFetch.mock.calls[0][1] as any).body as string
			const parsed = JSON.parse(bodyStr)
			expect(parsed.reasoning).toBeUndefined()
			expect(parsed.include).toBeUndefined()
		})

		it("should support low reasoning effort for GPT-5", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"Low effort response"}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				reasoningEffort: "low",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should use Responses API with low reasoning effort
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					body: expect.any(String),
				}),
			)
			const body2 = (mockFetch.mock.calls[0][1] as any).body as string
			const parsedBody = JSON.parse(body2)
			expect(parsedBody.model).toBe("gpt-5.1")
			expect(parsedBody.reasoning?.effort).toBe("low")
			expect(parsedBody.reasoning?.summary).toBe("auto")
			expect(parsedBody.text?.verbosity).toBe("medium")
			// GPT-5 models don't include temperature
			expect(parsedBody.temperature).toBeUndefined()
			expect(parsedBody.max_output_tokens).toBeDefined()
		})

		it("should support both verbosity and reasoning effort together for GPT-5", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"High verbosity minimal effort"}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				verbosity: "high",
				reasoningEffort: "minimal" as any,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should use Responses API with both parameters
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					body: expect.any(String),
				}),
			)
			const body3 = (mockFetch.mock.calls[0][1] as any).body as string
			const parsedBody = JSON.parse(body3)
			expect(parsedBody.model).toBe("gpt-5.1")
			expect(parsedBody.reasoning?.effort).toBe("minimal")
			expect(parsedBody.reasoning?.summary).toBe("auto")
			expect(parsedBody.text?.verbosity).toBe("high")
			// GPT-5 models don't include temperature
			expect(parsedBody.temperature).toBeUndefined()
			expect(parsedBody.max_output_tokens).toBeDefined()
		})

		it("should handle actual GPT-5 Responses API format", async () => {
			// Mock fetch with actual response format from GPT-5
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						// Test actual GPT-5 response format
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.created","response":{"id":"test","status":"in_progress"}}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.in_progress","response":{"status":"in_progress"}}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"First text"}}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":" Second text"}}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"reasoning","text":"Some reasoning"}}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.done","response":{"usage":{"prompt_tokens":100,"completion_tokens":20}}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should handle the actual format correctly
			const textChunks = chunks.filter((c) => c.type === "text")
			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")

			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("First text")
			expect(textChunks[1].text).toBe(" Second text")

			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Some reasoning")

			// Should also have usage information with cost
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 20,
				totalCost: expect.any(Number),
			})

			// Verify cost calculation (GPT-5 pricing: input $1.25/M, output $10/M)
			const expectedInputCost = (100 / 1_000_000) * 1.25
			const expectedOutputCost = (20 / 1_000_000) * 10.0
			const expectedTotalCost = expectedInputCost + expectedOutputCost
			expect(usageChunks[0].totalCost).toBeCloseTo(expectedTotalCost, 10)
		})

		it("should handle Responses API with no content gracefully", async () => {
			// Mock fetch with empty response
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode('data: {"someField":"value"}\n\n'))
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []

			// Should not throw, just warn
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have no content chunks when stream is empty
			const contentChunks = chunks.filter((c) => c.type === "text" || c.type === "reasoning")

			expect(contentChunks).toHaveLength(0)
		})

		it("should handle unhandled stream events gracefully", async () => {
			// Mock fetch for the fallback SSE path
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"Hello"}}\n\n',
							),
						)
						// This event is not handled, so it should be ignored
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.audio.delta","delta":"..."}\n\n'),
						)
						controller.enqueue(new TextEncoder().encode('data: {"type":"response.done","response":{}}\n\n'))
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			const errors: any[] = []

			try {
				for await (const chunk of stream) {
					chunks.push(chunk)
				}
			} catch (error) {
				errors.push(error)
			}

			expect(errors.length).toBe(0)
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks.length).toBeGreaterThan(0)
			expect(textChunks[0].text).toBe("Hello")
		})

		it("should format full conversation correctly", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"Response"}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			const stream = gpt5Handler.createMessage(systemPrompt, messages, {
				taskId: "task1",
			})
			for await (const chunk of stream) {
				// consume
			}

			const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(callBody.input).toEqual([
				{
					role: "user",
					content: [{ type: "input_text", text: "Hello!" }],
				},
			])
			expect(callBody.previous_response_id).toBeUndefined()
		})

		it("should provide helpful error messages for different error codes", async () => {
			const testCases = [
				{ status: 400, expectedMessage: "Invalid request to Responses API" },
				{ status: 401, expectedMessage: "Authentication failed" },
				{ status: 403, expectedMessage: "Access denied" },
				{ status: 404, expectedMessage: "Responses API endpoint not found" },
				{ status: 429, expectedMessage: "Rate limit exceeded" },
				{ status: 500, expectedMessage: "OpenAI service error" },
			]

			for (const { status, expectedMessage } of testCases) {
				// Mock fetch with error response
				const mockFetch = vitest.fn().mockResolvedValue({
					ok: false,
					status,
					statusText: "Error",
					text: async () => JSON.stringify({ error: { message: "Test error" } }),
				})
				global.fetch = mockFetch as any

				// Mock SDK to fail
				mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

				handler = new OpenAiNativeHandler({
					...mockOptions,
					apiModelId: "gpt-5.1",
				})

				const stream = handler.createMessage(systemPrompt, messages)

				await expect(async () => {
					for await (const chunk of stream) {
						// Should throw before yielding anything
					}
				}).rejects.toThrow(expectedMessage)

				// Clean up
				delete (global as any).fetch
			}
		})
	})
})

// Additional tests for GPT-5 streaming event coverage
describe("GPT-5 streaming event coverage (additional)", () => {
	afterEach(() => {
		if ((global as any).fetch) {
			delete (global as any).fetch
		}
	})

	it("should handle reasoning delta events for GPT-5", async () => {
		const mockFetch = vitest.fn().mockResolvedValue({
			ok: true,
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(
						new TextEncoder().encode(
							'data: {"type":"response.reasoning.delta","delta":"Thinking about the problem..."}\n\n',
						),
					)
					controller.enqueue(
						new TextEncoder().encode('data: {"type":"response.text.delta","delta":"The answer is..."}\n\n'),
					)
					controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
					controller.close()
				},
			}),
		})
		global.fetch = mockFetch as any

		// Mock SDK to fail
		mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5.1",
			openAiNativeApiKey: "test-api-key",
		})

		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello!" }]
		const stream = handler.createMessage(systemPrompt, messages)

		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
		const textChunks = chunks.filter((c) => c.type === "text")

		expect(reasoningChunks).toHaveLength(1)
		expect(reasoningChunks[0].text).toBe("Thinking about the problem...")
		expect(textChunks).toHaveLength(1)
		expect(textChunks[0].text).toBe("The answer is...")
	})

	it("should handle refusal delta events for GPT-5 and prefix output", async () => {
		const mockFetch = vitest.fn().mockResolvedValue({
			ok: true,
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(
						new TextEncoder().encode(
							'data: {"type":"response.refusal.delta","delta":"I cannot comply with this request."}\n\n',
						),
					)
					controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
					controller.close()
				},
			}),
		})
		global.fetch = mockFetch as any

		// Mock SDK to fail
		mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5.1",
			openAiNativeApiKey: "test-api-key",
		})

		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Do something disallowed" }]
		const stream = handler.createMessage(systemPrompt, messages)

		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		const textChunks = chunks.filter((c) => c.type === "text")
		expect(textChunks).toHaveLength(1)
		expect(textChunks[0].text).toBe("[Refusal] I cannot comply with this request.")
	})

	it("should ignore malformed JSON lines in SSE stream", async () => {
		const mockFetch = vitest.fn().mockResolvedValue({
			ok: true,
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(
						new TextEncoder().encode(
							'data: {"type":"response.output_item.added","item":{"type":"text","text":"Before"}}\n\n',
						),
					)
					// Malformed JSON line
					controller.enqueue(
						new TextEncoder().encode('data: {"type":"response.text.delta","delta":"Bad"\n\n'),
					)
					// Valid line after malformed
					controller.enqueue(
						new TextEncoder().encode(
							'data: {"type":"response.output_item.added","item":{"type":"text","text":"After"}}\n\n',
						),
					)
					controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
					controller.close()
				},
			}),
		})
		global.fetch = mockFetch as any

		// Mock SDK to fail
		mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5.1",
			openAiNativeApiKey: "test-api-key",
		})

		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello!" }]
		const stream = handler.createMessage(systemPrompt, messages)

		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		// It should not throw and still capture the valid texts around the malformed line
		const textChunks = chunks.filter((c) => c.type === "text")
		expect(textChunks.map((c: any) => c.text)).toEqual(["Before", "After"])
	})

	describe("Codex Mini Model", () => {
		let handler: OpenAiNativeHandler
		const mockOptions: ApiHandlerOptions = {
			openAiNativeApiKey: "test-api-key",
			apiModelId: "codex-mini-latest",
		}

		it("should handle codex-mini-latest streaming response", async () => {
			// Mock fetch for Codex Mini responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						// Codex Mini uses the same responses API format
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"Hello"}\n\n'),
						)
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":" from"}\n\n'),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_text.delta","delta":" Codex"}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_text.delta","delta":" Mini!"}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.done","response":{"usage":{"prompt_tokens":50,"completion_tokens":10}}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			const systemPrompt = "You are a helpful coding assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Write a hello world function" },
			]

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify text chunks
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(4)
			expect(textChunks.map((c) => c.text).join("")).toBe("Hello from Codex Mini!")

			// Verify usage data from API
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toMatchObject({
				type: "usage",
				inputTokens: 50,
				outputTokens: 10,
				totalCost: expect.any(Number), // Codex Mini has pricing: $1.5/M input, $6/M output
			})

			// Verify cost is calculated correctly based on API usage data
			const expectedCost = (50 / 1_000_000) * 1.5 + (10 / 1_000_000) * 6
			expect(usageChunks[0].totalCost).toBeCloseTo(expectedCost, 10)

			// Verify the request was made with correct parameters
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer test-api-key",
						Accept: "text/event-stream",
					}),
					body: expect.any(String),
				}),
			)

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody).toMatchObject({
				model: "codex-mini-latest",
				instructions: "You are a helpful coding assistant.",
				input: [
					{
						role: "user",
						content: [{ type: "input_text", text: "Write a hello world function" }],
					},
				],
				stream: true,
			})
		})

		it("should handle codex-mini-latest non-streaming completion", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			// Mock the responses.create method to return a non-streaming response
			mockResponsesCreate.mockResolvedValue({
				output: [
					{
						type: "message",
						content: [
							{
								type: "output_text",
								text: "def hello_world():\n    print('Hello, World!')",
							},
						],
					},
				],
			})

			const result = await handler.completePrompt("Write a hello world function in Python")

			expect(result).toBe("def hello_world():\n    print('Hello, World!')")
			expect(mockResponsesCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "codex-mini-latest",
					stream: false,
					store: false,
				}),
				expect.objectContaining({
					signal: expect.any(Object),
				}),
			)
		})

		it("should handle codex-mini-latest API errors", async () => {
			// Mock fetch with error response
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: false,
				status: 429,
				statusText: "Too Many Requests",
				text: async () => "Rate limit exceeded",
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)

			// Should throw an error (using the same error format as GPT-5)
			await expect(async () => {
				for await (const chunk of stream) {
					// consume stream
				}
			}).rejects.toThrow("Rate limit exceeded")
		})

		it("should handle codex-mini-latest with multiple user messages", async () => {
			// Mock fetch for streaming response
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_text.delta","delta":"Combined response"}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode('data: {"type":"response.completed"}\n\n'))
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "First question" },
				{ role: "assistant", content: "First answer" },
				{ role: "user", content: "Second question" },
			]

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify the request body includes full conversation in structured format (without embedding system prompt)
			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.instructions).toBe("You are a helpful assistant.")
			expect(requestBody.input).toEqual([
				{
					role: "user",
					content: [{ type: "input_text", text: "First question" }],
				},
				{
					role: "assistant",
					content: [{ type: "output_text", text: "First answer" }],
				},
				{
					role: "user",
					content: [{ type: "input_text", text: "Second question" }],
				},
			])
		})

		it("should handle codex-mini-latest stream error events", async () => {
			// Mock fetch with error event in stream
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_text.delta","delta":"Partial"}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.error","error":{"message":"Model overloaded"}}\n\n',
							),
						)
						// The error handler will throw, but we still need to close the stream
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)

			// Should throw an error when encountering error event
			await expect(async () => {
				const chunks = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}
			}).rejects.toThrow("Responses API error: Model overloaded")
		})

		// New tests: ensure text.verbosity is omitted for models without supportsVerbosity
		describe("Verbosity gating for non-GPT-5 models", () => {
			it("should omit text.verbosity for gpt-4.1", async () => {
				const mockFetch = vitest.fn().mockResolvedValue({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							controller.enqueue(
								new TextEncoder().encode('data: {"type":"response.done","response":{}}\n\n'),
							)
							controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
							controller.close()
						},
					}),
				})
				;(global as any).fetch = mockFetch as any

				// Force SDK path to fail so we use fetch fallback
				mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

				const handler = new OpenAiNativeHandler({
					apiModelId: "gpt-4.1",
					openAiNativeApiKey: "test-api-key",
					verbosity: "high",
				})

				const systemPrompt = "You are a helpful assistant."
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello!" }]
				const stream = handler.createMessage(systemPrompt, messages)

				for await (const _ of stream) {
					// drain
				}

				const bodyStr = (mockFetch.mock.calls[0][1] as any).body as string
				const parsedBody = JSON.parse(bodyStr)
				expect(parsedBody.model).toBe("gpt-4.1")
				expect(parsedBody.text).toBeUndefined()
				expect(bodyStr).not.toContain('"verbosity"')
			})

			it("should omit text.verbosity for gpt-4o", async () => {
				const mockFetch = vitest.fn().mockResolvedValue({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							controller.enqueue(
								new TextEncoder().encode('data: {"type":"response.done","response":{}}\n\n'),
							)
							controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
							controller.close()
						},
					}),
				})
				;(global as any).fetch = mockFetch as any

				// Force SDK path to fail so we use fetch fallback
				mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

				const handler = new OpenAiNativeHandler({
					apiModelId: "gpt-4o",
					openAiNativeApiKey: "test-api-key",
					verbosity: "low",
				})

				const systemPrompt = "You are a helpful assistant."
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello!" }]
				const stream = handler.createMessage(systemPrompt, messages)

				for await (const _ of stream) {
					// drain
				}

				const bodyStr = (mockFetch.mock.calls[0][1] as any).body as string
				const parsedBody = JSON.parse(bodyStr)
				expect(parsedBody.model).toBe("gpt-4o")
				expect(parsedBody.text).toBeUndefined()
				expect(bodyStr).not.toContain('"verbosity"')
			})
		})
	})
})

describe("OpenAI Native background mode behavior", () => {
	const systemPrompt = "System prompt"
	const baseMessages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "hi" }]
	const createMinimalIterable = () => ({
		async *[Symbol.asyncIterator]() {
			yield {
				type: "response.done",
				response: { id: "resp_minimal", usage: { input_tokens: 1, output_tokens: 1 } },
			}
		},
	})
	const createUsageIterable = () => ({
		async *[Symbol.asyncIterator]() {
			yield { type: "response.text.delta", delta: "Hello" }
			yield {
				type: "response.done",
				response: {
					id: "resp_usage",
					usage: { input_tokens: 120, output_tokens: 60 },
				},
			}
		},
	})

	beforeEach(() => {
		mockResponsesCreate.mockClear()
	})

	afterEach(() => {
		if ((global as any).fetch) {
			delete (global as any).fetch
		}
	})

	const metadataStoreFalse: ApiHandlerCreateMessageMetadata = { taskId: "background-test", store: false }

	it("auto-enables background mode for gpt-5-pro when no override is specified", async () => {
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
			// openAiNativeBackgroundMode is undefined
		})

		mockResponsesCreate.mockResolvedValueOnce(createMinimalIterable())

		const chunks: any[] = []
		for await (const chunk of handler.createMessage(systemPrompt, baseMessages, metadataStoreFalse)) {
			chunks.push(chunk)
		}

		expect(chunks).not.toHaveLength(0)
		const requestBody = mockResponsesCreate.mock.calls[0][0]
		expect(requestBody.background).toBe(true)
		expect(requestBody.stream).toBe(true)
		expect(requestBody.store).toBe(true)
	})
	it("sends background:true, stream:true, and forces store:true for gpt-5-pro when background mode is enabled", async () => {
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
			openAiNativeBackgroundMode: true,
		})

		mockResponsesCreate.mockResolvedValueOnce(createMinimalIterable())

		const chunks: any[] = []
		for await (const chunk of handler.createMessage(systemPrompt, baseMessages, metadataStoreFalse)) {
			chunks.push(chunk)
		}

		expect(chunks).not.toHaveLength(0)

		const requestBody = mockResponsesCreate.mock.calls[0][0]
		expect(requestBody.background).toBe(true)
		expect(requestBody.stream).toBe(true)
		expect(requestBody.store).toBe(true)
		expect(requestBody.instructions).toBe(systemPrompt)
		expect(requestBody.model).toBe("gpt-5-pro-2025-10-06")
		expect(Array.isArray(requestBody.input)).toBe(true)
		expect(requestBody.input.length).toBeGreaterThan(0)

		mockResponsesCreate.mockClear()

		const handlerWithOptionFalse = new OpenAiNativeHandler({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
			openAiNativeBackgroundMode: false, // metadata still enforces background mode
		})

		mockResponsesCreate.mockResolvedValueOnce(createMinimalIterable())

		for await (const chunk of handlerWithOptionFalse.createMessage(
			systemPrompt,
			baseMessages,
			metadataStoreFalse,
		)) {
			chunks.push(chunk)
		}

		const requestBodyWithOptionFalse = mockResponsesCreate.mock.calls[0][0]
		// Still enabled due to model.info.backgroundMode
		expect(requestBodyWithOptionFalse.background).toBe(true)
		expect(requestBodyWithOptionFalse.store).toBe(true)
		expect(requestBodyWithOptionFalse.stream).toBe(true)
	})

	it("forces store:true and includes background:true when falling back to SSE", async () => {
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
			openAiNativeBackgroundMode: true,
		})

		mockResponsesCreate.mockResolvedValueOnce({})

		const encoder = new TextEncoder()
		const sseStream = new ReadableStream({
			start(controller) {
				controller.enqueue(
					encoder.encode(
						'data: {"type":"response.done","response":{"id":"resp_1","usage":{"input_tokens":1,"output_tokens":1}}}\n\n',
					),
				)
				controller.enqueue(encoder.encode("data: [DONE]\n\n"))
				controller.close()
			},
		})

		const mockFetch = vitest.fn().mockResolvedValue(
			new Response(sseStream, {
				status: 200,
				headers: { "Content-Type": "text/event-stream" },
			}),
		)
		global.fetch = mockFetch as any

		const chunks: any[] = []
		for await (const chunk of handler.createMessage(systemPrompt, baseMessages, metadataStoreFalse)) {
			chunks.push(chunk)
		}

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const requestInit = mockFetch.mock.calls[0][1] as RequestInit
		expect(requestInit?.body).toBeDefined()

		const parsedBody = JSON.parse(requestInit?.body as string)
		expect(parsedBody.background).toBe(true)
		expect(parsedBody.store).toBe(true)
		expect(parsedBody.stream).toBe(true)
		expect(parsedBody.model).toBe("gpt-5-pro-2025-10-06")
	})

	it("emits identical usage chunk when background mode is enabled", async () => {
		const collectUsageChunk = async (options: ApiHandlerOptions) => {
			mockResponsesCreate.mockResolvedValueOnce(createUsageIterable())
			const handler = new OpenAiNativeHandler(options)
			const chunks: any[] = []
			for await (const chunk of handler.createMessage(systemPrompt, baseMessages)) {
				chunks.push(chunk)
			}
			const usageChunk = chunks.find((chunk) => chunk.type === "usage")
			mockResponsesCreate.mockClear()
			return usageChunk
		}

		const baselineUsage = await collectUsageChunk({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
		})

		expect(baselineUsage).toBeDefined()

		const backgroundUsage = await collectUsageChunk({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
			openAiNativeBackgroundMode: true,
		})

		expect(backgroundUsage).toBeDefined()
		expect(backgroundUsage).toEqual(baselineUsage)
	})

	it("emits background status chunks for Responses events (SDK path)", async () => {
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
			openAiNativeBackgroundMode: true,
		})

		const createStatusIterable = () => ({
			async *[Symbol.asyncIterator]() {
				yield { type: "response.queued", response: { id: "resp_bg" } }
				yield { type: "response.in_progress" }
				yield { type: "response.text.delta", delta: "Hello" }
				yield {
					type: "response.done",
					response: { id: "resp_bg", usage: { input_tokens: 1, output_tokens: 1 } },
				}
			},
		})
		mockResponsesCreate.mockResolvedValueOnce(createStatusIterable())

		const chunks: any[] = []
		for await (const chunk of handler.createMessage(systemPrompt, baseMessages)) {
			chunks.push(chunk)
		}

		const statusChunks = chunks.filter((c) => c.type === "status")
		expect(statusChunks).toEqual([
			{ type: "status", mode: "background", status: "queued", responseId: "resp_bg" },
			{ type: "status", mode: "background", status: "in_progress" },
			{ type: "status", mode: "background", status: "completed", responseId: "resp_bg" },
		])
	})

	it("emits background status chunks for Responses events (SSE fallback)", async () => {
		// Force fallback by making SDK return non-iterable
		mockResponsesCreate.mockResolvedValueOnce({})

		const encoder = new TextEncoder()
		const sseStream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode('data: {"type":"response.queued","response":{"id":"resp_bg2"}}\n\n'))
				controller.enqueue(encoder.encode('data: {"type":"response.in_progress"}\n\n'))
				controller.enqueue(encoder.encode('data: {"type":"response.text.delta","delta":"Hi"}\n\n'))
				controller.enqueue(
					encoder.encode(
						'data: {"type":"response.done","response":{"id":"resp_bg2","usage":{"input_tokens":1,"output_tokens":1}}}\n\n',
					),
				)
				controller.enqueue(encoder.encode("data: [DONE]\n\n"))
				controller.close()
			},
		})

		const mockFetch = vitest.fn().mockResolvedValue(
			new Response(sseStream, {
				status: 200,
				headers: { "Content-Type": "text/event-stream" },
			}),
		)
		global.fetch = mockFetch as any

		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
			openAiNativeBackgroundMode: true,
		})

		const chunks: any[] = []
		for await (const chunk of handler.createMessage(systemPrompt, baseMessages)) {
			chunks.push(chunk)
		}

		const statusChunks = chunks.filter((c) => c.type === "status")
		expect(statusChunks).toEqual([
			{ type: "status", mode: "background", status: "queued", responseId: "resp_bg2" },
			{ type: "status", mode: "background", status: "in_progress" },
			{ type: "status", mode: "background", status: "completed", responseId: "resp_bg2" },
		])

		// Clean up fetch
		delete (global as any).fetch
	})
})

describe("OpenAI Native streaming metadata tracking", () => {
	beforeEach(() => {
		mockResponsesCreate.mockClear()
	})

	it("tracks sequence_number from streaming events and exposes via getLastSequenceNumber", async () => {
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
		})

		const createSequenceIterable = () => ({
			async *[Symbol.asyncIterator]() {
				yield { type: "response.text.delta", delta: "A", sequence_number: 1 }
				yield { type: "response.reasoning.delta", delta: "B", sequence_number: 2 }
				yield {
					type: "response.done",
					sequence_number: 3,
					response: { id: "resp_123", usage: { input_tokens: 1, output_tokens: 2 } },
				}
			},
		})

		mockResponsesCreate.mockResolvedValueOnce(createSequenceIterable())

		const chunks: any[] = []
		for await (const chunk of handler.createMessage("System", [{ role: "user", content: "hi" }])) {
			chunks.push(chunk)
		}

		expect(chunks).toContainEqual({ type: "text", text: "A" })
		expect(chunks).toContainEqual({ type: "reasoning", text: "B" })
		expect(handler.getLastSequenceNumber()).toBe(3)
		expect(handler.getResponseId()).toBe("resp_123")
	})
})

// Added plumbing test for openAiNativeBackgroundMode
describe("OpenAI Native background mode setting (plumbing)", () => {
	it("should surface openAiNativeBackgroundMode in handler options when provided", () => {
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-4.1",
			openAiNativeApiKey: "test-api-key",
			openAiNativeBackgroundMode: true,
		} as ApiHandlerOptions)

		// Access protected options via runtime cast to verify pass-through
		expect((handler as any).options.openAiNativeBackgroundMode).toBe(true)
	})
})

describe("OpenAI Native background auto-resume and polling", () => {
	const systemPrompt = "System prompt"
	const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "hello" }]

	beforeEach(() => {
		mockResponsesCreate.mockClear()
		if ((global as any).fetch) {
			delete (global as any).fetch
		}
	})

	it("resumes background stream on drop and emits no duplicate deltas", async () => {
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
			openAiNativeBackgroundMode: true,
		})

		const dropIterable = {
			async *[Symbol.asyncIterator]() {
				yield { type: "response.queued", response: { id: "resp_resume" }, sequence_number: 0 }
				yield { type: "response.in_progress", sequence_number: 1 }
				yield { type: "response.text.delta", delta: "Hello", sequence_number: 2 }
				throw new Error("network drop")
			},
		}
		mockResponsesCreate.mockResolvedValueOnce(dropIterable as any)

		const encoder = new TextEncoder()
		const sseStream = new ReadableStream({
			start(controller) {
				controller.enqueue(
					encoder.encode(
						'data: {"type":"response.output_item.added","item":{"type":"text","text":"SHOULD_SKIP"},"sequence_number":2}\n\n',
					),
				)
				controller.enqueue(
					encoder.encode(
						'data: {"type":"response.output_item.added","item":{"type":"text","text":" world"},"sequence_number":3}\n\n',
					),
				)
				controller.enqueue(
					encoder.encode(
						'data: {"type":"response.done","response":{"id":"resp_resume","usage":{"input_tokens":10,"output_tokens":5}},"sequence_number":4}\n\n',
					),
				)
				controller.enqueue(encoder.encode("data: [DONE]\n\n"))
				controller.close()
			},
		})
		;(global as any).fetch = vitest
			.fn()
			.mockResolvedValue(
				new Response(sseStream, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
			)

		const stream = handler.createMessage(systemPrompt, messages)
		const chunks: any[] = []
		for await (const c of stream) {
			chunks.push(c)
		}

		const statusChunks = chunks.filter((c) => c.type === "status")
		const statusNames = statusChunks.map((s: any) => s.status)
		const reconnectIdx = statusNames.indexOf("reconnecting")
		const inProgIdx = statusNames.findIndex((s, i) => s === "in_progress" && i > reconnectIdx)
		expect(reconnectIdx).toBeGreaterThanOrEqual(0)
		expect(inProgIdx).toBeGreaterThan(reconnectIdx)

		const fullText = chunks
			.filter((c) => c.type === "text")
			.map((c: any) => c.text)
			.join("")
		expect(fullText).toBe("Hello world")
		expect(fullText).not.toContain("SHOULD_SKIP")

		const usageChunks = chunks.filter((c) => c.type === "usage")
		expect(usageChunks).toHaveLength(1)
	})

	it("falls back to polling after failed resume and yields final output/usage", async () => {
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5-pro-2025-10-06",
			openAiNativeApiKey: "test",
			openAiNativeBackgroundMode: true,
			openAiNativeBackgroundResumeMaxRetries: 1,
			openAiNativeBackgroundResumeBaseDelayMs: 0,
			openAiNativeBackgroundPollIntervalMs: 1,
			openAiNativeBackgroundPollMaxMinutes: 1,
		} as ApiHandlerOptions)

		const dropIterable = {
			async *[Symbol.asyncIterator]() {
				yield { type: "response.queued", response: { id: "resp_poll" }, sequence_number: 0 }
				yield { type: "response.in_progress", sequence_number: 1 }
				throw new Error("network drop")
			},
		}
		mockResponsesCreate.mockResolvedValueOnce(dropIterable as any)

		let pollStep = 0
		;(global as any).fetch = vitest.fn().mockImplementation((url: string) => {
			if (url.includes("?stream=true")) {
				return Promise.resolve({
					ok: false,
					status: 500,
					text: async () => "resume failed",
				} as any)
			}
			// polling path
			const payloads = [
				{ response: { id: "resp_poll", status: "queued" } },
				{ response: { id: "resp_poll", status: "in_progress" } },
				{
					response: {
						id: "resp_poll",
						status: "completed",
						output: [{ type: "message", content: [{ type: "output_text", text: "Polled result" }] }],
						usage: { input_tokens: 7, output_tokens: 3 },
					},
				},
			]
			const payload = payloads[Math.min(pollStep++, payloads.length - 1)]
			return Promise.resolve(
				new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }),
			)
		})

		const stream = handler.createMessage(systemPrompt, messages)
		const chunks: any[] = []
		for await (const c of stream) {
			chunks.push(c)
		}

		const statusNames = chunks.filter((c) => c.type === "status").map((s: any) => s.status)
		const idxReconnect = statusNames.indexOf("reconnecting")
		const idxPolling = statusNames.indexOf("polling")
		const idxQueued = statusNames.indexOf("queued")
		const idxInProgress = statusNames.indexOf("in_progress")
		const idxCompleted = statusNames.indexOf("completed")
		expect(idxReconnect).toBeGreaterThanOrEqual(0)
		expect(idxPolling).toBeGreaterThan(idxReconnect)

		const idxQueuedAfterPolling = statusNames.findIndex((s, i) => s === "queued" && i > idxPolling)
		const idxInProgressAfterQueued = statusNames.findIndex(
			(s, i) => s === "in_progress" && i > idxQueuedAfterPolling,
		)
		const idxCompletedAfterInProgress = statusNames.findIndex(
			(s, i) => s === "completed" && i > idxInProgressAfterQueued,
		)

		expect(idxQueuedAfterPolling).toBeGreaterThan(idxPolling)
		expect(idxInProgressAfterQueued).toBeGreaterThan(idxQueuedAfterPolling)
		expect(idxCompletedAfterInProgress).toBeGreaterThan(idxInProgressAfterQueued)

		const finalText = chunks
			.filter((c) => c.type === "text")
			.map((c: any) => c.text)
			.join("")
		expect(finalText).toBe("Polled result")

		const usageChunks = chunks.filter((c) => c.type === "usage")
		expect(usageChunks).toHaveLength(1)
		expect(usageChunks[0]).toMatchObject({ type: "usage", inputTokens: 7, outputTokens: 3 })
	})

	it("does not attempt resume when not in background mode", async () => {
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-4.1",
			openAiNativeApiKey: "test",
			openAiNativeBackgroundMode: false,
		})

		const dropIterable = {
			async *[Symbol.asyncIterator]() {
				yield { type: "response.text.delta", delta: "Hi", sequence_number: 1 }
				throw new Error("drop")
			},
		}
		mockResponsesCreate.mockResolvedValueOnce(dropIterable as any)
		;(global as any).fetch = vitest.fn().mockRejectedValue(new Error("SSE fallback failed"))

		const stream = handler.createMessage(systemPrompt, messages)

		const chunks: any[] = []
		await expect(async () => {
			for await (const c of stream) {
				chunks.push(c)
			}
		}).rejects.toThrow()

		const statuses = chunks.filter((c) => c.type === "status").map((s: any) => s.status)
		expect(statuses).not.toContain("reconnecting")
		expect(statuses).not.toContain("polling")
	})
})
