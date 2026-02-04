// npx vitest run api/providers/__tests__/qwen-code-native-tools.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
}))

// Mock filesystem - must come before other imports
vi.mock("node:fs", () => ({
	promises: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: vi.fn(() => {
		// Return a function that returns a mock language model
		return vi.fn(() => ({
			modelId: "qwen3-coder-plus",
			provider: "qwen-code",
		}))
	}),
}))

import { promises as fs } from "node:fs"
import { QwenCodeHandler } from "../qwen-code"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("QwenCodeHandler Native Tools", () => {
	let handler: QwenCodeHandler
	let mockOptions: ApiHandlerOptions & { qwenCodeOauthPath?: string }

	const testTools = [
		{
			type: "function" as const,
			function: {
				name: "test_tool",
				description: "A test tool",
				parameters: {
					type: "object",
					properties: {
						arg1: { type: "string", description: "First argument" },
					},
					required: ["arg1"],
				},
			},
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock credentials file
		const mockCredentials = {
			access_token: "test-access-token",
			refresh_token: "test-refresh-token",
			token_type: "Bearer",
			expiry_date: Date.now() + 3600000, // 1 hour from now
			resource_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		}
		;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockCredentials))
		;(fs.writeFile as any).mockResolvedValue(undefined)

		mockOptions = {
			apiModelId: "qwen3-coder-plus",
		}
		handler = new QwenCodeHandler(mockOptions)
	})

	describe("Native Tool Calling Support", () => {
		it("should include tools in request when model supports native tools and tools are provided", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
				tools: testTools,
			})
			await stream.next()

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.objectContaining({
						test_tool: expect.any(Object),
					}),
				}),
			)
		})

		it("should include tool_choice when provided", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
				tools: testTools,
				tool_choice: "auto",
			})
			await stream.next()

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					toolChoice: "auto",
				}),
			)
		})

		it("should always include tools and toolChoice (tools are guaranteed to be present after ALWAYS_AVAILABLE_TOOLS)", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
			})
			await stream.next()

			// Tools are now always present (minimum 6 from ALWAYS_AVAILABLE_TOOLS)
			const callArgs = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1][0]
			expect(callArgs).toHaveProperty("tools")
			expect(callArgs).toHaveProperty("toolChoice")
		})

		it("should yield tool call chunks during streaming", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-input-start",
					id: "call_qwen_123",
					toolName: "test_tool",
				}
				yield {
					type: "tool-input-delta",
					id: "call_qwen_123",
					delta: '{"arg1":',
				}
				yield {
					type: "tool-input-delta",
					id: "call_qwen_123",
					delta: '"value"}',
				}
				yield {
					type: "tool-input-end",
					id: "call_qwen_123",
				}
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
				tools: testTools,
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Check for tool_call_start, tool_call_delta, and tool_call_end chunks
			const startChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
			const deltaChunks = chunks.filter((chunk) => chunk.type === "tool_call_delta")
			const endChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")
			expect(startChunks.length).toBeGreaterThan(0)
			expect(deltaChunks.length).toBeGreaterThan(0)
			expect(endChunks.length).toBeGreaterThan(0)
		})

		it("should yield tool_call_end events when tool call is complete", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-input-start",
					id: "call_qwen_test",
					toolName: "test_tool",
				}
				yield {
					type: "tool-input-delta",
					id: "call_qwen_test",
					delta: '{"arg1":"value"}',
				}
				yield {
					type: "tool-input-end",
					id: "call_qwen_test",
				}
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
				tools: testTools,
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have tool_call_end from the tool-input-end event
			const endChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")
			expect(endChunks).toHaveLength(1)
			expect(endChunks[0].id).toBe("call_qwen_test")
		})

		it("should preserve reasoning handling alongside tool calls", async () => {
			async function* mockFullStream() {
				yield {
					type: "reasoning",
					text: "Thinking about this...",
				}
				yield {
					type: "tool-input-start",
					id: "call_after_think",
					toolName: "test_tool",
				}
				yield {
					type: "tool-input-delta",
					id: "call_after_think",
					delta: '{"arg1":"result"}',
				}
				yield {
					type: "tool-input-end",
					id: "call_after_think",
				}
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
				tools: testTools,
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have reasoning and tool_call_end
			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			const endChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")

			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Thinking about this...")
			expect(endChunks).toHaveLength(1)
		})
	})

	describe("completePrompt", () => {
		it("should complete a prompt using generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test completion",
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Test completion")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
				}),
			)
		})
	})

	describe("OAuth credential handling", () => {
		it("should load credentials from file", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
			})
			await stream.next()

			expect(fs.readFile).toHaveBeenCalled()
		})

		it("should refresh token when expired", async () => {
			// Mock expired credentials
			const expiredCredentials = {
				access_token: "expired-token",
				refresh_token: "test-refresh-token",
				token_type: "Bearer",
				expiry_date: Date.now() - 1000, // Expired 1 second ago
				resource_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			}
			;(fs.readFile as any).mockResolvedValue(JSON.stringify(expiredCredentials))

			// Mock the token refresh endpoint
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					access_token: "new-access-token",
					refresh_token: "new-refresh-token",
					token_type: "Bearer",
					expires_in: 3600,
				}),
			})
			global.fetch = mockFetch

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
			})
			await stream.next()

			// Should have called fetch to refresh the token
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("oauth2/token"),
				expect.objectContaining({
					method: "POST",
				}),
			)

			// Should have saved the new credentials
			expect(fs.writeFile).toHaveBeenCalled()
		})
	})

	describe("getModel", () => {
		it("should return model info for valid model ID", () => {
			const model = handler.getModel()
			expect(model.id).toBe("qwen3-coder-plus")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(65536)
			expect(model.info.contextWindow).toBe(1000000)
		})

		it("should return default model if no model ID is provided", () => {
			const handlerWithoutModel = new QwenCodeHandler({})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe("qwen3-coder-plus")
			expect(model.info).toBeDefined()
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})
	})

	describe("usage metrics", () => {
		it("should include usage information", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
					details: {},
				}),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(5)
		})
	})
})
