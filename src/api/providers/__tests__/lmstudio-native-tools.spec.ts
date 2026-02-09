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
		generateText: vi.fn(),
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

describe("LmStudioHandler Native Tools (AI SDK)", () => {
	let handler: LmStudioHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		vi.clearAllMocks()

		mockOptions = {
			apiModelId: "local-model",
			lmStudioModelId: "local-model",
			lmStudioBaseUrl: "http://localhost:1234",
		}
		handler = new LmStudioHandler(mockOptions)
	})

	describe("Native Tool Calling Support via AI SDK", () => {
		it("should pass tools to streamText when tools are provided in metadata", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
				tools: [
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
				],
			})

			// Drain the stream
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Object),
				}),
			)
		})

		it("should yield tool_call_start, tool_call_delta, and tool_call_end chunks", async () => {
			async function* mockFullStream() {
				yield { type: "tool-input-start", id: "call_lmstudio_123", toolName: "test_tool" }
				yield { type: "tool-input-delta", id: "call_lmstudio_123", delta: '{"arg1":"value"}' }
				yield { type: "tool-input-end", id: "call_lmstudio_123" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toContainEqual({
				type: "tool_call_start",
				id: "call_lmstudio_123",
				name: "test_tool",
			})

			expect(chunks).toContainEqual({
				type: "tool_call_delta",
				id: "call_lmstudio_123",
				delta: '{"arg1":"value"}',
			})

			expect(chunks).toContainEqual({
				type: "tool_call_end",
				id: "call_lmstudio_123",
			})
		})

		it("should handle reasoning content alongside tool calls", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning-delta", text: "Thinking about this..." }
				yield { type: "tool-input-start", id: "call_after_think", toolName: "test_tool" }
				yield { type: "tool-input-delta", id: "call_after_think", delta: '{"arg1":"result"}' }
				yield { type: "tool-input-end", id: "call_after_think" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have reasoning, tool_call_start, tool_call_delta, and tool_call_end
			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			const startChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
			const endChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")

			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Thinking about this...")
			expect(startChunks).toHaveLength(1)
			expect(endChunks).toHaveLength(1)
		})

		it("should handle multiple sequential tool calls", async () => {
			async function* mockFullStream() {
				yield { type: "tool-input-start", id: "call_1", toolName: "tool_a" }
				yield { type: "tool-input-delta", id: "call_1", delta: '{"x":"1"}' }
				yield { type: "tool-input-end", id: "call_1" }
				yield { type: "tool-input-start", id: "call_2", toolName: "tool_b" }
				yield { type: "tool-input-delta", id: "call_2", delta: '{"y":"2"}' }
				yield { type: "tool-input-end", id: "call_2" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const startChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
			const endChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")

			expect(startChunks).toHaveLength(2)
			expect(endChunks).toHaveLength(2)
			expect(startChunks[0].name).toBe("tool_a")
			expect(startChunks[1].name).toBe("tool_b")
		})

		it("should pass tool_choice to streamText when provided", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("test prompt", [], {
				taskId: "test-task-id",
				tool_choice: "auto",
			})
			for await (const _chunk of stream) {
				// drain
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					toolChoice: "auto",
				}),
			)
		})
	})
})
