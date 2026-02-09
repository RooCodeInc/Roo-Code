// npx vitest run api/providers/__tests__/openai-native-tools.spec.ts

import OpenAI from "openai"

import { OpenAiHandler } from "../openai"

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: vi.fn(() => vi.fn((modelId: string) => ({ modelId, provider: "openai-compatible" }))),
}))

vi.mock("@ai-sdk/azure", () => ({
	createAzure: vi.fn(() => ({
		chat: vi.fn((modelId: string) => ({ modelId, provider: "azure.chat" })),
	})),
}))

describe("OpenAiHandler native tools", () => {
	it("includes tools in request when tools are provided via metadata (regression test)", async () => {
		async function* mockFullStream() {
			yield { type: "text-delta", text: "Test response" }
		}

		mockStreamText.mockReturnValueOnce({
			fullStream: mockFullStream(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve(undefined),
		})

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

		expect(mockStreamText).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.objectContaining({
					test_tool: expect.anything(),
				}),
			}),
		)
	})
})

// Use vi.hoisted to define mock functions for AI SDK
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
	createOpenAI: vi.fn(() => {
		const provider = vi.fn(() => ({
			modelId: "gpt-4o",
			provider: "openai",
		}))
		;(provider as any).responses = vi.fn(() => ({
			modelId: "gpt-4o",
			provider: "openai.responses",
		}))
		;(provider as any).chat = vi.fn((modelId: string) => ({
			modelId,
			provider: "openai.chat",
		}))
		return provider
	}),
}))

import { OpenAiNativeHandler } from "../openai-native"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("OpenAiNativeHandler tool handling with AI SDK", () => {
	function createMockStreamReturn() {
		async function* mockFullStream() {
			yield { type: "text-delta", text: "test" }
		}

		return {
			fullStream: mockFullStream(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			content: Promise.resolve([]),
		}
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should pass tools through convertToolsForOpenAI and convertToolsForAiSdk to streamText", async () => {
		mockStreamText.mockReturnValue(createMockStreamReturn())

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		const tools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "read_file",
					description: "Read a file from the filesystem",
					parameters: {
						type: "object",
						properties: {
							path: { type: "string", description: "File path" },
						},
					},
				},
			},
		]

		const stream = handler.createMessage("system prompt", [], {
			taskId: "test-task-id",
			tools,
		})
		for await (const _ of stream) {
			// consume
		}

		expect(mockStreamText).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.objectContaining({
					read_file: expect.anything(),
				}),
			}),
		)
	})

	it("should pass MCP tools to streamText", async () => {
		mockStreamText.mockReturnValue(createMockStreamReturn())

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

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
		for await (const _ of stream) {
			// consume
		}

		expect(mockStreamText).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.objectContaining({
					"mcp--github--get_me": expect.anything(),
				}),
			}),
		)
	})

	it("should pass both regular and MCP tools together", async () => {
		mockStreamText.mockReturnValue(createMockStreamReturn())

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		const mixedTools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "read_file",
					description: "Read a file",
					parameters: { type: "object", properties: { path: { type: "string" } } },
				},
			},
			{
				type: "function",
				function: {
					name: "mcp--linear--create_issue",
					description: "Create a Linear issue",
					parameters: {
						type: "object",
						properties: { title: { type: "string" } },
						required: ["title"],
					},
				},
			},
		]

		const stream = handler.createMessage("system prompt", [], {
			taskId: "test-task-id",
			tools: mixedTools,
		})
		for await (const _ of stream) {
			// consume
		}

		const callArgs = mockStreamText.mock.calls[0][0]
		expect(callArgs.tools).toBeDefined()
		expect(callArgs.tools.read_file).toBeDefined()
		expect(callArgs.tools["mcp--linear--create_issue"]).toBeDefined()
	})

	it("should pass parallelToolCalls in provider options", async () => {
		mockStreamText.mockReturnValue(createMockStreamReturn())

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		const stream = handler.createMessage("system prompt", [], {
			taskId: "test-task-id",
			parallelToolCalls: false,
		})
		for await (const _ of stream) {
			// consume
		}

		expect(mockStreamText).toHaveBeenCalledWith(
			expect.objectContaining({
				providerOptions: expect.objectContaining({
					openai: expect.objectContaining({
						parallelToolCalls: false,
					}),
				}),
			}),
		)
	})

	it("should handle tool call streaming events", async () => {
		async function* mockFullStream() {
			yield { type: "tool-input-start", id: "call_abc", toolName: "read_file" }
			yield { type: "tool-input-delta", id: "call_abc", delta: '{"path":' }
			yield { type: "tool-input-delta", id: "call_abc", delta: '"/tmp/test.txt"}' }
			yield { type: "tool-input-end", id: "call_abc" }
		}

		mockStreamText.mockReturnValue({
			fullStream: mockFullStream(),
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
			content: Promise.resolve([]),
		})

		const handler = new OpenAiNativeHandler({
			openAiNativeApiKey: "test-key",
			apiModelId: "gpt-4o",
		} as ApiHandlerOptions)

		const stream = handler.createMessage("system prompt", [], {
			taskId: "test-task-id",
		})

		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		const toolStart = chunks.filter((c) => c.type === "tool_call_start")
		expect(toolStart).toHaveLength(1)
		expect(toolStart[0].id).toBe("call_abc")
		expect(toolStart[0].name).toBe("read_file")

		const toolDeltas = chunks.filter((c) => c.type === "tool_call_delta")
		expect(toolDeltas).toHaveLength(2)

		const toolEnd = chunks.filter((c) => c.type === "tool_call_end")
		expect(toolEnd).toHaveLength(1)
		expect(toolEnd[0].id).toBe("call_abc")
	})
})
