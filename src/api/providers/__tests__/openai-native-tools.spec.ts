// npx vitest run api/providers/__tests__/openai-native-tools.spec.ts

import OpenAI from "openai"

import { OpenAiHandler } from "../openai"
import { OpenAiNativeHandler } from "../openai-native"
import type { ApiHandlerOptions } from "../../../shared/api"

// Mocks for AI SDK (used by both OpenAiHandler and OpenAiNativeHandler)
const { mockStreamText } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: vi.fn(),
	}
})

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: vi.fn(() => ({
		chat: vi.fn(() => ({
			modelId: "test-model",
			provider: "openai.chat",
		})),
		responses: vi.fn(() => ({
			modelId: "gpt-4o",
			provider: "openai.responses",
		})),
	})),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: vi.fn(),
		},
	},
}))

describe("OpenAiHandler native tools", () => {
	it("includes tools in request when tools are provided via metadata (regression test)", async () => {
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

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "Test response" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
		})

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
		for await (const _chunk of stream) {
			// consume stream
		}

		// Verify streamText was called with tools (converted via convertToolsForAiSdk)
		expect(mockStreamText).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.objectContaining({
					test_tool: expect.any(Object),
				}),
			}),
		)
	})
})

describe("OpenAiNativeHandler MCP tool schema handling", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should pass MCP tools to streamText via convertToolsForAiSdk", async () => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "test" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

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

		for await (const _chunk of stream) {
			// consume stream
		}

		// Verify streamText was called with tools converted via convertToolsForAiSdk
		expect(mockStreamText).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.objectContaining({
					"mcp--github--get_me": expect.any(Object),
				}),
			}),
		)
	})

	it("should pass regular tools to streamText via convertToolsForAiSdk", async () => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "test" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

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

		for await (const _chunk of stream) {
			// consume stream
		}

		// Verify streamText was called with converted tools
		expect(mockStreamText).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.objectContaining({
					read_file: expect.any(Object),
				}),
			}),
		)
	})

	it("should handle tools with nested objects via convertToolsForAiSdk", async () => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "test" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

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

		for await (const _chunk of stream) {
			// consume stream
		}

		// Verify tools are passed through to streamText
		expect(mockStreamText).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.objectContaining({
					"mcp--linear--create_issue": expect.any(Object),
				}),
			}),
		)
	})

	it("should handle tool calls in AI SDK stream", async () => {
		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				// AI SDK tool call stream events
				yield { type: "tool-input-start", id: "call_123", toolName: "read_file" }
				yield { type: "tool-input-delta", id: "call_123", delta: '{"path":' }
				yield { type: "tool-input-delta", id: "call_123", delta: '"/tmp/test.txt"}' }
				yield { type: "tool-input-end", id: "call_123" }
			})(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			response: Promise.resolve({ messages: [] }),
		})

		const stream = handler.createMessage("system prompt", [], {
			taskId: "test-task-id",
		})

		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		// Verify tool call start
		const startChunks = chunks.filter((c) => c.type === "tool_call_start")
		expect(startChunks).toHaveLength(1)
		expect(startChunks[0].id).toBe("call_123")
		expect(startChunks[0].name).toBe("read_file")

		// Verify tool call deltas
		const deltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
		expect(deltaChunks).toHaveLength(2)
		expect(deltaChunks[0].delta).toBe('{"path":')
		expect(deltaChunks[1].delta).toBe('"/tmp/test.txt"}')

		// Verify tool call end
		const endChunks = chunks.filter((c) => c.type === "tool_call_end")
		expect(endChunks).toHaveLength(1)
		expect(endChunks[0].id).toBe("call_123")
	})
})
