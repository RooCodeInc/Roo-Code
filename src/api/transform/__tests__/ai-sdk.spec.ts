import OpenAI from "openai"
import {
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	consumeAiSdkStream,
	mapToolChoice,
	extractAiSdkErrorMessage,
	extractMessageFromResponseBody,
	handleAiSdkError,
	flattenAiSdkMessagesToStringContent,
} from "../ai-sdk"

vitest.mock("ai", () => ({
	tool: vitest.fn((t) => t),
	jsonSchema: vitest.fn((s) => s),
}))

describe("AI SDK conversion utilities", () => {
	describe("convertToolsForAiSdk", () => {
		it("returns undefined for empty tools", () => {
			expect(convertToolsForAiSdk(undefined)).toBeUndefined()
			expect(convertToolsForAiSdk([])).toBeUndefined()
		})

		it("converts function tools to AI SDK format", () => {
			const tools: OpenAI.Chat.ChatCompletionTool[] = [
				{
					type: "function",
					function: {
						name: "read_file",
						description: "Read a file from disk",
						parameters: {
							type: "object",
							properties: {
								path: { type: "string", description: "File path" },
							},
							required: ["path"],
						},
					},
				},
			]

			const result = convertToolsForAiSdk(tools)

			expect(result).toBeDefined()
			expect(result!.read_file).toBeDefined()
			expect(result!.read_file.description).toBe("Read a file from disk")
		})

		it("converts multiple tools", () => {
			const tools: OpenAI.Chat.ChatCompletionTool[] = [
				{
					type: "function",
					function: {
						name: "read_file",
						description: "Read a file",
						parameters: {},
					},
				},
				{
					type: "function",
					function: {
						name: "write_file",
						description: "Write a file",
						parameters: {},
					},
				},
			]

			const result = convertToolsForAiSdk(tools)

			expect(result).toBeDefined()
			expect(Object.keys(result!)).toHaveLength(2)
			expect(result!.read_file).toBeDefined()
			expect(result!.write_file).toBeDefined()
		})
	})

	describe("processAiSdkStreamPart", () => {
		it("processes text-delta chunks", () => {
			const part = { type: "text-delta" as const, id: "1", text: "Hello" }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "text", text: "Hello" })
		})

		it("processes text chunks (fullStream format)", () => {
			const part = { type: "text" as const, text: "Hello from fullStream" }
			const chunks = [...processAiSdkStreamPart(part as any)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "text", text: "Hello from fullStream" })
		})

		it("processes reasoning-delta chunks", () => {
			const part = { type: "reasoning-delta" as const, id: "1", text: "thinking..." }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "reasoning", text: "thinking..." })
		})

		it("processes reasoning chunks (fullStream format)", () => {
			const part = { type: "reasoning" as const, text: "reasoning from fullStream" }
			const chunks = [...processAiSdkStreamPart(part as any)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "reasoning", text: "reasoning from fullStream" })
		})

		it("processes tool-input-start chunks", () => {
			const part = { type: "tool-input-start" as const, id: "call_1", toolName: "read_file" }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "tool_call_start", id: "call_1", name: "read_file" })
		})

		it("processes tool-input-delta chunks", () => {
			const part = { type: "tool-input-delta" as const, id: "call_1", delta: '{"path":' }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "tool_call_delta", id: "call_1", delta: '{"path":' })
		})

		it("processes tool-input-end chunks", () => {
			const part = { type: "tool-input-end" as const, id: "call_1" }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({ type: "tool_call_end", id: "call_1" })
		})

		it("ignores tool-call chunks to prevent duplicate tools in UI", () => {
			// tool-call is intentionally ignored because tool-input-start/delta/end already
			// provide complete tool call information. Emitting tool-call would cause duplicate
			// tools in the UI for AI SDK providers (e.g., DeepSeek, Moonshot).
			const part = {
				type: "tool-call" as const,
				toolCallId: "call_1",
				toolName: "read_file",
				input: { path: "test.ts" },
			}
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(0)
		})

		it("processes source chunks with URL", () => {
			const part = {
				type: "source" as const,
				url: "https://example.com",
				title: "Example Source",
			}
			const chunks = [...processAiSdkStreamPart(part as any)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({
				type: "grounding",
				sources: [
					{
						title: "Example Source",
						url: "https://example.com",
						snippet: undefined,
					},
				],
			})
		})

		it("processes error chunks", () => {
			const part = { type: "error" as const, error: new Error("Test error") }
			const chunks = [...processAiSdkStreamPart(part)]

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({
				type: "error",
				error: "StreamError",
				message: "Test error",
			})
		})

		it("ignores lifecycle events", () => {
			const lifecycleEvents = [
				{ type: "text-start" as const },
				{ type: "text-end" as const },
				{ type: "reasoning-start" as const },
				{ type: "reasoning-end" as const },
				{ type: "start-step" as const },
				{ type: "finish-step" as const },
				{ type: "start" as const },
				{ type: "finish" as const },
				{ type: "abort" as const },
			]

			for (const event of lifecycleEvents) {
				const chunks = [...processAiSdkStreamPart(event as any)]
				expect(chunks).toHaveLength(0)
			}
		})
		it("should filter [REDACTED] from reasoning-delta parts", () => {
			const redactedPart = { type: "reasoning-delta" as const, text: "[REDACTED]" }
			const normalPart = { type: "reasoning-delta" as const, text: "actual reasoning" }

			const redactedResult = [...processAiSdkStreamPart(redactedPart as any)]
			const normalResult = [...processAiSdkStreamPart(normalPart as any)]

			expect(redactedResult).toEqual([])
			expect(normalResult).toEqual([{ type: "reasoning", text: "actual reasoning" }])
		})

		it("should filter [REDACTED] from reasoning (fullStream format) parts", () => {
			const redactedPart = { type: "reasoning" as const, text: "[REDACTED]" }
			const normalPart = { type: "reasoning" as const, text: "actual reasoning" }

			const redactedResult = [...processAiSdkStreamPart(redactedPart as any)]
			const normalResult = [...processAiSdkStreamPart(normalPart as any)]

			expect(redactedResult).toEqual([])
			expect(normalResult).toEqual([{ type: "reasoning", text: "actual reasoning" }])
		})
	})

	describe("mapToolChoice", () => {
		it("should return undefined for null or undefined", () => {
			expect(mapToolChoice(null)).toBeUndefined()
			expect(mapToolChoice(undefined)).toBeUndefined()
		})

		it("should handle string tool choices", () => {
			expect(mapToolChoice("auto")).toBe("auto")
			expect(mapToolChoice("none")).toBe("none")
			expect(mapToolChoice("required")).toBe("required")
		})

		it("should return auto for unknown string values", () => {
			expect(mapToolChoice("unknown")).toBe("auto")
			expect(mapToolChoice("invalid")).toBe("auto")
		})

		it("should handle object tool choice with function name", () => {
			const result = mapToolChoice({
				type: "function",
				function: { name: "my_tool" },
			})

			expect(result).toEqual({ type: "tool", toolName: "my_tool" })
		})

		it("should return undefined for object without function name", () => {
			const result = mapToolChoice({
				type: "function",
				function: {},
			})

			expect(result).toBeUndefined()
		})

		it("should return undefined for object with non-function type", () => {
			const result = mapToolChoice({
				type: "other",
				function: { name: "my_tool" },
			})

			expect(result).toBeUndefined()
		})
	})

	describe("extractAiSdkErrorMessage", () => {
		it("should return 'Unknown error' for null/undefined", () => {
			expect(extractAiSdkErrorMessage(null)).toBe("Unknown error")
			expect(extractAiSdkErrorMessage(undefined)).toBe("Unknown error")
		})

		it("should extract message from AI_RetryError", () => {
			const retryError = {
				name: "AI_RetryError",
				message: "Failed after 3 attempts",
				errors: [new Error("Error 1"), new Error("Error 2"), new Error("Too Many Requests")],
				lastError: { message: "Too Many Requests", status: 429 },
			}

			const result = extractAiSdkErrorMessage(retryError)
			expect(result).toBe("Failed after 3 attempts (429): Too Many Requests")
		})

		it("should handle AI_RetryError without status", () => {
			const retryError = {
				name: "AI_RetryError",
				message: "Failed after 2 attempts",
				errors: [new Error("Error 1"), new Error("Connection failed")],
				lastError: { message: "Connection failed" },
			}

			const result = extractAiSdkErrorMessage(retryError)
			expect(result).toBe("Failed after 2 attempts: Connection failed")
		})

		it("should extract message from AI_APICallError", () => {
			const apiError = {
				name: "AI_APICallError",
				message: "Rate limit exceeded",
				status: 429,
			}

			const result = extractAiSdkErrorMessage(apiError)
			// No responseBody present — new behavior reports that instead of using error.message
			expect(result).toBe("API Error (429): No response body available")
		})

		it("should handle AI_APICallError without status", () => {
			const apiError = {
				name: "AI_APICallError",
				message: "Connection timeout",
			}

			const result = extractAiSdkErrorMessage(apiError)
			// No responseBody, no status — new behavior reports missing body
			expect(result).toBe("API Error: No response body available")
		})

		it("should extract message from standard Error", () => {
			const error = new Error("Something went wrong")
			expect(extractAiSdkErrorMessage(error)).toBe("Something went wrong")
		})

		it("should convert non-Error to string", () => {
			expect(extractAiSdkErrorMessage("string error")).toBe("string error")
			expect(extractAiSdkErrorMessage({ custom: "object" })).toBe("[object Object]")
		})

		it("should extract message from AI_APICallError responseBody with JSON error", () => {
			const apiError = {
				name: "AI_APICallError",
				message: "API call failed",
				responseBody: '{"error":{"message":"Insufficient balance or no resource package.","code":"1113"}}',
				statusCode: 402,
			}

			const result = extractAiSdkErrorMessage(apiError)
			expect(result).toContain("Insufficient balance")
			expect(result).not.toBe("API call failed")
		})

		it("should include raw responseBody when AI_APICallError responseBody is non-JSON", () => {
			const apiError = {
				name: "AI_APICallError",
				message: "Server error",
				responseBody: "Internal Server Error",
				statusCode: 500,
			}

			const result = extractAiSdkErrorMessage(apiError)
			// New behavior: raw responseBody is included instead of falling back to error.message
			expect(result).toBe("API Error (500): Internal Server Error")
		})

		it("should extract message from AI_RetryError lastError responseBody", () => {
			const retryError = {
				name: "AI_RetryError",
				message: "Failed after retries",
				lastError: {
					name: "AI_APICallError",
					message: "API call failed",
					responseBody: '{"error":{"message":"Rate limit exceeded"}}',
					statusCode: 429,
				},
				errors: [{}],
			}

			const result = extractAiSdkErrorMessage(retryError)
			expect(result).toContain("Rate limit exceeded")
		})

		it("should extract message from NoOutputGeneratedError with APICallError cause", () => {
			const error = {
				name: "AI_NoOutputGeneratedError",
				message: "No output generated",
				cause: {
					name: "AI_APICallError",
					message: "Forbidden",
					responseBody: '{"error":{"message":"Insufficient balance"}}',
					statusCode: 403,
				},
			}

			const result = extractAiSdkErrorMessage(error)
			expect(result).toContain("Insufficient balance")
			expect(result).not.toBe("No output generated")
		})

		it("should return own message from NoOutputGeneratedError without useful cause", () => {
			const error = {
				name: "AI_NoOutputGeneratedError",
				message: "No output generated",
			}

			const result = extractAiSdkErrorMessage(error)
			expect(result).toBe("No output generated")
		})
	})

	describe("handleAiSdkError", () => {
		it("should wrap error with provider name", () => {
			const error = new Error("API Error")
			const result = handleAiSdkError(error, "Fireworks")

			expect(result.message).toBe("Fireworks: API Error")
		})

		it("should preserve status code from AI_RetryError", () => {
			const retryError = {
				name: "AI_RetryError",
				errors: [new Error("Too Many Requests")],
				lastError: { message: "Too Many Requests", status: 429 },
			}

			const result = handleAiSdkError(retryError, "SambaNova")

			expect(result.message).toContain("SambaNova:")
			expect(result.message).toContain("429")
			expect((result as any).status).toBe(429)
		})

		it("should preserve status code from AI_APICallError", () => {
			const apiError = {
				name: "AI_APICallError",
				message: "Unauthorized",
				status: 401,
			}

			const result = handleAiSdkError(apiError, "DeepSeek")

			expect(result.message).toContain("DeepSeek:")
			expect(result.message).toContain("401")
			expect((result as any).status).toBe(401)
		})

		it("should preserve original error as cause", () => {
			const originalError = new Error("Original error")
			const result = handleAiSdkError(originalError, "Mistral")

			expect((result as any).cause).toBe(originalError)
		})

		it("should call onError with extracted message and original error", () => {
			const originalError = new Error("Quota exceeded")
			const onError = vi.fn()

			handleAiSdkError(originalError, "Gemini", { onError })

			expect(onError).toHaveBeenCalledOnce()
			expect(onError).toHaveBeenCalledWith("Quota exceeded", originalError)
		})

		it("should use formatMessage to override default message format", () => {
			const error = new Error("Rate limit hit")
			const formatMessage = (msg: string) => `Custom: ${msg}`

			const result = handleAiSdkError(error, "Vertex", { formatMessage })

			expect(result.message).toBe("Custom: Rate limit hit")
		})

		it("should call onError and use formatMessage together", () => {
			const originalError = {
				name: "AI_APICallError",
				message: "Forbidden",
				status: 403,
			}
			const onError = vi.fn()
			const formatMessage = (msg: string) => `Translated: ${msg}`

			const result = handleAiSdkError(originalError, "Gemini", { onError, formatMessage })

			// onError receives the extracted message
			expect(onError).toHaveBeenCalledOnce()
			expect(onError.mock.calls[0][0]).toContain("403")
			expect(onError.mock.calls[0][1]).toBe(originalError)

			// formatMessage overrides the thrown message
			expect(result.message).toMatch(/^Translated:/)

			// Status code is still preserved
			expect((result as any).status).toBe(403)
		})

		it("should use default format when no options are provided", () => {
			const error = new Error("Something broke")
			const result = handleAiSdkError(error, "TestProvider")

			expect(result.message).toBe("TestProvider: Something broke")
		})
	})

	describe("extractMessageFromResponseBody", () => {
		it("should extract message with code from error object", () => {
			const body = '{"error": {"message": "Insufficient balance", "code": "1113"}}'
			expect(extractMessageFromResponseBody(body)).toBe("[1113] Insufficient balance")
		})

		it("should extract message from error object without code", () => {
			const body = '{"error": {"message": "Rate limit exceeded"}}'
			expect(extractMessageFromResponseBody(body)).toBe("Rate limit exceeded")
		})

		it("should extract message from error string field", () => {
			const body = '{"error": "Something went wrong"}'
			expect(extractMessageFromResponseBody(body)).toBe("Something went wrong")
		})

		it("should extract message from top-level message field", () => {
			const body = '{"message": "Bad request"}'
			expect(extractMessageFromResponseBody(body)).toBe("Bad request")
		})

		it("should return undefined for non-JSON string", () => {
			expect(extractMessageFromResponseBody("Not Found")).toBeUndefined()
		})

		it("should return undefined for empty string", () => {
			expect(extractMessageFromResponseBody("")).toBeUndefined()
		})

		it("should return undefined for JSON without error fields", () => {
			const body = '{"status": "ok"}'
			expect(extractMessageFromResponseBody(body)).toBeUndefined()
		})
	})

	describe("flattenAiSdkMessagesToStringContent", () => {
		it("should return messages unchanged if content is already a string", () => {
			const messages = [
				{ role: "user" as const, content: "Hello" },
				{ role: "assistant" as const, content: "Hi there" },
			]

			const result = flattenAiSdkMessagesToStringContent(messages)

			expect(result).toEqual(messages)
		})

		it("should flatten user messages with only text parts to string", () => {
			const messages = [
				{
					role: "user" as const,
					content: [
						{ type: "text" as const, text: "Hello" },
						{ type: "text" as const, text: "World" },
					],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages)

			expect(result).toHaveLength(1)
			expect(result[0].role).toBe("user")
			expect(result[0].content).toBe("Hello\nWorld")
		})

		it("should flatten assistant messages with only text parts to string", () => {
			const messages = [
				{
					role: "assistant" as const,
					content: [{ type: "text" as const, text: "I am an assistant" }],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages)

			expect(result).toHaveLength(1)
			expect(result[0].role).toBe("assistant")
			expect(result[0].content).toBe("I am an assistant")
		})

		it("should not flatten user messages with image parts", () => {
			const messages = [
				{
					role: "user" as const,
					content: [
						{ type: "text" as const, text: "Look at this" },
						{ type: "image" as const, image: "data:image/png;base64,abc123" },
					],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages)

			expect(result).toEqual(messages)
		})

		it("should not flatten assistant messages with tool calls", () => {
			const messages = [
				{
					role: "assistant" as const,
					content: [
						{ type: "text" as const, text: "Let me use a tool" },
						{
							type: "tool-call" as const,
							toolCallId: "123",
							toolName: "read_file",
							input: { path: "test.txt" },
						},
					],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages)

			expect(result).toEqual(messages)
		})

		it("should not flatten tool role messages", () => {
			const messages = [
				{
					role: "tool" as const,
					content: [
						{
							type: "tool-result" as const,
							toolCallId: "123",
							toolName: "test",
							output: { type: "text" as const, value: "result" },
						},
					],
				},
			] as any

			const result = flattenAiSdkMessagesToStringContent(messages)

			expect(result).toEqual(messages)
		})

		it("should respect flattenUserMessages option", () => {
			const messages = [
				{
					role: "user" as const,
					content: [{ type: "text" as const, text: "Hello" }],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages, { flattenUserMessages: false })

			expect(result).toEqual(messages)
		})

		it("should respect flattenAssistantMessages option", () => {
			const messages = [
				{
					role: "assistant" as const,
					content: [{ type: "text" as const, text: "Hi" }],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages, { flattenAssistantMessages: false })

			expect(result).toEqual(messages)
		})

		it("should handle mixed message types correctly", () => {
			const messages = [
				{ role: "user" as const, content: "Simple string" },
				{
					role: "user" as const,
					content: [{ type: "text" as const, text: "Text parts" }],
				},
				{
					role: "assistant" as const,
					content: [{ type: "text" as const, text: "Assistant text" }],
				},
				{
					role: "assistant" as const,
					content: [
						{ type: "text" as const, text: "With tool" },
						{ type: "tool-call" as const, toolCallId: "456", toolName: "test", input: {} },
					],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages)

			expect(result[0].content).toBe("Simple string") // unchanged
			expect(result[1].content).toBe("Text parts") // flattened
			expect(result[2].content).toBe("Assistant text") // flattened
			expect(result[3]).toEqual(messages[3]) // unchanged (has tool call)
		})

		it("should handle empty text parts", () => {
			const messages = [
				{
					role: "user" as const,
					content: [
						{ type: "text" as const, text: "" },
						{ type: "text" as const, text: "Hello" },
					],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages)

			expect(result[0].content).toBe("\nHello")
		})

		it("should strip reasoning parts and flatten text for string-only models", () => {
			const messages = [
				{
					role: "assistant" as const,
					content: [
						{ type: "reasoning" as const, text: "I am thinking about this..." },
						{ type: "text" as const, text: "Here is my answer" },
					],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages)

			// Reasoning should be stripped, only text should remain
			expect(result[0].content).toBe("Here is my answer")
		})

		it("should handle messages with only reasoning parts", () => {
			const messages = [
				{
					role: "assistant" as const,
					content: [{ type: "reasoning" as const, text: "Only reasoning, no text" }],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages)

			// Should flatten to empty string when only reasoning is present
			expect(result[0].content).toBe("")
		})

		it("should not flatten if tool calls are present with reasoning", () => {
			const messages = [
				{
					role: "assistant" as const,
					content: [
						{ type: "reasoning" as const, text: "Thinking..." },
						{ type: "text" as const, text: "Using tool" },
						{ type: "tool-call" as const, toolCallId: "abc", toolName: "test", input: {} },
					],
				},
			]

			const result = flattenAiSdkMessagesToStringContent(messages)

			// Should not flatten because there's a tool call
			expect(result[0]).toEqual(messages[0])
		})
	})
})

describe("consumeAiSdkStream", () => {
	/**
	 * Helper to create an AsyncIterable from an array of stream parts.
	 */
	async function* createAsyncIterable<T>(items: T[]): AsyncGenerator<T> {
		for (const item of items) {
			yield item
		}
	}

	/**
	 * Helper to collect all chunks from an async generator.
	 * Returns { chunks, error } to support both success and error paths.
	 */
	async function collectStream(stream: AsyncGenerator<unknown>): Promise<{ chunks: unknown[]; error: Error | null }> {
		const chunks: unknown[] = []
		let error: Error | null = null
		try {
			for await (const chunk of stream) {
				chunks.push(chunk)
			}
		} catch (e) {
			error = e instanceof Error ? e : new Error(String(e))
		}
		return { chunks, error }
	}

	it("yields stream chunks from fullStream", async () => {
		const result = {
			fullStream: createAsyncIterable([
				{ type: "text-delta" as const, id: "1", text: "hello" },
				{ type: "text" as const, text: " world" },
			]),
			usage: Promise.resolve({ inputTokens: 5, outputTokens: 10 }),
		}

		const { chunks, error } = await collectStream(consumeAiSdkStream(result as any))

		expect(error).toBeNull()
		// Two text chunks + one usage chunk
		expect(chunks).toHaveLength(3)
		expect(chunks[0]).toEqual({ type: "text", text: "hello" })
		expect(chunks[1]).toEqual({ type: "text", text: " world" })
	})

	it("yields default usage chunk when no usageHandler provided", async () => {
		const result = {
			fullStream: createAsyncIterable([{ type: "text-delta" as const, id: "1", text: "hi" }]),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 20 }),
		}

		const { chunks, error } = await collectStream(consumeAiSdkStream(result as any))

		expect(error).toBeNull()
		const usageChunk = chunks.find((c: any) => c.type === "usage")
		expect(usageChunk).toEqual({
			type: "usage",
			inputTokens: 10,
			outputTokens: 20,
		})
	})

	it("uses usageHandler when provided", async () => {
		const result = {
			fullStream: createAsyncIterable([{ type: "text-delta" as const, id: "1", text: "hi" }]),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 20 }),
		}

		async function* customUsageHandler() {
			yield {
				type: "usage" as const,
				inputTokens: 42,
				outputTokens: 84,
				cacheWriteTokens: 5,
				cacheReadTokens: 3,
			}
		}

		const { chunks, error } = await collectStream(consumeAiSdkStream(result as any, customUsageHandler))

		expect(error).toBeNull()
		const usageChunk = chunks.find((c: any) => c.type === "usage")
		expect(usageChunk).toEqual({
			type: "usage",
			inputTokens: 42,
			outputTokens: 84,
			cacheWriteTokens: 5,
			cacheReadTokens: 3,
		})
	})

	/**
	 * THE KEY TEST: Verifies that when the stream contains an error chunk (e.g. "Insufficient balance")
	 * and result.usage rejects with a generic error (AI SDK's NoOutputGeneratedError), the thrown
	 * error preserves the specific stream error message rather than the generic one.
	 */
	it("captures stream error and throws it when usage fails", async () => {
		const usageRejection = Promise.reject(new Error("No output generated. Check the stream for errors."))
		// Prevent unhandled rejection warning — the rejection is intentionally caught inside consumeAiSdkStream
		usageRejection.catch(() => {})

		const result = {
			fullStream: createAsyncIterable([
				{ type: "text-delta" as const, id: "1", text: "partial" },
				{
					type: "error" as const,
					error: new Error("Insufficient balance to complete this request"),
				},
			]),
			usage: usageRejection,
		}

		const { chunks, error } = await collectStream(consumeAiSdkStream(result as any))

		// The error chunk IS still yielded during stream iteration
		const errorChunk = chunks.find((c: any) => c.type === "error")
		expect(errorChunk).toEqual({
			type: "error",
			error: "StreamError",
			message: "Insufficient balance to complete this request",
		})

		// The thrown error uses the captured stream error, NOT the generic usage error
		expect(error).not.toBeNull()
		expect(error!.message).toBe("Insufficient balance to complete this request")
		expect(error!.message).not.toContain("No output generated")
	})

	it("re-throws usage error when no stream error captured", async () => {
		const usageRejection = Promise.reject(new Error("Rate limit exceeded"))
		usageRejection.catch(() => {})

		const result = {
			fullStream: createAsyncIterable([{ type: "text-delta" as const, id: "1", text: "hello" }]),
			usage: usageRejection,
		}

		const { chunks, error } = await collectStream(consumeAiSdkStream(result as any))

		// Text chunk should still be yielded
		expect(chunks).toHaveLength(1)
		expect(chunks[0]).toEqual({ type: "text", text: "hello" })

		// The original usage error is re-thrown since no stream error was captured
		expect(error).not.toBeNull()
		expect(error!.message).toBe("Rate limit exceeded")
	})

	it("captures stream error and throws it when usageHandler fails", async () => {
		const result = {
			fullStream: createAsyncIterable([
				{ type: "text-delta" as const, id: "1", text: "partial" },
				{
					type: "error" as const,
					error: new Error("Insufficient balance to complete this request"),
				},
			]),
			usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
		}

		// eslint-disable-next-line require-yield
		async function* failingUsageHandler(): AsyncGenerator<never> {
			throw new Error("No output generated. Check the stream for errors.")
		}

		const { chunks, error } = await collectStream(consumeAiSdkStream(result as any, failingUsageHandler))

		// Error chunk was yielded during streaming
		const errorChunk = chunks.find((c: any) => c.type === "error")
		expect(errorChunk).toEqual({
			type: "error",
			error: "StreamError",
			message: "Insufficient balance to complete this request",
		})

		// The thrown error uses the captured stream error, not the usageHandler error
		expect(error).not.toBeNull()
		expect(error!.message).toBe("Insufficient balance to complete this request")
		expect(error!.message).not.toContain("No output generated")
	})
})

describe("Error extraction utilities", () => {
	describe("extractMessageFromResponseBody", () => {
		it("extracts message from OpenRouter-style error with error.metadata.raw", () => {
			const body = JSON.stringify({
				error: {
					message: "Provider returned error",
					code: 400,
					metadata: {
						raw: JSON.stringify({
							message: "A maximum of 4 blocks with cache_control may be provided. Found 5.",
						}),
						provider_name: "Amazon Bedrock",
					},
				},
			})

			const result = extractMessageFromResponseBody(body)
			expect(result).toBe("[Amazon Bedrock] A maximum of 4 blocks with cache_control may be provided. Found 5.")
		})

		it("extracts message from OpenRouter-style error without provider_name", () => {
			const body = JSON.stringify({
				error: {
					message: "Provider returned error",
					code: 400,
					metadata: {
						raw: JSON.stringify({ message: "Token limit exceeded" }),
					},
				},
			})

			const result = extractMessageFromResponseBody(body)
			expect(result).toBe("Token limit exceeded")
		})

		it("falls through when error.metadata.raw is invalid JSON", () => {
			const body = JSON.stringify({
				error: {
					message: "Provider returned error",
					code: 400,
					metadata: {
						raw: "not valid json {{{",
					},
				},
			})

			const result = extractMessageFromResponseBody(body)
			// Should fall through to the error.message path
			expect(result).toBe("[400] Provider returned error")
		})

		it("falls through when error.metadata.raw has no message field", () => {
			const body = JSON.stringify({
				error: {
					message: "Provider returned error",
					code: 400,
					metadata: {
						raw: JSON.stringify({ status: "failed", detail: "something" }),
					},
				},
			})

			const result = extractMessageFromResponseBody(body)
			// Should fall through to the error.message path
			expect(result).toBe("[400] Provider returned error")
		})

		it("extracts direct error.message format", () => {
			const body = JSON.stringify({
				error: {
					message: "actual error from provider",
				},
			})

			const result = extractMessageFromResponseBody(body)
			expect(result).toBe("actual error from provider")
		})

		it("extracts error.message with string code", () => {
			const body = JSON.stringify({
				error: {
					message: "rate limit exceeded",
					code: "rate_limit",
				},
			})

			const result = extractMessageFromResponseBody(body)
			expect(result).toBe("[rate_limit] rate limit exceeded")
		})

		it("returns undefined for non-JSON input", () => {
			const result = extractMessageFromResponseBody("this is not json at all")
			expect(result).toBeUndefined()
		})

		it("returns undefined for empty string", () => {
			const result = extractMessageFromResponseBody("")
			expect(result).toBeUndefined()
		})

		it("extracts string error format", () => {
			const body = JSON.stringify({ error: "something went wrong" })

			const result = extractMessageFromResponseBody(body)
			expect(result).toBe("something went wrong")
		})

		it("extracts top-level message format", () => {
			const body = JSON.stringify({ message: "top level error" })

			const result = extractMessageFromResponseBody(body)
			expect(result).toBe("top level error")
		})
	})

	describe("extractAiSdkErrorMessage", () => {
		it("returns raw responseBody when structured parsing yields nothing for AI_APICallError", () => {
			const error = {
				name: "AI_APICallError",
				message: "Bad Request",
				statusCode: 400,
				responseBody: "Some unstructured error text from provider",
			}

			const result = extractAiSdkErrorMessage(error)
			expect(result).toBe("API Error (400): Some unstructured error text from provider")
			expect(result).not.toContain("Bad Request")
		})

		it("returns 'No response body available' when responseBody is absent", () => {
			const error = {
				name: "AI_APICallError",
				message: "Bad Request",
				statusCode: 400,
			}

			const result = extractAiSdkErrorMessage(error)
			expect(result).toBe("API Error (400): No response body available")
			expect(result).not.toContain("Bad Request")
		})

		it("extracts structured message from responseBody for AI_APICallError", () => {
			const error = {
				name: "AI_APICallError",
				message: "Bad Request",
				statusCode: 400,
				responseBody: JSON.stringify({
					error: {
						message: "Context length exceeded",
						code: "context_length_exceeded",
					},
				}),
			}

			const result = extractAiSdkErrorMessage(error)
			expect(result).toBe("API Error (400): [context_length_exceeded] Context length exceeded")
			expect(result).not.toContain("Bad Request")
		})

		it("never returns generic 'Bad Request' when responseBody has useful info", () => {
			const error = {
				name: "AI_APICallError",
				message: "Bad Request",
				statusCode: 400,
				responseBody: JSON.stringify({
					error: {
						message: "Provider returned error",
						code: 400,
						metadata: {
							raw: JSON.stringify({
								message: "A maximum of 4 blocks with cache_control may be provided. Found 5.",
							}),
							provider_name: "Amazon Bedrock",
						},
					},
				}),
			}

			const result = extractAiSdkErrorMessage(error)
			expect(result).not.toBe("Bad Request")
			expect(result).not.toBe("API Error (400): Bad Request")
			expect(result).toContain("A maximum of 4 blocks with cache_control may be provided")
		})

		it("includes raw malformed responseBody instead of swallowing it", () => {
			const error = {
				name: "AI_APICallError",
				message: "Bad Request",
				statusCode: 400,
				responseBody: "<html>500 Internal Server Error</html>",
			}

			const result = extractAiSdkErrorMessage(error)
			expect(result).toBe("API Error (400): <html>500 Internal Server Error</html>")
			expect(result).not.toContain("Bad Request")
		})

		it("handles AI_APICallError without statusCode", () => {
			const error = {
				name: "AI_APICallError",
				message: "Bad Request",
				responseBody: JSON.stringify({ error: { message: "some error" } }),
			}

			const result = extractAiSdkErrorMessage(error)
			expect(result).toContain("some error")
		})
	})
})
