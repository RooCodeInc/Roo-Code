import OpenAI from "openai"

import { OpenAiHandler } from "../openai"
import { OpenAiNativeHandler } from "../openai-native"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("OpenAiHandler native tools", () => {
	it("includes tools in request when tools are provided via metadata (regression test)", async () => {
		const mockCreate = vi.fn().mockImplementationOnce(() => ({
			[Symbol.asyncIterator]: async function* () {
				yield {
					choices: [{ delta: { content: "Test response" } }],
				}
			},
		}))

		// Set openAiCustomModelInfo without any tool capability flags; tools should
		// still be passed whenever metadata.tools is present.
		const handler = new OpenAiHandler({
			openAiApiKey: "test-key",
			openAiBaseUrl: "https://example.com/v1",
			openAiModelId: "test-model",
			openAiCustomModelInfo: {
				maxTokens: 4096,
				contextWindow: 128000,
			},
		} as unknown as import("../../../shared/api").ApiHandlerOptions)

		// Patch the OpenAI client call
		const mockClient = {
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		} as unknown as OpenAI
		;(handler as unknown as { client: OpenAI }).client = mockClient

		const tools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "test_tool",
					description: "test",
					parameters: { type: "object", properties: {} },
				},
			},
		]

		const stream = handler.createMessage("system", [], {
			taskId: "test-task-id",
			tools,
		})
		await stream.next()

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.arrayContaining([
					expect.objectContaining({
						type: "function",
						function: expect.objectContaining({ name: "test_tool" }),
					}),
				]),
				parallel_tool_calls: true,
			}),
			expect.anything(),
		)
	})
})

describe("OpenAiNativeHandler MCP tool schema handling", () => {
	it("should add additionalProperties: false to MCP tools while keeping strict: false", async () => {
		let capturedRequestBody: any

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		// Mock the responses API call
		const mockClient = {
			responses: {
				create: vi.fn().mockImplementation((body: any) => {
					capturedRequestBody = body
					return {
						[Symbol.asyncIterator]: async function* () {
							yield {
								type: "response.done",
								response: {
									output: [{ type: "message", content: [{ type: "output_text", text: "test" }] }],
									usage: { input_tokens: 10, output_tokens: 5 },
								},
							}
						},
					}
				}),
			},
		}
		;(handler as any).client = mockClient

		const mcpTools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "mcp--github--get_me",
					description: "Get current GitHub user",
					parameters: {
						type: "object",
						properties: {
							token: { type: "string", description: "API token" },
						},
						required: ["token"],
					},
				},
			},
		]

		const stream = handler.createMessage("system prompt", [], {
			taskId: "test-task-id",
			tools: mcpTools,
		})

		// Consume the stream
		for await (const _ of stream) {
			// Just consume
		}

		// Verify the request body
		expect(capturedRequestBody.tools).toBeDefined()
		expect(capturedRequestBody.tools.length).toBe(1)

		const tool = capturedRequestBody.tools[0]
		expect(tool.name).toBe("mcp--github--get_me")
		expect(tool.strict).toBe(false) // MCP tools should have strict: false
		expect(tool.parameters.additionalProperties).toBe(false) // Should have additionalProperties: false
		expect(tool.parameters.required).toEqual(["token"]) // Should preserve original required array
	})

	it("should add additionalProperties: false and required array to non-MCP tools with strict: true", async () => {
		let capturedRequestBody: any

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		// Mock the responses API call
		const mockClient = {
			responses: {
				create: vi.fn().mockImplementation((body: any) => {
					capturedRequestBody = body
					return {
						[Symbol.asyncIterator]: async function* () {
							yield {
								type: "response.done",
								response: {
									output: [{ type: "message", content: [{ type: "output_text", text: "test" }] }],
									usage: { input_tokens: 10, output_tokens: 5 },
								},
							}
						},
					}
				}),
			},
		}
		;(handler as any).client = mockClient

		const regularTools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "read_file",
					description: "Read a file from the filesystem",
					parameters: {
						type: "object",
						properties: {
							path: { type: "string", description: "File path" },
							encoding: { type: "string", description: "File encoding" },
						},
					},
				},
			},
		]

		const stream = handler.createMessage("system prompt", [], {
			taskId: "test-task-id",
			tools: regularTools,
		})

		// Consume the stream
		for await (const _ of stream) {
			// Just consume
		}

		// Verify the request body
		expect(capturedRequestBody.tools).toBeDefined()
		expect(capturedRequestBody.tools.length).toBe(1)

		const tool = capturedRequestBody.tools[0]
		expect(tool.name).toBe("read_file")
		expect(tool.strict).toBe(true) // Non-MCP tools should have strict: true
		expect(tool.parameters.additionalProperties).toBe(false) // Should have additionalProperties: false
		expect(tool.parameters.required).toEqual(["path", "encoding"]) // Should have all properties as required
	})

	it("should recursively add additionalProperties: false to nested objects in MCP tools", async () => {
		let capturedRequestBody: any

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		// Mock the responses API call
		const mockClient = {
			responses: {
				create: vi.fn().mockImplementation((body: any) => {
					capturedRequestBody = body
					return {
						[Symbol.asyncIterator]: async function* () {
							yield {
								type: "response.done",
								response: {
									output: [{ type: "message", content: [{ type: "output_text", text: "test" }] }],
									usage: { input_tokens: 10, output_tokens: 5 },
								},
							}
						},
					}
				}),
			},
		}
		;(handler as any).client = mockClient

		const mcpToolsWithNestedObjects: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "mcp--linear--create_issue",
					description: "Create a Linear issue",
					parameters: {
						type: "object",
						properties: {
							title: { type: "string" },
							metadata: {
								type: "object",
								properties: {
									priority: { type: "number" },
									labels: {
										type: "array",
										items: {
											type: "object",
											properties: {
												name: { type: "string" },
											},
										},
									},
								},
							},
						},
					},
				},
			},
		]

		const stream = handler.createMessage("system prompt", [], {
			taskId: "test-task-id",
			tools: mcpToolsWithNestedObjects,
		})

		// Consume the stream
		for await (const _ of stream) {
			// Just consume
		}

		// Verify the request body
		const tool = capturedRequestBody.tools[0]
		expect(tool.strict).toBe(false) // MCP tool should have strict: false
		expect(tool.parameters.additionalProperties).toBe(false) // Root level
		expect(tool.parameters.properties.metadata.additionalProperties).toBe(false) // Nested object
		expect(tool.parameters.properties.metadata.properties.labels.items.additionalProperties).toBe(false) // Array items
	})

	it("should handle missing call_id and name in tool_call_arguments.delta by using pending tool identity", async () => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		const mockClient = {
			responses: {
				create: vi.fn().mockImplementation(() => {
					return {
						[Symbol.asyncIterator]: async function* () {
							// 1. Emit output_item.added with tool identity
							yield {
								type: "response.output_item.added",
								item: {
									type: "function_call",
									call_id: "call_123",
									name: "read_file",
									arguments: "",
								},
							}

							// 2. Emit tool_call_arguments.delta WITHOUT identity (just args)
							yield {
								type: "response.function_call_arguments.delta",
								delta: '{"path":',
							}

							// 3. Emit another delta
							yield {
								type: "response.function_call_arguments.delta",
								delta: '"/tmp/test.txt"}',
							}

							// 4. Emit output_item.done
							yield {
								type: "response.output_item.done",
								item: {
									type: "function_call",
									call_id: "call_123",
									name: "read_file",
									arguments: '{"path":"/tmp/test.txt"}',
								},
							}
						},
					}
				}),
			},
		}
		;(handler as any).client = mockClient

		const stream = handler.createMessage("system prompt", [], {
			taskId: "test-task-id",
		})

		const chunks: any[] = []
		for await (const chunk of stream) {
			if (chunk.type === "tool_call_partial") {
				chunks.push(chunk)
			}
		}

		expect(chunks.length).toBe(2)
		expect(chunks[0]).toEqual({
			type: "tool_call_partial",
			index: 0,
			id: "call_123", // Should be filled from pendingToolCallId
			name: "read_file", // Should be filled from pendingToolCallName
			arguments: '{"path":',
		})
		expect(chunks[1]).toEqual({
			type: "tool_call_partial",
			index: 0,
			id: "call_123",
			name: "read_file",
			arguments: '"/tmp/test.txt"}',
		})
	})
})

describe("OpenAiNativeHandler done-event fallbacks", () => {
	const createHandlerWithEvents = (events: any[]) => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		;(handler as any).client = {
			responses: {
				create: vi.fn().mockResolvedValue({
					async *[Symbol.asyncIterator]() {
						for (const event of events) {
							yield event
						}
					},
				}),
			},
		}

		return handler
	}

	const collectChunksFromEvents = async (events: any[]) => {
		const handler = createHandlerWithEvents(events)
		const stream = handler.createMessage("system", [{ role: "user", content: "test" } as any], {
			taskId: "t",
			tools: [],
		})

		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}
		return chunks
	}

	it.each([
		[
			"response.output_item.done message",
			[
				{
					type: "response.output_item.done",
					item: {
						type: "message",
						role: "assistant",
						content: [{ type: "output_text", text: "hello from done item" }],
					},
					output_index: 0,
				},
				{
					type: "response.completed",
					response: {
						id: "resp_done_item_only",
						status: "completed",
						output: [],
						usage: { input_tokens: 1, output_tokens: 2 },
					},
				},
			],
			"hello from done item",
		],
		[
			"response.completed output",
			[
				{
					type: "response.completed",
					response: {
						id: "resp_completed_only",
						status: "completed",
						output: [
							{
								type: "message",
								role: "assistant",
								content: [{ type: "output_text", text: "final payload only" }],
							},
						],
						usage: { input_tokens: 1, output_tokens: 2 },
					},
				},
			],
			"final payload only",
		],
		[
			"response.output_text.done",
			[
				{
					type: "response.output_text.done",
					text: "done-event text only",
				},
				{
					type: "response.completed",
					response: {
						id: "resp_done_text_only",
						status: "completed",
						output: [],
						usage: { input_tokens: 1, output_tokens: 2 },
					},
				},
			],
			"done-event text only",
		],
		[
			"response.content_part.added",
			[
				{
					type: "response.content_part.added",
					part: {
						type: "output_text",
						text: "content part text",
					},
					output_index: 0,
					content_index: 0,
				},
				{
					type: "response.completed",
					response: {
						id: "resp_content_part",
						status: "completed",
						output: [],
						usage: { input_tokens: 1, output_tokens: 2 },
					},
				},
			],
			"content part text",
		],
	])("yields text when native emits %s", async (_caseName, events, expectedText) => {
		const chunks = await collectChunksFromEvents(events)
		const textChunks = chunks.filter((c) => c.type === "text")
		expect(textChunks.length).toBeGreaterThan(0)
		expect(textChunks.map((c) => c.text).join("")).toContain(expectedText)
	})

	it("yields tool_call when native emits function_call only in response.output_item.done", async () => {
		const chunks = await collectChunksFromEvents([
			{
				type: "response.output_item.done",
				item: {
					type: "function_call",
					call_id: "call_done_only",
					name: "attempt_completion",
					arguments: '{"result":"ok"}',
				},
				output_index: 0,
			},
			{
				type: "response.completed",
				response: {
					id: "resp_done_tool_only",
					status: "completed",
					output: [],
					usage: { input_tokens: 1, output_tokens: 2 },
				},
			},
		])

		const toolCalls = chunks.filter((c) => c.type === "tool_call")
		expect(toolCalls.length).toBeGreaterThan(0)
		expect(toolCalls[0]).toMatchObject({
			type: "tool_call",
			id: "call_done_only",
			name: "attempt_completion",
		})
	})

	it("does not duplicate text when delta and output_text.done are both emitted", async () => {
		const chunks = await collectChunksFromEvents([
			{ type: "response.output_text.delta", delta: "hello " },
			{ type: "response.output_text.delta", delta: "world" },
			{ type: "response.output_text.done", text: "hello world" },
			{
				type: "response.completed",
				response: {
					id: "resp_delta_done",
					status: "completed",
					output: [],
					usage: { input_tokens: 1, output_tokens: 2 },
				},
			},
		])

		const textChunks = chunks.filter((c) => c.type === "text")
		expect(textChunks.map((c) => c.text).join("")).toBe("hello world")
	})

	it("does not duplicate text when delta and content_part.added are both emitted", async () => {
		const chunks = await collectChunksFromEvents([
			{ type: "response.output_text.delta", delta: "hello world" },
			{
				type: "response.content_part.added",
				part: { type: "output_text", text: "hello world" },
				output_index: 0,
				content_index: 0,
			},
			{
				type: "response.completed",
				response: {
					id: "resp_delta_content_part",
					status: "completed",
					output: [],
					usage: { input_tokens: 1, output_tokens: 2 },
				},
			},
		])

		const textChunks = chunks.filter((c) => c.type === "text")
		expect(textChunks.map((c) => c.text).join("")).toBe("hello world")
	})
})
