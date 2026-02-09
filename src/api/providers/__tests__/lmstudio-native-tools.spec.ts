// npx vitest run api/providers/__tests__/lmstudio-native-tools.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
	}
})

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: vi.fn(() => {
		return vi.fn(() => ({
			modelId: "local-model",
			provider: "lmstudio",
		}))
	}),
}))

import { LmStudioHandler } from "../lm-studio"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("LmStudioHandler Native Tools", () => {
	let handler: LmStudioHandler
	let mockOptions: ApiHandlerOptions

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

		mockOptions = {
			apiModelId: "local-model",
			lmStudioModelId: "local-model",
			lmStudioBaseUrl: "http://localhost:1234",
		}
		handler = new LmStudioHandler(mockOptions)
	})

	describe("Native Tool Calling Support", () => {
		it("should include tools in request when tools are provided", async () => {
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
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.tools).toBeDefined()
		})

		it("should include toolChoice when provided", async () => {
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
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.toolChoice).toBe("auto")
		})

		it("should yield tool_call_start, tool_call_delta, and tool_call_end chunks from AI SDK stream", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-input-start",
					id: "call_lmstudio_123",
					toolName: "test_tool",
				}
				yield {
					type: "tool-input-delta",
					id: "call_lmstudio_123",
					delta: '{"arg1":"value"}',
				}
				yield {
					type: "tool-input-end",
					id: "call_lmstudio_123",
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

			const startChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
			expect(startChunks).toHaveLength(1)
			expect(startChunks[0]).toEqual({
				type: "tool_call_start",
				id: "call_lmstudio_123",
				name: "test_tool",
			})

			const deltaChunks = chunks.filter((chunk) => chunk.type === "tool_call_delta")
			expect(deltaChunks).toHaveLength(1)
			expect(deltaChunks[0]).toEqual({
				type: "tool_call_delta",
				id: "call_lmstudio_123",
				delta: '{"arg1":"value"}',
			})

			const endChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")
			expect(endChunks).toHaveLength(1)
			expect(endChunks[0]).toEqual({
				type: "tool_call_end",
				id: "call_lmstudio_123",
			})
		})

		it("should handle reasoning content alongside tool calls", async () => {
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

			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			const startChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
			const endChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")

			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Thinking about this...")
			expect(startChunks).toHaveLength(1)
			expect(endChunks).toHaveLength(1)
		})

		it("should handle text and tool calls in the same response", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Here's the result: " }
				yield {
					type: "tool-input-start",
					id: "call_mixed",
					toolName: "test_tool",
				}
				yield {
					type: "tool-input-delta",
					id: "call_mixed",
					delta: '{"arg1":"mixed"}',
				}
				yield {
					type: "tool-input-end",
					id: "call_mixed",
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

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			const startChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
			const endChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")

			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Here's the result: ")
			expect(startChunks).toHaveLength(1)
			expect(endChunks).toHaveLength(1)
		})
	})
})
