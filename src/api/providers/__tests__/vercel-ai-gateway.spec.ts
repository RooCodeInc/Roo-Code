// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
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
			modelId: "anthropic/claude-sonnet-4",
			provider: "vercel-ai-gateway",
		}))
	}),
}))

vi.mock("../fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({}),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { vercelAiGatewayDefaultModelId, VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { VercelAiGatewayHandler } from "../vercel-ai-gateway"

describe("VercelAiGatewayHandler", () => {
	let handler: VercelAiGatewayHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			vercelAiGatewayApiKey: "test-api-key",
			vercelAiGatewayModelId: "anthropic/claude-sonnet-4",
		}
		handler = new VercelAiGatewayHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(VercelAiGatewayHandler)
			expect(handler.getModel().id).toBe("anthropic/claude-sonnet-4")
		})

		it("should use default model ID if not provided", () => {
			const handlerWithoutModel = new VercelAiGatewayHandler({
				...mockOptions,
				vercelAiGatewayModelId: undefined,
			})
			expect(handlerWithoutModel.getModel().id).toBe(vercelAiGatewayDefaultModelId)
		})

		it("should use default API key if not provided", () => {
			const handlerWithoutKey = new VercelAiGatewayHandler({
				...mockOptions,
				vercelAiGatewayApiKey: undefined,
			})
			expect(handlerWithoutKey).toBeInstanceOf(VercelAiGatewayHandler)
		})
	})

	describe("getModel", () => {
		it("should return model info for the configured model", () => {
			const model = handler.getModel()
			expect(model.id).toBe("anthropic/claude-sonnet-4")
			expect(model.info).toBeDefined()
			// Falls back to default model info since cache is empty
			expect(model.info.maxTokens).toBe(64000)
			expect(model.info.contextWindow).toBe(200000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should return default model when no model ID is provided", () => {
			const handlerWithoutModel = new VercelAiGatewayHandler({
				...mockOptions,
				vercelAiGatewayModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe(vercelAiGatewayDefaultModelId)
			expect(model.info).toBeDefined()
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})

		it("should use default temperature when none is specified", () => {
			const handlerNoTemp = new VercelAiGatewayHandler({
				...mockOptions,
				modelTemperature: undefined,
			})
			const model = handlerNoTemp.getModel()
			expect(model.temperature).toBe(VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE)
		})

		it("should use custom temperature when specified", () => {
			const handlerCustomTemp = new VercelAiGatewayHandler({
				...mockOptions,
				modelTemperature: 0.5,
			})
			const model = handlerCustomTemp.getModel()
			expect(model.temperature).toBe(0.5)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: NeutralMessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text" as const,
						text: "Hello!",
					},
				],
			},
		]

		it("should handle streaming responses", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
				details: { cachedInputTokens: 3 },
				raw: { cache_creation_input_tokens: 2, cost: 0.005 },
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
		})

		it("should include usage information with gateway-specific fields", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
				details: { cachedInputTokens: 3 },
				raw: { cache_creation_input_tokens: 2, cost: 0.005 },
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheWriteTokens: 2,
				cacheReadTokens: 3,
				totalCost: 0.005,
			})
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

	describe("processUsageMetrics", () => {
		it("should correctly process usage metrics including cache and cost", () => {
			class TestHandler extends VercelAiGatewayHandler {
				public testProcessUsageMetrics(usage: any) {
					return this.processUsageMetrics(usage)
				}
			}

			const testHandler = new TestHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: { cachedInputTokens: 20 },
				raw: {
					cache_creation_input_tokens: 10,
					cost: 0.01,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(10)
			expect(result.cacheReadTokens).toBe(20)
			expect(result.totalCost).toBe(0.01)
		})

		it("should handle missing cache and cost metrics gracefully", () => {
			class TestHandler extends VercelAiGatewayHandler {
				public testProcessUsageMetrics(usage: any) {
					return this.processUsageMetrics(usage)
				}
			}

			const testHandler = new TestHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: {},
				raw: {},
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
			expect(result.totalCost).toBe(0)
		})
	})

	describe("tool handling", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: NeutralMessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Hello!" }],
			},
		]

		it("should handle tool calls in streaming", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-input-start",
					id: "tool-call-1",
					toolName: "read_file",
				}
				yield {
					type: "tool-input-delta",
					id: "tool-call-1",
					delta: '{"path":"test.ts"}',
				}
				yield {
					type: "tool-input-end",
					id: "tool-call-1",
				}
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
				details: {},
				raw: {},
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
			})

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: [
					{
						type: "function",
						function: {
							name: "read_file",
							description: "Read a file",
							parameters: {
								type: "object",
								properties: { path: { type: "string" } },
								required: ["path"],
							},
						},
					},
				],
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolCallStartChunks = chunks.filter((c) => c.type === "tool_call_start")
			const toolCallDeltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
			const toolCallEndChunks = chunks.filter((c) => c.type === "tool_call_end")

			expect(toolCallStartChunks.length).toBe(1)
			expect(toolCallStartChunks[0].id).toBe("tool-call-1")
			expect(toolCallStartChunks[0].name).toBe("read_file")

			expect(toolCallDeltaChunks.length).toBe(1)
			expect(toolCallDeltaChunks[0].delta).toBe('{"path":"test.ts"}')

			expect(toolCallEndChunks.length).toBe(1)
			expect(toolCallEndChunks[0].id).toBe("tool-call-1")
		})

		it("should ignore tool-call events to prevent duplicate tools in UI", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-call",
					toolCallId: "tool-call-1",
					toolName: "read_file",
					input: { path: "test.ts" },
				}
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
				details: {},
				raw: {},
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
			})

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: [
					{
						type: "function",
						function: {
							name: "read_file",
							description: "Read a file",
							parameters: {
								type: "object",
								properties: { path: { type: "string" } },
								required: ["path"],
							},
						},
					},
				],
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// tool-call events are ignored, so no tool_call chunks should be emitted
			const toolCallChunks = chunks.filter((c) => c.type === "tool_call")
			expect(toolCallChunks.length).toBe(0)
		})
	})
})
