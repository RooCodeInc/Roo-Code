// npx vitest run api/providers/__tests__/openai-native.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"

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

		it("should handle non-streaming responses via SDK when stream=false", async () => {
			// Reconfigure handler to force non-stream (buildRequestBody sets stream = !openAiNativeUnverifiedOrg)
			handler = new OpenAiNativeHandler({
				...mockOptions,
				openAiNativeUnverifiedOrg: true, // => stream: false
			})

			// Mock SDK non-streaming JSON response
			mockResponsesCreate.mockResolvedValueOnce({
				id: "resp_nonstream_1",
				output: [
					{
						type: "message",
						content: [{ type: "output_text", text: "Non-streamed reply" }],
					},
				],
				usage: {
					input_tokens: 12,
					output_tokens: 7,
					cache_read_input_tokens: 0,
					cache_creation_input_tokens: 0,
				},
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify yielded content and usage from non-streaming path
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks[0]).toEqual({ type: "text", text: "Non-streamed reply" })
			const usage = chunks.find((c) => c.type === "usage")
			expect(usage).toBeTruthy()
			expect(usage.inputTokens).toBe(12)
			expect(usage.outputTokens).toBe(7)

			// Ensure SDK was called with stream=false and structured input
			expect(mockResponsesCreate).toHaveBeenCalledTimes(1)
			const body = mockResponsesCreate.mock.calls[0][0]
			expect(body.stream).toBe(false)
			expect(body.instructions).toBe(systemPrompt)
			expect(body.input).toEqual([{ role: "user", content: [{ type: "input_text", text: "Hello!" }] }])
		})

		it("should retry non-streaming when previous_response_id is invalid (400) and then succeed", async () => {
			// Reconfigure handler to force non-stream (stream=false)
			handler = new OpenAiNativeHandler({
				...mockOptions,
				openAiNativeUnverifiedOrg: true,
			})

			// First SDK call fails with 400 indicating previous_response_id not found
			const err: any = new Error("Previous response not found")
			err.status = 400
			err.response = { status: 400 }
			mockResponsesCreate.mockRejectedValueOnce(err).mockResolvedValueOnce({
				id: "resp_after_retry",
				output: [
					{
						type: "message",
						content: [{ type: "output_text", text: "Reply after retry" }],
					},
				],
				usage: {
					input_tokens: 9,
					output_tokens: 3,
					cache_read_input_tokens: 0,
					cache_creation_input_tokens: 0,
				},
			})

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "t-1",
				previousResponseId: "resp_invalid",
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Two SDK calls (retry path)
			expect(mockResponsesCreate).toHaveBeenCalledTimes(2)

			// First call: includes previous_response_id and only latest user message
			const firstBody = mockResponsesCreate.mock.calls[0][0]
			expect(firstBody.stream).toBe(false)
			expect(firstBody.previous_response_id).toBe("resp_invalid")
			expect(firstBody.input).toEqual([{ role: "user", content: [{ type: "input_text", text: "Hello!" }] }])

			// Second call (retry): no previous_response_id, includes full conversation (still single latest message in this test)
			const secondBody = mockResponsesCreate.mock.calls[1][0]
			expect(secondBody.stream).toBe(false)
			expect(secondBody.previous_response_id).toBeUndefined()
			expect(secondBody.instructions).toBe(systemPrompt)
			// With only one message in this suite, the "full conversation" equals the single user message
			expect(secondBody.input).toEqual([{ role: "user", content: [{ type: "input_text", text: "Hello!" }] }])

			// Verify yielded chunks from retry
			expect(chunks[0]).toEqual({ type: "text", text: "Reply after retry" })
			const usage = chunks.find((c) => c.type === "usage")
			expect(usage.inputTokens).toBe(9)
			expect(usage.outputTokens).toBe(3)
		})

		it("should NOT fallback to SSE when unverified org is true and non-stream SDK error occurs", async () => {
			// Force non-stream path via unverified org toggle
			handler = new OpenAiNativeHandler({
				...mockOptions,
				openAiNativeUnverifiedOrg: true, // => stream: false
			})

			// Make SDK throw a non-previous_response error (e.g., 500)
			const err: any = new Error("Some server error")
			err.status = 500
			err.response = { status: 500 }
			mockResponsesCreate.mockRejectedValueOnce(err)

			// Prepare a fetch mock to detect any unintended SSE fallback usage
			const mockFetch = vitest.fn()
			;(global as any).fetch = mockFetch as any

			const stream = handler.createMessage(systemPrompt, messages)

			// Expect iteration to reject and no SSE fallback to be attempted
			await expect(async () => {
				for await (const _ of stream) {
					// consume
				}
			}).rejects.toThrow("Some server error")

			// Ensure SSE fallback was NOT invoked
			expect(mockFetch).not.toHaveBeenCalled()
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
			expect(modelInfo.id).toBe("gpt-5-2025-08-07") // Default model
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
				apiModelId: "gpt-5-2025-08-07",
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
			expect(parsedBody.model).toBe("gpt-5-2025-08-07")
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
				apiModelId: "gpt-5-2025-08-07",
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
				apiModelId: "gpt-5-2025-08-07",
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
				apiModelId: "gpt-5-2025-08-07",
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
			expect(parsedBody.model).toBe("gpt-5-2025-08-07")
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
				apiModelId: "gpt-5-2025-08-07",
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
			expect(parsedBody.model).toBe("gpt-5-2025-08-07")
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
				apiModelId: "gpt-5-2025-08-07",
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
				apiModelId: "gpt-5-2025-08-07",
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

		it("should support previous_response_id for conversation continuity", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						// Include response ID in the response
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.created","response":{"id":"resp_123","status":"in_progress"}}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_item.added","item":{"type":"text","text":"Response with ID"}}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.done","response":{"id":"resp_123","usage":{"prompt_tokens":10,"completion_tokens":3}}}\n\n',
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
				apiModelId: "gpt-5-2025-08-07",
			})

			// First request - should not have previous_response_id
			const stream1 = handler.createMessage(systemPrompt, messages)
			const chunks1: any[] = []
			for await (const chunk of stream1) {
				chunks1.push(chunk)
			}

			// Verify first request doesn't include previous_response_id
			let firstCallBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(firstCallBody.previous_response_id).toBeUndefined()

			// Second request with metadata - should include previous_response_id
			const stream2 = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				previousResponseId: "resp_456",
			})
			const chunks2: any[] = []
			for await (const chunk of stream2) {
				chunks2.push(chunk)
			}

			// Verify second request includes the provided previous_response_id
			let secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body)
			expect(secondCallBody.previous_response_id).toBe("resp_456")
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
				apiModelId: "gpt-5-2025-08-07",
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

		it("should use stored response ID when metadata doesn't provide one", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							// First response with ID
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.done","response":{"id":"resp_789","output":[{"type":"text","content":[{"type":"text","text":"First"}]}],"usage":{"prompt_tokens":10,"completion_tokens":1}}}\n\n',
								),
							)
							controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
							controller.close()
						},
					}),
				})
				.mockResolvedValueOnce({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							// Second response
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.added","item":{"type":"text","text":"Second"}}\n\n',
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
				apiModelId: "gpt-5-2025-08-07",
			})

			// First request - establishes response ID
			const stream1 = handler.createMessage(systemPrompt, messages)
			for await (const chunk of stream1) {
				// consume stream
			}

			// Second request without metadata - should use stored response ID
			const stream2 = handler.createMessage(systemPrompt, messages, { taskId: "test-task" })
			for await (const chunk of stream2) {
				// consume stream
			}

			// Verify second request uses the stored response ID from first request
			let secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body)
			expect(secondCallBody.previous_response_id).toBe("resp_789")
		})

		it("should retry with full conversation when previous_response_id fails", async () => {
			// This test verifies the fix for context loss bug when previous_response_id becomes invalid
			const mockFetch = vitest
				.fn()
				// First call: fails with 400 error about invalid previous_response_id
				.mockResolvedValueOnce({
					ok: false,
					status: 400,
					text: async () => JSON.stringify({ error: { message: "Previous response not found" } }),
				})
				// Second call (retry): succeeds
				.mockResolvedValueOnce({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.added","item":{"type":"text","text":"Retry successful"}}\n\n',
								),
							)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.done","response":{"id":"resp_new","usage":{"prompt_tokens":100,"completion_tokens":2}}}\n\n',
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
				apiModelId: "gpt-5-2025-08-07",
			})

			// Prepare a multi-turn conversation
			const conversationMessages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "What is 2+2?" },
				{ role: "assistant", content: "2+2 equals 4." },
				{ role: "user", content: "What about 3+3?" },
				{ role: "assistant", content: "3+3 equals 6." },
				{ role: "user", content: "And 4+4?" }, // Latest message
			]

			// Call with a previous_response_id that will fail
			const stream = handler.createMessage(systemPrompt, conversationMessages, {
				taskId: "test-task",
				previousResponseId: "resp_invalid",
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify we got the successful response
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Retry successful")

			// Verify two requests were made
			expect(mockFetch).toHaveBeenCalledTimes(2)

			// First request: includes previous_response_id and only latest message
			const firstCallBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(firstCallBody.previous_response_id).toBe("resp_invalid")
			expect(firstCallBody.input).toEqual([
				{
					role: "user",
					content: [{ type: "input_text", text: "And 4+4?" }],
				},
			])

			// Second request (retry): NO previous_response_id, but FULL conversation history
			const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body)
			expect(secondCallBody.previous_response_id).toBeUndefined()
			expect(secondCallBody.instructions).toBe(systemPrompt)
			// Should include the FULL conversation history
			expect(secondCallBody.input).toEqual([
				{
					role: "user",
					content: [{ type: "input_text", text: "What is 2+2?" }],
				},
				{
					role: "assistant",
					content: [{ type: "output_text", text: "2+2 equals 4." }],
				},
				{
					role: "user",
					content: [{ type: "input_text", text: "What about 3+3?" }],
				},
				{
					role: "assistant",
					content: [{ type: "output_text", text: "3+3 equals 6." }],
				},
				{
					role: "user",
					content: [{ type: "input_text", text: "And 4+4?" }],
				},
			])
		})

		it("should retry with full conversation when SDK returns 400 for invalid previous_response_id", async () => {
			// Test the SDK path (executeRequest method) for handling invalid previous_response_id

			// Mock SDK to return an async iterable that we can control
			const createMockStream = (chunks: any[]) => {
				return {
					async *[Symbol.asyncIterator]() {
						for (const chunk of chunks) {
							yield chunk
						}
					},
				}
			}

			// First call: SDK throws 400 error
			mockResponsesCreate
				.mockRejectedValueOnce({
					status: 400,
					message: "Previous response resp_invalid not found",
				})
				// Second call (retry): SDK succeeds with async iterable
				.mockResolvedValueOnce(
					createMockStream([
						{ type: "response.text.delta", delta: "Context" },
						{ type: "response.text.delta", delta: " preserved!" },
						{
							type: "response.done",
							response: { id: "resp_new", usage: { prompt_tokens: 150, completion_tokens: 2 } },
						},
					]),
				)

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5-2025-08-07",
			})

			// Prepare a conversation with context
			const conversationMessages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Remember the number 42" },
				{ role: "assistant", content: "I'll remember 42." },
				{ role: "user", content: "What number did I ask you to remember?" },
			]

			// Call with a previous_response_id that will fail
			const stream = handler.createMessage(systemPrompt, conversationMessages, {
				taskId: "test-task",
				previousResponseId: "resp_invalid",
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify we got the successful response
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Context")
			expect(textChunks[1].text).toBe(" preserved!")

			// Verify two SDK calls were made
			expect(mockResponsesCreate).toHaveBeenCalledTimes(2)

			// First SDK call: includes previous_response_id and only latest message
			const firstCallBody = mockResponsesCreate.mock.calls[0][0]
			expect(firstCallBody.previous_response_id).toBe("resp_invalid")
			expect(firstCallBody.input).toEqual([
				{
					role: "user",
					content: [{ type: "input_text", text: "What number did I ask you to remember?" }],
				},
			])

			// Second SDK call (retry): NO previous_response_id, but FULL conversation history
			const secondCallBody = mockResponsesCreate.mock.calls[1][0]
			expect(secondCallBody.previous_response_id).toBeUndefined()
			expect(secondCallBody.instructions).toBe(systemPrompt)
			// Should include the FULL conversation history to preserve context
			expect(secondCallBody.input).toEqual([
				{
					role: "user",
					content: [{ type: "input_text", text: "Remember the number 42" }],
				},
				{
					role: "assistant",
					content: [{ type: "output_text", text: "I'll remember 42." }],
				},
				{
					role: "user",
					content: [{ type: "input_text", text: "What number did I ask you to remember?" }],
				},
			])
		})

		it("should only send latest message when using previous_response_id", async () => {
			// Mock fetch for Responses API
			const mockFetch = vitest
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							// First response with ID
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.done","response":{"id":"resp_001","output":[{"type":"text","content":[{"type":"text","text":"First"}]}],"usage":{"prompt_tokens":50,"completion_tokens":1}}}\n\n',
								),
							)
							controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
							controller.close()
						},
					}),
				})
				.mockResolvedValueOnce({
					ok: true,
					body: new ReadableStream({
						start(controller) {
							// Second response
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.output_item.added","item":{"type":"text","text":"Second"}}\n\n',
								),
							)
							controller.enqueue(
								new TextEncoder().encode(
									'data: {"type":"response.done","response":{"id":"resp_002","usage":{"prompt_tokens":10,"completion_tokens":1}}}\n\n',
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
				apiModelId: "gpt-5-2025-08-07",
			})

			// First request with full conversation
			const firstMessages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
				{ role: "user", content: "How are you?" },
			]

			const stream1 = handler.createMessage(systemPrompt, firstMessages)
			for await (const chunk of stream1) {
				// consume stream
			}

			// Verify first request sends full conversation in structured format
			let firstCallBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(firstCallBody.instructions).toBe(systemPrompt)
			expect(firstCallBody.input).toEqual([
				{
					role: "user",
					content: [{ type: "input_text", text: "Hello" }],
				},
				{
					role: "assistant",
					content: [{ type: "output_text", text: "Hi there!" }],
				},
				{
					role: "user",
					content: [{ type: "input_text", text: "How are you?" }],
				},
			])
			expect(firstCallBody.previous_response_id).toBeUndefined()

			// Second request with previous_response_id - should only send latest message
			const secondMessages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
				{ role: "user", content: "How are you?" },
				{ role: "assistant", content: "I'm doing well!" },
				{ role: "user", content: "What's the weather?" }, // Latest message
			]

			const stream2 = handler.createMessage(systemPrompt, secondMessages, {
				taskId: "test-task",
				previousResponseId: "resp_001",
			})
			for await (const chunk of stream2) {
				// consume stream
			}

			// Verify second request only sends the latest user message in structured format
			let secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body)
			expect(secondCallBody.input).toEqual([
				{
					role: "user",
					content: [{ type: "input_text", text: "What's the weather?" }],
				},
			])
			expect(secondCallBody.previous_response_id).toBe("resp_001")
		})

		it("should correctly prepare structured input", () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5-2025-08-07",
			})

			// Test with metadata that has previousResponseId
			// @ts-expect-error - private method
			const { formattedInput, previousResponseId } = gpt5Handler.prepareStructuredInput(systemPrompt, messages, {
				taskId: "task1",
				previousResponseId: "resp_123",
			})

			expect(previousResponseId).toBe("resp_123")
			expect(formattedInput).toEqual([
				{
					role: "user",
					content: [{ type: "input_text", text: "Hello!" }],
				},
			])
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
					apiModelId: "gpt-5-2025-08-07",
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
			apiModelId: "gpt-5-2025-08-07",
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
			apiModelId: "gpt-5-2025-08-07",
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
			apiModelId: "gpt-5-2025-08-07",
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

describe("Unverified org gating behavior", () => {
	beforeEach(() => {
		// Ensure call counts don't accumulate from previous test suites
		mockResponsesCreate.mockClear()
		// Ensure no SSE fallback interference
		if ((global as any).fetch) {
			delete (global as any).fetch
		}
	})

	afterEach(() => {
		// Clean up any accidental fetch mocks
		if ((global as any).fetch) {
			delete (global as any).fetch
		}
	})

	it("omits reasoning.summary in createMessage request when unverified org is true (GPT-5)", async () => {
		// Arrange
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5-2025-08-07",
			openAiNativeApiKey: "test-api-key",
			openAiNativeUnverifiedOrg: true, // => stream=false, and summary must be omitted
		})

		// SDK returns a minimal valid non-stream response
		mockResponsesCreate.mockResolvedValueOnce({
			id: "resp_nonstream_2",
			output: [],
			usage: { input_tokens: 1, output_tokens: 1 },
		})

		// Act
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello!" }]
		const stream = handler.createMessage(systemPrompt, messages)
		for await (const _ of stream) {
			// drain
		}

		// Assert
		expect(mockResponsesCreate).toHaveBeenCalledTimes(1)
		const body = mockResponsesCreate.mock.calls[0][0]
		expect(body.model).toBe("gpt-5-2025-08-07")
		expect(body.stream).toBe(false)
		// GPT-5 includes reasoning effort; summary must be omitted for unverified orgs
		expect(body.reasoning?.effort).toBeDefined()
		expect(body.reasoning?.summary).toBeUndefined()
	})

	it("omits reasoning.summary in completePrompt request when unverified org is true (GPT-5)", async () => {
		// Arrange
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5-2025-08-07",
			openAiNativeApiKey: "test-api-key",
			openAiNativeUnverifiedOrg: true, // => summary must be omitted in completePrompt too
		})

		// SDK returns a non-stream completion
		mockResponsesCreate.mockResolvedValueOnce({
			output: [
				{
					type: "message",
					content: [{ type: "output_text", text: "Completion" }],
				},
			],
		})

		// Act
		const result = await handler.completePrompt("Prompt text")

		// Assert
		expect(result).toBe("Completion")
		expect(mockResponsesCreate).toHaveBeenCalledTimes(1)
		const body = mockResponsesCreate.mock.calls[0][0]
		expect(body.model).toBe("gpt-5-2025-08-07")
		expect(body.stream).toBe(false)
		expect(body.store).toBe(false)
		// Reasoning present, but summary must be omitted
		expect(body.reasoning?.effort).toBeDefined()
		expect(body.reasoning?.summary).toBeUndefined()
	})
})
