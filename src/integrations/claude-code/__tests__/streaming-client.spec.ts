import { CLAUDE_CODE_API_CONFIG, prefixToolName, stripToolNamePrefix } from "../streaming-client"

describe("Claude Code Streaming Client", () => {
	describe("Tool name prefix utilities", () => {
		test("prefixToolName should add oc_ prefix to tool names", () => {
			expect(prefixToolName("read_file")).toBe("oc_read_file")
			expect(prefixToolName("write_to_file")).toBe("oc_write_to_file")
			expect(prefixToolName("execute_command")).toBe("oc_execute_command")
		})

		test("stripToolNamePrefix should remove oc_ prefix from tool names", () => {
			expect(stripToolNamePrefix("oc_read_file")).toBe("read_file")
			expect(stripToolNamePrefix("oc_write_to_file")).toBe("write_to_file")
			expect(stripToolNamePrefix("oc_execute_command")).toBe("execute_command")
		})

		test("stripToolNamePrefix should return unchanged name if no prefix", () => {
			expect(stripToolNamePrefix("read_file")).toBe("read_file")
			expect(stripToolNamePrefix("some_other_tool")).toBe("some_other_tool")
		})

		test("stripToolNamePrefix should handle edge cases", () => {
			expect(stripToolNamePrefix("oc_")).toBe("")
			expect(stripToolNamePrefix("")).toBe("")
			// "occ_tool" does NOT start with "oc_" exactly, so it's unchanged
			expect(stripToolNamePrefix("occ_tool")).toBe("occ_tool")
			// But "oc_oc_tool" would strip one prefix
			expect(stripToolNamePrefix("oc_oc_tool")).toBe("oc_tool")
		})
	})

	describe("CLAUDE_CODE_API_CONFIG", () => {
		test("should have correct API endpoint", () => {
			expect(CLAUDE_CODE_API_CONFIG.endpoint).toBe("https://api.anthropic.com/v1/messages")
		})

		test("should have correct API version", () => {
			expect(CLAUDE_CODE_API_CONFIG.version).toBe("2023-06-01")
		})

		test("should have correct default betas", () => {
			expect(CLAUDE_CODE_API_CONFIG.defaultBetas).toContain("claude-code-20250219")
			expect(CLAUDE_CODE_API_CONFIG.defaultBetas).toContain("oauth-2025-04-20")
			expect(CLAUDE_CODE_API_CONFIG.defaultBetas).toContain("interleaved-thinking-2025-05-14")
			expect(CLAUDE_CODE_API_CONFIG.defaultBetas).toContain("fine-grained-tool-streaming-2025-05-14")
		})

		test("should have correct user agent", () => {
			expect(CLAUDE_CODE_API_CONFIG.userAgent).toMatch(/^Roo-Code\/\d+\.\d+\.\d+$/)
		})
	})

	describe("createStreamingMessage", () => {
		let originalFetch: typeof global.fetch

		beforeEach(() => {
			originalFetch = global.fetch
		})

		afterEach(() => {
			global.fetch = originalFetch
		})

		test("should make request with correct headers", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [{ role: "user", content: "Hello" }],
			})

			// Consume the stream
			for await (const _ of stream) {
				// Just consume
			}

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining(CLAUDE_CODE_API_CONFIG.endpoint),
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
						"Content-Type": "application/json",
						"Anthropic-Version": CLAUDE_CODE_API_CONFIG.version,
						Accept: "text/event-stream",
						"User-Agent": CLAUDE_CODE_API_CONFIG.userAgent,
					}),
				}),
			)
		})

		test("should include correct body parameters", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [{ role: "user", content: "Hello" }],
				maxTokens: 4096,
			})

			// Consume the stream
			for await (const _ of stream) {
				// Just consume
			}

			const call = mockFetch.mock.calls[0]
			const body = JSON.parse(call[1].body)

			expect(body.model).toBe("claude-3-5-sonnet-20241022")
			expect(body.stream).toBe(true)
			expect(body.max_tokens).toBe(4096)
			// System prompt should have cache_control on the user-provided text
			expect(body.system).toEqual([
				{ type: "text", text: "You are Claude Code, Anthropic's official CLI for Claude." },
				{ type: "text", text: "You are helpful", cache_control: { type: "ephemeral" } },
			])
			// Messages should have cache_control on the last user message
			expect(body.messages).toEqual([
				{
					role: "user",
					content: [{ type: "text", text: "Hello", cache_control: { type: "ephemeral" } }],
				},
			])
		})

		test("should add cache breakpoints to last two user messages", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [
					{ role: "user", content: "First message" },
					{ role: "assistant", content: "Response" },
					{ role: "user", content: "Second message" },
					{ role: "assistant", content: "Another response" },
					{ role: "user", content: "Third message" },
				],
			})

			// Consume the stream
			for await (const _ of stream) {
				// Just consume
			}

			const call = mockFetch.mock.calls[0]
			const body = JSON.parse(call[1].body)

			// Only the last two user messages should have cache_control
			expect(body.messages[0].content).toBe("First message") // No cache_control
			expect(body.messages[2].content).toEqual([
				{ type: "text", text: "Second message", cache_control: { type: "ephemeral" } },
			])
			expect(body.messages[4].content).toEqual([
				{ type: "text", text: "Third message", cache_control: { type: "ephemeral" } },
			])
		})

		test("should filter out non-Anthropic block types", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: "Hello" }],
					},
					{
						role: "assistant",
						content: [
							{ type: "reasoning", text: "Internal reasoning" }, // Should be filtered
							{ type: "thoughtSignature", data: "encrypted" }, // Should be filtered
							{ type: "text", text: "Response" },
						],
					},
					{
						role: "user",
						content: [{ type: "text", text: "Follow up" }],
					},
				] as any,
			})

			// Consume the stream
			for await (const _ of stream) {
				// Just consume
			}

			const call = mockFetch.mock.calls[0]
			const body = JSON.parse(call[1].body)

			// The assistant message should only have the text block
			expect(body.messages[1].content).toEqual([{ type: "text", text: "Response" }])
		})

		test("should preserve thinking and redacted_thinking blocks", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: "Hello" }],
					},
					{
						role: "assistant",
						content: [
							{ type: "thinking", thinking: "Let me think...", signature: "abc123" },
							{ type: "text", text: "Response" },
						],
					},
					{
						role: "user",
						content: [{ type: "tool_result", tool_use_id: "123", content: "result" }],
					},
				] as any,
			})

			// Consume the stream
			for await (const _ of stream) {
				// Just consume
			}

			const call = mockFetch.mock.calls[0]
			const body = JSON.parse(call[1].body)

			// Thinking blocks should be preserved
			expect(body.messages[1].content).toContainEqual({
				type: "thinking",
				thinking: "Let me think...",
				signature: "abc123",
			})
			// Tool result blocks should be preserved
			expect(body.messages[2].content).toContainEqual({
				type: "tool_result",
				tool_use_id: "123",
				content: "result",
			})
		})

		// Dropped: conversion of internal `reasoning` + `thoughtSignature` blocks into
		// Anthropic `thinking` blocks. The Claude Code integration now relies on the
		// Anthropic-native `thinking` block format persisted by Task.

		test("should strip reasoning_details from messages (provider switching)", async () => {
			// When switching from OpenRouter/Roo to Claude Code, messages may have
			// reasoning_details fields that the Anthropic API doesn't accept
			// This causes errors like: "messages.3.reasoning_details: Extra inputs are not permitted"
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			// Simulate messages with reasoning_details (added by OpenRouter for Gemini/o-series)
			const messagesWithReasoningDetails = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: [{ type: "text", text: "I'll help with that." }],
					// This field is added by OpenRouter/Roo providers for Gemini/OpenAI reasoning
					reasoning_details: [{ type: "summary_text", summary: "Thinking about the request" }],
				},
				{ role: "user", content: "Follow up question" },
			]

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: messagesWithReasoningDetails as any,
			})

			// Consume the stream
			for await (const _ of stream) {
				// Just consume
			}

			const call = mockFetch.mock.calls[0]
			const body = JSON.parse(call[1].body)

			// The assistant message should NOT have reasoning_details
			expect(body.messages[1]).not.toHaveProperty("reasoning_details")
			// But should still have the content
			expect(body.messages[1].content).toContainEqual(
				expect.objectContaining({
					type: "text",
					text: "I'll help with that.",
				}),
			)
			// Only role and content should be present
			expect(Object.keys(body.messages[1])).toEqual(["role", "content"])
		})

		test("should strip other non-standard message fields", async () => {
			// Ensure any non-standard fields are stripped from messages
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const messagesWithExtraFields = [
				{
					role: "user",
					content: "Hello",
					customField: "should be stripped",
					metadata: { foo: "bar" },
				},
				{
					role: "assistant",
					content: [{ type: "text", text: "Response" }],
					internalId: "123",
					timestamp: Date.now(),
				},
			]

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: messagesWithExtraFields as any,
			})

			// Consume the stream
			for await (const _ of stream) {
				// Just consume
			}

			const call = mockFetch.mock.calls[0]
			const body = JSON.parse(call[1].body)

			// All messages should only have role and content
			body.messages.forEach((msg: Record<string, unknown>) => {
				expect(Object.keys(msg).filter((k) => k !== "role" && k !== "content")).toHaveLength(0)
			})
		})

		test("should yield error chunk on non-ok response", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				text: vi.fn().mockResolvedValue('{"error":{"message":"Invalid API key"}}'),
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "invalid-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [{ role: "user", content: "Hello" }],
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(1)
			expect(chunks[0].type).toBe("error")
			expect((chunks[0] as { type: "error"; error: string }).error).toBe("Invalid API key")
		})

		test("should yield error chunk when no response body", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: null,
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [{ role: "user", content: "Hello" }],
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(1)
			expect(chunks[0].type).toBe("error")
			expect((chunks[0] as { type: "error"; error: string }).error).toBe("No response body")
		})

		test("should parse text SSE events correctly", async () => {
			const sseData = [
				'event: content_block_start\ndata: {"index":0,"content_block":{"type":"text","text":"Hello"}}\n\n',
				'event: content_block_delta\ndata: {"index":0,"delta":{"type":"text_delta","text":" world"}}\n\n',
				"event: message_stop\ndata: {}\n\n",
			]

			let readIndex = 0
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockImplementation(() => {
							if (readIndex < sseData.length) {
								const value = new TextEncoder().encode(sseData[readIndex++])
								return Promise.resolve({ done: false, value })
							}
							return Promise.resolve({ done: true, value: undefined })
						}),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [{ role: "user", content: "Hello" }],
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have text chunks and usage
			expect(chunks.some((c) => c.type === "text")).toBe(true)
			expect(chunks.filter((c) => c.type === "text")).toEqual([
				{ type: "text", text: "Hello" },
				{ type: "text", text: " world" },
			])
		})

		test("should parse thinking/reasoning SSE events correctly", async () => {
			const sseData = [
				'event: content_block_start\ndata: {"index":0,"content_block":{"type":"thinking","thinking":"Let me think..."}}\n\n',
				'event: content_block_delta\ndata: {"index":0,"delta":{"type":"thinking_delta","thinking":" more thoughts"}}\n\n',
				"event: message_stop\ndata: {}\n\n",
			]

			let readIndex = 0
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockImplementation(() => {
							if (readIndex < sseData.length) {
								const value = new TextEncoder().encode(sseData[readIndex++])
								return Promise.resolve({ done: false, value })
							}
							return Promise.resolve({ done: true, value: undefined })
						}),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [{ role: "user", content: "Hello" }],
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.filter((c) => c.type === "reasoning")).toEqual([
				{ type: "reasoning", text: "Let me think..." },
				{ type: "reasoning", text: " more thoughts" },
			])
		})

		test("should track and yield usage from message events", async () => {
			const sseData = [
				'event: message_start\ndata: {"message":{"usage":{"input_tokens":10,"output_tokens":0,"cache_read_input_tokens":5}}}\n\n',
				'event: message_delta\ndata: {"usage":{"output_tokens":20}}\n\n',
				"event: message_stop\ndata: {}\n\n",
			]

			let readIndex = 0
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockImplementation(() => {
							if (readIndex < sseData.length) {
								const value = new TextEncoder().encode(sseData[readIndex++])
								return Promise.resolve({ done: false, value })
							}
							return Promise.resolve({ done: true, value: undefined })
						}),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [{ role: "user", content: "Hello" }],
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 10,
				outputTokens: 20,
				cacheReadTokens: 5,
			})
		})

		test("should prefix tool names when sending to API", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const tools = [
				{
					name: "read_file",
					description: "Read a file",
					input_schema: { type: "object" as const, properties: {} },
				},
				{
					name: "write_to_file",
					description: "Write to a file",
					input_schema: { type: "object" as const, properties: {} },
				},
			]

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [{ role: "user", content: "Hello" }],
				tools,
			})

			// Consume the stream
			for await (const _ of stream) {
				// Just consume
			}

			const call = mockFetch.mock.calls[0]
			const body = JSON.parse(call[1].body)

			// Tool names should be prefixed with oc_
			expect(body.tools).toHaveLength(2)
			expect(body.tools[0].name).toBe("oc_read_file")
			expect(body.tools[1].name).toBe("oc_write_to_file")
			// Other properties should be preserved
			expect(body.tools[0].description).toBe("Read a file")
			expect(body.tools[1].description).toBe("Write to a file")
		})

		test("should prefix tool names in tool_use blocks within messages", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [
					{ role: "user", content: "Read a file" },
					{
						role: "assistant",
						content: [
							{
								type: "tool_use",
								id: "tool_123",
								name: "read_file",
								input: { path: "/test.txt" },
							},
						],
					},
					{
						role: "user",
						content: [{ type: "tool_result", tool_use_id: "tool_123", content: "file contents" }],
					},
				] as any,
			})

			// Consume the stream
			for await (const _ of stream) {
				// Just consume
			}

			const call = mockFetch.mock.calls[0]
			const body = JSON.parse(call[1].body)

			// Tool use block name should be prefixed
			const assistantMessage = body.messages[1]
			expect(assistantMessage.content[0].type).toBe("tool_use")
			expect(assistantMessage.content[0].name).toBe("oc_read_file")
			expect(assistantMessage.content[0].id).toBe("tool_123")
			// Tool result should be unchanged (references tool_use_id, not name)
			const userMessage = body.messages[2]
			expect(userMessage.content[0].type).toBe("tool_result")
			expect(userMessage.content[0].tool_use_id).toBe("tool_123")
		})

		test("should strip prefix from tool names in streaming responses", async () => {
			// Simulate a tool_use response from the API with prefixed name
			const sseData = [
				'event: content_block_start\ndata: {"index":0,"content_block":{"type":"tool_use","id":"tool_456","name":"oc_execute_command"}}\n\n',
				'event: content_block_delta\ndata: {"index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"command\\":"}}\n\n',
				'event: content_block_delta\ndata: {"index":0,"delta":{"type":"input_json_delta","partial_json":"\\"ls\\"}"}}\n\n',
				"event: message_stop\ndata: {}\n\n",
			]

			let readIndex = 0
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: vi.fn().mockImplementation(() => {
							if (readIndex < sseData.length) {
								const value = new TextEncoder().encode(sseData[readIndex++])
								return Promise.resolve({ done: false, value })
							}
							return Promise.resolve({ done: true, value: undefined })
						}),
						releaseLock: vi.fn(),
					}),
				},
			})
			global.fetch = mockFetch

			const { createStreamingMessage } = await import("../streaming-client")

			const stream = createStreamingMessage({
				accessToken: "test-token",
				model: "claude-3-5-sonnet-20241022",
				systemPrompt: "You are helpful",
				messages: [{ role: "user", content: "List files" }],
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Find the tool_call_partial chunk with the name
			const toolCallChunks = chunks.filter((c) => c.type === "tool_call_partial")
			expect(toolCallChunks.length).toBeGreaterThan(0)

			// The first tool_call_partial should have the stripped name
			const firstToolCall = toolCallChunks[0] as { type: "tool_call_partial"; name?: string; id?: string }
			expect(firstToolCall.name).toBe("execute_command") // Prefix stripped
			expect(firstToolCall.id).toBe("tool_456")
		})
	})
})
