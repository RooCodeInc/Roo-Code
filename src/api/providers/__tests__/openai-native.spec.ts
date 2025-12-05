// npx vitest run api/providers/__tests__/openai-native.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"

import { openAiModelInfoSaneDefaults } from "@roo-code/types"

import { OpenAiNativeHandler } from "../openai-native"
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

		it("should default to store=true when metadata is not provided", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					// no-op
				},
			}
			mockResponsesCreate.mockResolvedValue(mockStream as any)

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// drain
			}

			expect(mockResponsesCreate).toHaveBeenCalledWith(
				expect.objectContaining({ store: true }),
				expect.objectContaining({ signal: expect.any(Object) }),
			)
		})

		it("should honor metadata.store when provided", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					// no-op
				},
			}
			mockResponsesCreate.mockResolvedValue(mockStream as any)

			const stream = handler.createMessage(systemPrompt, messages, { taskId: "task-id", store: false })
			for await (const _ of stream) {
				// drain
			}

			expect(mockResponsesCreate).toHaveBeenCalledWith(
				expect.objectContaining({ store: false }),
				expect.objectContaining({ signal: expect.any(Object) }),
			)
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

		it("should capture response metadata for non-streaming completions", async () => {
			const responsePayload = {
				id: "resp_test",
				service_tier: "priority",
				output: [
					{
						type: "reasoning",
						encrypted_content: "encrypted",
					},
					{
						type: "message",
						content: [
							{
								type: "output_text",
								text: "Final response",
							},
						],
					},
				],
			}
			mockResponsesCreate.mockResolvedValue(responsePayload)

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Final response")
			expect(handler.getResponseId()).toBe("resp_test")
			expect(handler.getEncryptedContent()).toEqual({ encrypted_content: "encrypted" })
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
			expect(modelInfo.id).toBe("gpt-5.1") // Default model
			expect(modelInfo.info).toBeDefined()
		})

		it("should preserve custom model ids and metadata", () => {
			const handlerWithCustomModel = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-api-key",
				apiModelId: "my-custom-model",
				openAiCustomModelInfo: {
					...openAiModelInfoSaneDefaults,
					contextWindow: 222_000,
					maxTokens: 16_000,
					inputPrice: 0.5,
					outputPrice: 1.5,
				},
			})

			const modelInfo = handlerWithCustomModel.getModel()
			expect(modelInfo.id).toBe("my-custom-model")
			expect(modelInfo.info.contextWindow).toBe(222_000)
			expect(modelInfo.info.maxTokens).toBe(16_000)
			expect(modelInfo.info.outputPrice).toBe(1.5)
		})

		it("should fall back to sane defaults when metadata is missing for custom ids", () => {
			const handlerWithUnknownModel = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-api-key",
				apiModelId: "brand-new-model",
			})

			const modelInfo = handlerWithUnknownModel.getModel()
			expect(modelInfo.id).toBe("brand-new-model")
			expect(modelInfo.info.contextWindow).toBe(openAiModelInfoSaneDefaults.contextWindow)
			expect(modelInfo.info.maxTokens).toBe(openAiModelInfoSaneDefaults.maxTokens)
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
					type: "message",
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
					type: "message",
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

// Azure OpenAI specific tests
describe("Azure OpenAI", () => {
	const azureOptions: ApiHandlerOptions = {
		apiModelId: "gpt-4.1",
		openAiNativeApiKey: "test-azure-api-key",
		openAiNativeBaseUrl: "https://my-resource.openai.azure.com/openai/v1",
	}

	afterEach(() => {
		if ((global as any).fetch) {
			delete (global as any).fetch
		}
		mockResponsesCreate.mockClear()
	})

	describe("URL and Authentication", () => {
		it("should detect Azure OpenAI from URL", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.text.delta","delta":"Hello"}\n\n'),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			// Mock SDK to fail to force fetch fallback
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler(azureOptions)
			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Hello" }])

			for await (const _ of stream) {
				// drain
			}

			// Verify Azure-specific URL format (v1 API does not require api-version)
			expect(mockFetch).toHaveBeenCalledWith(
				"https://my-resource.openai.azure.com/openai/v1/responses",
				expect.anything(),
			)
		})

		it("should use api-key header for Azure instead of Authorization Bearer", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.text.delta","delta":"Hello"}\n\n'),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler(azureOptions)
			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Hello" }])

			for await (const _ of stream) {
				// drain
			}

			// Verify api-key header is used
			const callHeaders = mockFetch.mock.calls[0][1].headers
			expect(callHeaders["api-key"]).toBe("test-azure-api-key")
			expect(callHeaders["Authorization"]).toBeUndefined()
		})

		it("should handle various Azure URL formats correctly", async () => {
			const urlFormats = [
				"https://my-resource.openai.azure.com",
				"https://my-resource.openai.azure.com/",
				"https://my-resource.openai.azure.com/openai",
				"https://my-resource.openai.azure.com/openai/",
				"https://my-resource.openai.azure.com/openai/v1",
				"https://my-resource.openai.azure.com/openai/v1/",
			]

			for (const baseUrl of urlFormats) {
				const mockFetch = vitest.fn().mockResolvedValue({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
							controller.close()
						},
					}),
				})
				global.fetch = mockFetch as any
				mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

				const handler = new OpenAiNativeHandler({
					...azureOptions,
					openAiNativeBaseUrl: baseUrl,
				})

				const stream = handler.createMessage("System", [{ role: "user", content: "Hi" }])
				for await (const _ of stream) {
					// drain
				}

				// All should resolve to the same URL (v1 API does not require api-version)
				expect(mockFetch.mock.calls[0][0]).toBe("https://my-resource.openai.azure.com/openai/v1/responses")
			}
		})
	})

	describe("Request Body Parameters", () => {
		it("should default to store=true for Azure requests", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler(azureOptions)
			const stream = handler.createMessage("System", [{ role: "user", content: "Hi" }])

			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.store).toBe(true)
		})

		it("should allow disabling storage via metadata.store for Azure", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler(azureOptions)
			const stream = handler.createMessage("System", [{ role: "user", content: "Hi" }], {
				taskId: "task",
				store: false,
			})

			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.store).toBe(false)
		})

		it("should include encrypted reasoning for Azure with reasoning effort", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler({
				...azureOptions,
				apiModelId: "o3-mini",
				reasoningEffort: "medium",
			})

			const stream = handler.createMessage("System", [{ role: "user", content: "Hi" }])
			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.include).toEqual(["reasoning.encrypted_content"])
			expect(requestBody.reasoning?.effort).toBe("medium")
		})

		it("should NOT include prompt_cache_retention for Azure", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler({
				...azureOptions,
				apiModelId: "gpt-5.1", // Model that supports prompt caching
			})

			const stream = handler.createMessage("System", [{ role: "user", content: "Hi" }])
			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.prompt_cache_retention).toBeUndefined()
		})
	})

	describe("Tool Format", () => {
		it("should use flat tool format for Azure Responses API", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler(azureOptions)

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get the weather for a location",
						parameters: {
							type: "object",
							properties: {
								location: { type: "string", description: "City name" },
							},
							required: ["location"],
						},
					},
				},
			]

			const stream = handler.createMessage("System", [{ role: "user", content: "Hi" }], {
				taskId: "test",
				tools,
				tool_choice: "auto",
			})

			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

			// Should be flat format (no nested 'function' wrapper)
			expect(requestBody.tools).toHaveLength(1)
			expect(requestBody.tools[0]).toEqual({
				type: "function",
				name: "get_weather",
				description: "Get the weather for a location",
				parameters: {
					type: "object",
					properties: {
						location: { type: "string", description: "City name" },
					},
					required: ["location"],
				},
				// No strict for Azure
			})

			// Verify NO nested function property
			expect(requestBody.tools[0].function).toBeUndefined()
		})

		it("should truncate tool descriptions to 1024 chars for Azure", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler(azureOptions)

			const longDescription = "A".repeat(2000) // 2000 chars
			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: longDescription,
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const stream = handler.createMessage("System", [{ role: "user", content: "Hi" }], {
				taskId: "test",
				tools,
			})

			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.tools[0].description.length).toBe(1024)
			expect(requestBody.tools[0].description.endsWith("...")).toBe(true)
		})

		it("should NOT include strict: true for Azure tools", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler(azureOptions)

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "Test",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const stream = handler.createMessage("System", [{ role: "user", content: "Hi" }], {
				taskId: "test",
				tools,
			})

			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.tools[0].strict).toBeUndefined()
		})

		it("should include strict: true for OpenAI (not Azure) tools", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			// Use OpenAI (not Azure)
			const handler = new OpenAiNativeHandler({
				apiModelId: "gpt-4.1",
				openAiNativeApiKey: "test-key",
				// No Azure base URL
			})

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "Test",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const stream = handler.createMessage("System", [{ role: "user", content: "Hi" }], {
				taskId: "test",
				tools,
			})

			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.tools[0].strict).toBe(true)
		})
	})

	describe("Message Formatting", () => {
		it("should use structured input_text format for Azure user messages (same as OpenAI)", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler(azureOptions)
			const stream = handler.createMessage("System", [{ role: "user", content: "Hello World" }])

			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			// Azure now uses the same structured format as OpenAI per official docs
			expect(requestBody.input).toEqual([
				{ type: "message", role: "user", content: [{ type: "input_text", text: "Hello World" }] },
			])
		})

		it("should use structured output_text format for Azure assistant messages (same as OpenAI)", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler(azureOptions)
			const stream = handler.createMessage("System", [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
				{ role: "user", content: "How are you?" },
			])

			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			// Azure now uses the same structured format as OpenAI per official docs
			expect(requestBody.input).toEqual([
				{ type: "message", role: "user", content: [{ type: "input_text", text: "Hello" }] },
				{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Hi there!" }] },
				{ type: "message", role: "user", content: [{ type: "input_text", text: "How are you?" }] },
			])
		})

		it("should include type: message for assistant messages that follow reasoning items", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any
			mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

			const handler = new OpenAiNativeHandler(azureOptions)
			// Simulate a conversation with reasoning items (as would be restored from API history)
			const messagesWithReasoning: any[] = [
				{ role: "user", content: "Think about this problem" },
				// Reasoning item from previous response
				{ type: "reasoning", encrypted_content: "encrypted_reasoning_data", id: "rs_123" },
				{ role: "assistant", content: "Here is my answer based on that reasoning" },
				{ role: "user", content: "Thanks!" },
			]

			const stream = handler.createMessage("System", messagesWithReasoning)

			for await (const _ of stream) {
				// drain
			}

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			// Verify the reasoning item is followed by a properly formatted assistant message
			// with type: "message" which is required by the Responses API
			expect(requestBody.input).toEqual([
				{ type: "message", role: "user", content: [{ type: "input_text", text: "Think about this problem" }] },
				{ type: "reasoning", encrypted_content: "encrypted_reasoning_data", id: "rs_123" },
				{
					type: "message",
					role: "assistant",
					content: [{ type: "output_text", text: "Here is my answer based on that reasoning" }],
				},
				{ type: "message", role: "user", content: [{ type: "input_text", text: "Thanks!" }] },
			])
		})
	})

	describe("completePrompt", () => {
		it("should capture response metadata for Azure non-streaming completions", async () => {
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					id: "resp_azure",
					service_tier: "flex",
					output: [
						{
							type: "reasoning",
							encrypted_content: "azure-encrypted",
						},
						{
							type: "message",
							content: [{ type: "output_text", text: "Azure response" }],
						},
					],
				}),
			})
			global.fetch = mockFetch as any

			const handler = new OpenAiNativeHandler(azureOptions)
			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Azure response")
			expect(handler.getResponseId()).toBe("resp_azure")
			expect(handler.getEncryptedContent()).toEqual({ encrypted_content: "azure-encrypted" })
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
					type: "message",
					role: "user",
					content: [{ type: "input_text", text: "First question" }],
				},
				{
					type: "message",
					role: "assistant",
					content: [{ type: "output_text", text: "First answer" }],
				},
				{
					type: "message",
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

		// New tests: streaming tool calls
		describe("Streaming tool calls", () => {
			it("should emit tool_call_partial on output_item.added for function_call items", async () => {
				const mockFetch = vitest.fn().mockResolvedValue({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							// Simulate tool call item added (provides id and name upfront)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","call_id":"call_123","name":"get_weather","arguments":""}}\n\n',
								),
							)
							// Simulate argument deltas
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\\"city\\""}\n\n',
								),
							)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":": \\"SF\\"}"}\n\n',
								),
							)
							// Simulate tool call completion
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","call_id":"call_123","name":"get_weather","arguments":"{\\"city\\": \\"SF\\"}"}}\n\n',
								),
							)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.done","response":{"usage":{"prompt_tokens":10,"completion_tokens":5}}}\n\n',
								),
							)
							controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
							controller.close()
						},
					}),
				})
				;(global as any).fetch = mockFetch as any
				mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

				const handler = new OpenAiNativeHandler({
					apiModelId: "gpt-4.1",
					openAiNativeApiKey: "test-api-key",
				})

				const stream = handler.createMessage("System", [{ role: "user", content: "What is the weather?" }])

				const chunks: any[] = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}

				// Should have: 1 initial tool_call_partial (from added), 2 deltas (tool_call_partial), 1 final tool_call (from done)
				const partialChunks = chunks.filter((c) => c.type === "tool_call_partial")
				const toolCallChunks = chunks.filter((c) => c.type === "tool_call")

				// First partial should have id and name (from output_item.added)
				expect(partialChunks.length).toBeGreaterThanOrEqual(1)
				expect(partialChunks[0]).toMatchObject({
					type: "tool_call_partial",
					index: 0,
					id: "call_123",
					name: "get_weather",
				})

				// Final tool_call should have complete arguments
				expect(toolCallChunks).toHaveLength(1)
				expect(toolCallChunks[0]).toMatchObject({
					type: "tool_call",
					id: "call_123",
					name: "get_weather",
					arguments: '{"city": "SF"}',
				})
			})

			it("should correlate delta events using output_index when call_id is not in delta", async () => {
				const mockFetch = vitest.fn().mockResolvedValue({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							// Tool call added with id and name
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.added","output_index":2,"item":{"type":"function_call","call_id":"call_abc","name":"read_file","arguments":""}}\n\n',
								),
							)
							// Delta without call_id - should use output_index to correlate
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.function_call_arguments.delta","output_index":2,"delta":"{\\"path\\":\\"test.txt\\"}"}\n\n',
								),
							)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.done","output_index":2,"item":{"type":"function_call","call_id":"call_abc","name":"read_file","arguments":"{\\"path\\":\\"test.txt\\"}"}}\n\n',
								),
							)
							controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
							controller.close()
						},
					}),
				})
				;(global as any).fetch = mockFetch as any
				mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

				const handler = new OpenAiNativeHandler({
					apiModelId: "gpt-4.1",
					openAiNativeApiKey: "test-api-key",
				})

				const stream = handler.createMessage("System", [{ role: "user", content: "Read test.txt" }])

				const chunks: any[] = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}

				const partialChunks = chunks.filter((c) => c.type === "tool_call_partial")

				// The delta should be correlated to the correct tool call via output_index
				// Find the delta chunk (has arguments but came after the initial)
				const deltaChunk = partialChunks.find((c) => c.arguments && c.arguments.length > 0)
				expect(deltaChunk).toBeDefined()
				expect(deltaChunk.index).toBe(2)
				// Should have id from the tracked mapping
				expect(deltaChunk.id).toBe("call_abc")
			})

			it("should handle multiple concurrent tool calls with different output indices", async () => {
				const mockFetch = vitest.fn().mockResolvedValue({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							// First tool call
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","call_id":"call_1","name":"tool_a","arguments":""}}\n\n',
								),
							)
							// Second tool call
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.added","output_index":1,"item":{"type":"function_call","call_id":"call_2","name":"tool_b","arguments":""}}\n\n',
								),
							)
							// Deltas for both (interleaved)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\\"a\\":"}\n\n',
								),
							)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.function_call_arguments.delta","output_index":1,"delta":"{\\"b\\":"}\n\n',
								),
							)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"1}"}\n\n',
								),
							)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.function_call_arguments.delta","output_index":1,"delta":"2}"}\n\n',
								),
							)
							// Done events
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","call_id":"call_1","name":"tool_a","arguments":"{\\"a\\":1}"}}\n\n',
								),
							)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.done","output_index":1,"item":{"type":"function_call","call_id":"call_2","name":"tool_b","arguments":"{\\"b\\":2}"}}\n\n',
								),
							)
							controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
							controller.close()
						},
					}),
				})
				;(global as any).fetch = mockFetch as any
				mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

				const handler = new OpenAiNativeHandler({
					apiModelId: "gpt-4.1",
					openAiNativeApiKey: "test-api-key",
				})

				const stream = handler.createMessage("System", [{ role: "user", content: "Do both" }])

				const chunks: any[] = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}

				const toolCallChunks = chunks.filter((c) => c.type === "tool_call")

				// Should have 2 complete tool calls
				expect(toolCallChunks).toHaveLength(2)
				expect(toolCallChunks[0]).toMatchObject({
					id: "call_1",
					name: "tool_a",
					arguments: '{"a":1}',
				})
				expect(toolCallChunks[1]).toMatchObject({
					id: "call_2",
					name: "tool_b",
					arguments: '{"b":2}',
				})
			})
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
