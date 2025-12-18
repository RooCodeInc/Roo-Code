/**
 * @fileoverview Tests for the withLogging generator wrapper
 */

import { withLogging } from "../with-logging"
import { ApiLogger } from "../api-logger"
import type { ApiStream, ApiStreamChunk } from "../../../transform/stream"

// Mock the ApiLogger
vi.mock("../api-logger", () => ({
	ApiLogger: {
		logRequest: vi.fn(() => "mock-request-id"),
		logResponse: vi.fn(),
		logError: vi.fn(),
	},
}))

describe("withLogging", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	const baseContext = {
		provider: "test-provider",
		model: "test-model",
		operation: "createMessage" as const,
		taskId: "task-123",
	}

	const baseRequest = {
		messageCount: 5,
		hasTools: true,
		stream: true,
	}

	async function* createMockStream(chunks: ApiStreamChunk[]): ApiStream {
		for (const chunk of chunks) {
			yield chunk
		}
	}

	async function collectStream(stream: ApiStream): Promise<ApiStreamChunk[]> {
		const chunks: ApiStreamChunk[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}
		return chunks
	}

	describe("basic functionality", () => {
		it("should yield all chunks from the wrapped generator", async () => {
			const inputChunks: ApiStreamChunk[] = [
				{ type: "text", text: "Hello " },
				{ type: "text", text: "World" },
			]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () =>
				createMockStream(inputChunks),
			)

			const outputChunks = await collectStream(stream)

			expect(outputChunks).toEqual(inputChunks)
		})

		it("should log request before iterating", async () => {
			const stream = withLogging({ context: baseContext, request: baseRequest }, () =>
				createMockStream([{ type: "text", text: "Test" }]),
			)

			// Request should be logged when generator starts
			const iterator = stream[Symbol.asyncIterator]()
			await iterator.next()

			expect(ApiLogger.logRequest).toHaveBeenCalledWith(baseContext, baseRequest)
		})

		it("should log response after stream completes", async () => {
			const chunks: ApiStreamChunk[] = [
				{ type: "text", text: "Hello" },
				{ type: "usage", inputTokens: 100, outputTokens: 50 },
			]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream(chunks))

			await collectStream(stream)

			expect(ApiLogger.logResponse).toHaveBeenCalledWith("mock-request-id", baseContext, {
				textLength: 5,
				reasoningLength: undefined,
				toolCallCount: undefined,
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					cacheReadTokens: undefined,
					cacheWriteTokens: undefined,
					reasoningTokens: undefined,
					totalCost: undefined,
				},
			})
		})
	})

	describe("metrics tracking", () => {
		it("should track text length across multiple chunks", async () => {
			const chunks: ApiStreamChunk[] = [
				{ type: "text", text: "Hello " },
				{ type: "text", text: "World" },
				{ type: "text", text: "!" },
			]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream(chunks))

			await collectStream(stream)

			expect(ApiLogger.logResponse).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({ textLength: 12 }), // "Hello World!"
			)
		})

		it("should track reasoning length from reasoning chunks", async () => {
			const chunks: ApiStreamChunk[] = [
				{ type: "reasoning", text: "Let me think..." },
				{ type: "reasoning", text: " More thinking." },
				{ type: "text", text: "Here's my answer" },
			]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream(chunks))

			await collectStream(stream)

			expect(ApiLogger.logResponse).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({
					textLength: 16,
					reasoningLength: 30, // "Let me think... More thinking."
				}),
			)
		})

		it("should count tool_call chunks", async () => {
			const chunks: ApiStreamChunk[] = [
				{ type: "tool_call", id: "call1", name: "read_file", arguments: "{}" },
				{ type: "tool_call", id: "call2", name: "write_file", arguments: "{}" },
			]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream(chunks))

			await collectStream(stream)

			expect(ApiLogger.logResponse).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({ toolCallCount: 2 }),
			)
		})

		it("should count tool_call_start chunks", async () => {
			const chunks: ApiStreamChunk[] = [
				{ type: "tool_call_start", id: "call1", name: "read_file" },
				{ type: "tool_call_delta", id: "call1", delta: '{"path":' },
				{ type: "tool_call_end", id: "call1" },
				{ type: "tool_call_start", id: "call2", name: "write_file" },
				{ type: "tool_call_end", id: "call2" },
			]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream(chunks))

			await collectStream(stream)

			// Only tool_call_start chunks should be counted
			expect(ApiLogger.logResponse).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({ toolCallCount: 2 }),
			)
		})

		it("should capture usage metrics from usage chunk", async () => {
			const chunks: ApiStreamChunk[] = [
				{ type: "text", text: "Response" },
				{
					type: "usage",
					inputTokens: 500,
					outputTokens: 200,
					cacheReadTokens: 100,
					cacheWriteTokens: 50,
					reasoningTokens: 30,
					totalCost: 0.01,
				},
			]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream(chunks))

			await collectStream(stream)

			expect(ApiLogger.logResponse).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({
					usage: {
						inputTokens: 500,
						outputTokens: 200,
						cacheReadTokens: 100,
						cacheWriteTokens: 50,
						reasoningTokens: 30,
						totalCost: 0.01,
					},
				}),
			)
		})

		it("should handle stream with no usage chunk", async () => {
			const chunks: ApiStreamChunk[] = [{ type: "text", text: "Response without usage" }]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream(chunks))

			await collectStream(stream)

			expect(ApiLogger.logResponse).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({ usage: undefined }),
			)
		})
	})

	describe("error handling", () => {
		it("should log error when generator throws", async () => {
			const testError = new Error("API rate limit exceeded")
			;(testError as Error & { status?: number }).status = 429

			async function* failingGenerator(): ApiStream {
				yield { type: "text", text: "Starting..." }
				throw testError
			}

			const stream = withLogging({ context: baseContext, request: baseRequest }, failingGenerator)

			await expect(collectStream(stream)).rejects.toThrow("API rate limit exceeded")

			expect(ApiLogger.logError).toHaveBeenCalledWith("mock-request-id", baseContext, {
				message: "API rate limit exceeded",
				code: 429,
			})
		})

		it("should extract error code from status property", async () => {
			const testError = new Error("Server error")
			;(testError as Error & { status?: number }).status = 500

			// eslint-disable-next-line require-yield
			async function* failingGenerator(): ApiStream {
				throw testError
			}

			const stream = withLogging({ context: baseContext, request: baseRequest }, failingGenerator)

			await expect(collectStream(stream)).rejects.toThrow()

			expect(ApiLogger.logError).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({ code: 500 }),
			)
		})

		it("should extract error code from code property", async () => {
			const testError = new Error("Connection error")
			;(testError as Error & { code?: string }).code = "ECONNREFUSED"

			// eslint-disable-next-line require-yield
			async function* failingGenerator(): ApiStream {
				throw testError
			}

			const stream = withLogging({ context: baseContext, request: baseRequest }, failingGenerator)

			await expect(collectStream(stream)).rejects.toThrow()

			expect(ApiLogger.logError).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({ code: "ECONNREFUSED" }),
			)
		})

		it("should handle non-Error throws", async () => {
			// eslint-disable-next-line require-yield
			async function* failingGenerator(): ApiStream {
				throw "string error"
			}

			const stream = withLogging({ context: baseContext, request: baseRequest }, failingGenerator)

			await expect(collectStream(stream)).rejects.toBe("string error")

			expect(ApiLogger.logError).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({ message: "string error" }),
			)
		})

		it("should re-throw the original error", async () => {
			const originalError = new Error("Original error")

			// eslint-disable-next-line require-yield
			async function* failingGenerator(): ApiStream {
				throw originalError
			}

			const stream = withLogging({ context: baseContext, request: baseRequest }, failingGenerator)

			try {
				await collectStream(stream)
				expect.fail("Should have thrown")
			} catch (error) {
				expect(error).toBe(originalError)
			}
		})

		it("should not log response when error occurs", async () => {
			// eslint-disable-next-line require-yield
			async function* failingGenerator(): ApiStream {
				throw new Error("Failed")
			}

			const stream = withLogging({ context: baseContext, request: baseRequest }, failingGenerator)

			await expect(collectStream(stream)).rejects.toThrow()

			expect(ApiLogger.logResponse).not.toHaveBeenCalled()
		})
	})

	describe("edge cases", () => {
		it("should handle empty stream", async () => {
			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream([]))

			const chunks = await collectStream(stream)

			expect(chunks).toEqual([])
			expect(ApiLogger.logResponse).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({
					textLength: 0,
					reasoningLength: undefined,
					toolCallCount: undefined,
				}),
			)
		})

		it("should handle stream with only usage chunk", async () => {
			const chunks: ApiStreamChunk[] = [{ type: "usage", inputTokens: 10, outputTokens: 5 }]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream(chunks))

			await collectStream(stream)

			expect(ApiLogger.logResponse).toHaveBeenCalledWith(
				"mock-request-id",
				baseContext,
				expect.objectContaining({
					usage: expect.objectContaining({
						inputTokens: 10,
						outputTokens: 5,
					}),
				}),
			)
		})

		it("should handle grounding chunks without tracking them", async () => {
			const chunks: ApiStreamChunk[] = [
				{ type: "text", text: "Answer with source" },
				{ type: "grounding", sources: [{ title: "Source", url: "https://example.com" }] },
			]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream(chunks))

			const outputChunks = await collectStream(stream)

			expect(outputChunks).toEqual(chunks)
			expect(ApiLogger.logResponse).toHaveBeenCalled()
		})

		it("should handle error chunks without stopping the stream", async () => {
			const chunks: ApiStreamChunk[] = [
				{ type: "text", text: "Partial response" },
				{ type: "error", error: "PARTIAL_ERROR", message: "Something went wrong" },
			]

			const stream = withLogging({ context: baseContext, request: baseRequest }, () => createMockStream(chunks))

			const outputChunks = await collectStream(stream)

			expect(outputChunks).toEqual(chunks)
			// Should still log as response (not as error), since stream completed normally
			expect(ApiLogger.logResponse).toHaveBeenCalled()
			expect(ApiLogger.logError).not.toHaveBeenCalled()
		})
	})
})
