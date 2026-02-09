// npx vitest run api/providers/__tests__/anthropic-vertex.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText, mockCreateVertexAnthropic } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateVertexAnthropic: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/google-vertex/anthropic", () => ({
	createVertexAnthropic: mockCreateVertexAnthropic.mockImplementation(() => {
		const modelFn = (id: string) => ({ modelId: id, provider: "vertex-anthropic" })
		modelFn.languageModel = (id: string) => ({ modelId: id, provider: "vertex-anthropic" })
		return modelFn
	}),
}))

const mockCaptureException = vi.fn()

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: (...args: unknown[]) => mockCaptureException(...args),
		},
	},
}))

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { VERTEX_1M_CONTEXT_MODEL_IDS } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"
import type { ApiStreamChunk } from "../../transform/stream"
import { AnthropicVertexHandler } from "../anthropic-vertex"

// Helper: create a standard mock fullStream async generator
function createMockFullStream(parts: Array<Record<string, unknown>>) {
	return async function* () {
		for (const part of parts) {
			yield part
		}
	}
}

// Helper: set up mock return value for streamText
function mockStreamTextReturn(
	parts: Array<Record<string, unknown>>,
	usage = { inputTokens: 10, outputTokens: 5 },
	providerMetadata: Record<string, unknown> = {},
) {
	mockStreamText.mockReturnValue({
		fullStream: createMockFullStream(parts)(),
		usage: Promise.resolve(usage),
		providerMetadata: Promise.resolve(providerMetadata),
	})
}

// Test subclass to expose protected methods
class TestAnthropicVertexHandler extends AnthropicVertexHandler {
	public testProcessUsageMetrics(
		usage: { inputTokens?: number; outputTokens?: number },
		providerMetadata?: Record<string, Record<string, unknown>>,
		modelInfo?: Record<string, unknown>,
	) {
		return this.processUsageMetrics(usage, providerMetadata, modelInfo as any)
	}
}

describe("AnthropicVertexHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		apiModelId: "claude-3-5-sonnet-v2@20241022",
		vertexProjectId: "test-project",
		vertexRegion: "us-central1",
	}

	beforeEach(() => vi.clearAllMocks())

	describe("constructor", () => {
		it("should initialize with provided config", () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			expect(handler).toBeInstanceOf(AnthropicVertexHandler)
			expect(handler.getModel().id).toBe("claude-3-5-sonnet-v2@20241022")
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant"
		const messages: NeutralMessageParam[] = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
		]

		it("should handle streaming text responses", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "Hello world!" }])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: ApiStreamChunk[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0]).toEqual({ type: "text", text: "Hello world!" })

			// Verify usage chunk
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toMatchObject({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
			})
		})

		it("should handle multiple text deltas", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([
				{ type: "text-delta", text: "First line" },
				{ type: "text-delta", text: " Second line" },
			])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: ApiStreamChunk[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0]).toEqual({ type: "text", text: "First line" })
			expect(textChunks[1]).toEqual({ type: "text", text: " Second line" })
		})

		it("should handle API errors and capture telemetry", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta" as const, text: "" }
					throw new Error("Vertex API error")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// consume
				}
			}).rejects.toThrow("Vertex API error")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Vertex API error",
					provider: "AnthropicVertex",
					modelId: mockOptions.apiModelId,
					operation: "createMessage",
				}),
			)
		})

		it("should apply cache control to system prompt and user messages for prompt-caching models", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const multiMessages: NeutralMessageParam[] = [
				{ role: "user", content: "First message" },
				{ role: "assistant", content: "Response" },
				{ role: "user", content: "Second message" },
			]

			const stream = handler.createMessage(systemPrompt, multiMessages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]

			// Verify system prompt has cache control
			expect(callArgs.system).toEqual(
				expect.objectContaining({
					role: "system",
					content: systemPrompt,
					providerOptions: expect.objectContaining({
						anthropic: { cacheControl: { type: "ephemeral" } },
					}),
				}),
			)

			// Verify user messages have cache breakpoints applied
			const aiSdkMessages = callArgs.messages
			const userMessages = aiSdkMessages.filter((m: any) => m.role === "user")

			for (const msg of userMessages) {
				const content = Array.isArray(msg.content) ? msg.content : [msg.content]
				const lastTextPart = [...content].reverse().find((p: any) => typeof p === "object" && p.type === "text")
				if (lastTextPart) {
					expect(lastTextPart.providerOptions).toEqual({
						anthropic: { cacheControl: { type: "ephemeral" } },
					})
				}
			}
		})

		it("should include Anthropic cache metrics from providerMetadata", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn(
				[{ type: "text-delta", text: "response" }],
				{ inputTokens: 100, outputTokens: 50 },
				{
					anthropic: {
						cacheCreationInputTokens: 20,
						cacheReadInputTokens: 10,
					},
				},
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: ApiStreamChunk[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
				cacheWriteTokens: 20,
				cacheReadTokens: 10,
			})
		})
	})

	describe("thinking functionality", () => {
		const systemPrompt = "You are a helpful assistant"
		const messages: NeutralMessageParam[] = [{ role: "user", content: "Hello" }]

		it("should handle reasoning stream parts", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([
				{ type: "reasoning", text: "Let me think about this..." },
				{ type: "text-delta", text: "Here's my answer:" },
			])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: ApiStreamChunk[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0]).toEqual({ type: "reasoning", text: "Let me think about this..." })

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0]).toEqual({ type: "text", text: "Here's my answer:" })
		})

		it("should handle multiple reasoning parts", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([
				{ type: "reasoning", text: "First thinking block" },
				{ type: "reasoning", text: "Second thinking block" },
				{ type: "text-delta", text: "Answer" },
			])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: ApiStreamChunk[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(2)
			expect(reasoningChunks[0]).toEqual({ type: "reasoning", text: "First thinking block" })
			expect(reasoningChunks[1]).toEqual({ type: "reasoning", text: "Second thinking block" })
		})
	})

	describe("reasoning block handling", () => {
		const systemPrompt = "You are a helpful assistant"

		it("should pass reasoning blocks through convertToAiSdkMessages", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "Response" }])

			const messagesWithReasoning: NeutralMessageParam[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: [
						{ type: "reasoning" as any, text: "This is internal reasoning" },
						{ type: "text", text: "This is the response" },
					],
				},
				{ role: "user", content: "Continue" },
			]

			const stream = handler.createMessage(systemPrompt, messagesWithReasoning)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			const aiSdkMessages = callArgs.messages

			// Verify convertToAiSdkMessages processed the messages
			expect(aiSdkMessages.length).toBeGreaterThan(0)

			// Check assistant message exists with content
			const assistantMessage = aiSdkMessages.find((m: any) => m.role === "assistant")
			expect(assistantMessage).toBeDefined()
			expect(assistantMessage.content).toBeDefined()
		})

		it("should handle messages with only reasoning content", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "Response" }])

			const messagesWithOnlyReasoning: NeutralMessageParam[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: [{ type: "reasoning" as any, text: "Only reasoning, no actual text" }],
				},
				{ role: "user", content: "Continue" },
			]

			const stream = handler.createMessage(systemPrompt, messagesWithOnlyReasoning)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			const aiSdkMessages = callArgs.messages

			// The call should succeed and messages should be present
			expect(aiSdkMessages.length).toBeGreaterThan(0)
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockGenerateText.mockResolvedValue({ text: "Test response" })

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
					temperature: 0,
				}),
			)
		})

		it("should handle API errors and capture telemetry", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockGenerateText.mockRejectedValue(new Error("Vertex API error"))

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("Vertex API error")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Vertex API error",
					provider: "AnthropicVertex",
					modelId: mockOptions.apiModelId,
					operation: "completePrompt",
				}),
			)
		})

		it("should handle empty response", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockGenerateText.mockResolvedValue({ text: "" })

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should pass model and temperature to generateText", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockGenerateText.mockResolvedValue({ text: "response" })

			await handler.completePrompt("Test prompt")

			const callArgs = mockGenerateText.mock.calls[0][0]
			expect(callArgs.prompt).toBe("Test prompt")
			expect(callArgs.temperature).toBe(0)
			expect(callArgs.model).toBeDefined()
		})
	})

	describe("getModel", () => {
		it("should return correct model info", () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe("claude-3-5-sonnet-v2@20241022")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(8192)
			expect(modelInfo.info.contextWindow).toBe(200_000)
		})

		it("should honor custom maxTokens for thinking models", () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-7-sonnet@20250219:thinking",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = handler.getModel()
			expect(result.maxTokens).toBe(32_768)
			expect(result.reasoningBudget).toEqual(16_384)
			expect(result.temperature).toBe(1.0)
		})

		it("should not honor custom maxTokens for non-thinking models", () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-7-sonnet@20250219",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = handler.getModel()
			expect(result.maxTokens).toBe(8192)
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0)
		})

		it("should enable 1M context for first supported model when beta flag is set", () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: VERTEX_1M_CONTEXT_MODEL_IDS[0],
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				vertex1MContext: true,
			})

			const model = handler.getModel()
			expect(model.info.contextWindow).toBe(1_000_000)
			expect(model.info.inputPrice).toBe(6.0)
			expect(model.info.outputPrice).toBe(22.5)
			expect(model.betas).toContain("context-1m-2025-08-07")
		})

		it("should enable 1M context for second supported model when beta flag is set", () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: VERTEX_1M_CONTEXT_MODEL_IDS[1],
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				vertex1MContext: true,
			})

			const model = handler.getModel()
			expect(model.info.contextWindow).toBe(1_000_000)
			expect(model.info.inputPrice).toBe(6.0)
			expect(model.info.outputPrice).toBe(22.5)
			expect(model.betas).toContain("context-1m-2025-08-07")
		})

		it("should not enable 1M context when flag is disabled", () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: VERTEX_1M_CONTEXT_MODEL_IDS[0],
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				vertex1MContext: false,
			})

			const model = handler.getModel()
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.inputPrice).toBe(3.0)
			expect(model.info.outputPrice).toBe(15.0)
			expect(model.betas).toBeUndefined()
		})

		it("should not enable 1M context for non-supported models even with flag", () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				vertex1MContext: true,
			})

			const model = handler.getModel()
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.betas).toBeUndefined()
		})
	})

	describe("1M context beta header", () => {
		const systemPrompt = "You are a helpful assistant"
		const messages: NeutralMessageParam[] = [{ role: "user", content: "Hello" }]

		it("should include anthropic-beta header when 1M context is enabled", async () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: VERTEX_1M_CONTEXT_MODEL_IDS[0],
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				vertex1MContext: true,
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.headers).toEqual({ "anthropic-beta": "context-1m-2025-08-07" })
		})

		it("should not include anthropic-beta header when 1M context is disabled", async () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: VERTEX_1M_CONTEXT_MODEL_IDS[0],
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				vertex1MContext: false,
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.headers).toBeUndefined()
		})
	})

	describe("thinking model configuration", () => {
		it("should configure thinking for models with :thinking suffix", () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-7-sonnet@20250219:thinking",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				modelMaxTokens: 16384,
				modelMaxThinkingTokens: 4096,
			})

			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe("claude-3-7-sonnet@20250219")
			expect(modelInfo.reasoningBudget).toBe(4096)
			expect(modelInfo.temperature).toBe(1.0) // Thinking requires temperature 1.0
		})

		it("should calculate thinking budget correctly", () => {
			// Test with explicit thinking budget
			const handlerWithBudget = new AnthropicVertexHandler({
				apiModelId: "claude-3-7-sonnet@20250219:thinking",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				modelMaxTokens: 16384,
				modelMaxThinkingTokens: 5000,
			})
			expect(handlerWithBudget.getModel().reasoningBudget).toBe(5000)

			// Test with default thinking budget (80% of max tokens)
			const handlerWithDefaultBudget = new AnthropicVertexHandler({
				apiModelId: "claude-3-7-sonnet@20250219:thinking",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				modelMaxTokens: 10000,
			})
			expect(handlerWithDefaultBudget.getModel().reasoningBudget).toBe(8000) // 80% of 10000

			// Test with minimum thinking budget (should be at least 1024)
			const handlerWithSmallMaxTokens = new AnthropicVertexHandler({
				apiModelId: "claude-3-7-sonnet@20250219:thinking",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				modelMaxTokens: 1000,
			})
			expect(handlerWithSmallMaxTokens.getModel().reasoningBudget).toBe(1024)
		})

		it("should pass thinking configuration via providerOptions", async () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-7-sonnet@20250219:thinking",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				modelMaxTokens: 16384,
				modelMaxThinkingTokens: 4096,
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("You are a helpful assistant", [{ role: "user", content: "Hello" }])
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions).toBeDefined()
			expect(callArgs.providerOptions.anthropic.thinking).toEqual({
				type: "enabled",
				budgetTokens: 4096,
			})
			expect(callArgs.temperature).toBe(1.0)
		})

		it("should not set providerOptions for non-thinking models", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("You are a helpful assistant", [{ role: "user", content: "Hello" }])
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions).toBeUndefined()
		})
	})

	describe("native tool calling", () => {
		const systemPrompt = "You are a helpful assistant"
		const messages: NeutralMessageParam[] = [
			{ role: "user", content: [{ type: "text" as const, text: "What's the weather in London?" }] },
		]

		const mockTools = [
			{
				type: "function" as const,
				function: {
					name: "get_weather",
					description: "Get the current weather",
					parameters: {
						type: "object",
						properties: { location: { type: "string" } },
						required: ["location"],
					},
				},
			},
		]

		it("should include tools in streamText call when tools are provided", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: mockTools,
			})
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.tools).toBeDefined()
			expect(callArgs.tools.get_weather).toBeDefined()
		})

		it("should handle tool calls via AI SDK stream parts", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([
				{ type: "tool-input-start", id: "toolu_123", toolName: "get_weather" },
				{ type: "tool-input-delta", id: "toolu_123", delta: '{"location":' },
				{ type: "tool-input-delta", id: "toolu_123", delta: '"London"}' },
				{ type: "tool-input-end", id: "toolu_123" },
			])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: ApiStreamChunk[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolCallStart = chunks.filter((c) => c.type === "tool_call_start")
			expect(toolCallStart).toHaveLength(1)
			expect(toolCallStart[0]).toMatchObject({
				type: "tool_call_start",
				id: "toolu_123",
				name: "get_weather",
			})

			const toolCallDeltas = chunks.filter((c) => c.type === "tool_call_delta")
			expect(toolCallDeltas).toHaveLength(2)

			const toolCallEnd = chunks.filter((c) => c.type === "tool_call_end")
			expect(toolCallEnd).toHaveLength(1)
		})

		it("should pass tool_choice via mapToolChoice", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tool_choice: "auto",
			})
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.toolChoice).toBe("auto")
		})

		it("should include maxOutputTokens from model info", async () => {
			const handler = new AnthropicVertexHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBe(8192)
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly process basic usage metrics", () => {
			const handler = new TestAnthropicVertexHandler(mockOptions)
			const result = handler.testProcessUsageMetrics({ inputTokens: 100, outputTokens: 50 }, undefined, {
				inputPrice: 3.0,
				outputPrice: 15.0,
			})

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})

		it("should extract Anthropic cache metrics from provider metadata", () => {
			const handler = new TestAnthropicVertexHandler(mockOptions)
			const result = handler.testProcessUsageMetrics(
				{ inputTokens: 100, outputTokens: 50 },
				{
					anthropic: {
						cacheCreationInputTokens: 20,
						cacheReadInputTokens: 10,
					},
				},
				{
					inputPrice: 3.0,
					outputPrice: 15.0,
					cacheWritesPrice: 3.75,
					cacheReadsPrice: 0.3,
				},
			)

			expect(result.cacheWriteTokens).toBe(20)
			expect(result.cacheReadTokens).toBe(10)
			expect(result.totalCost).toBeDefined()
			expect(result.totalCost).toBeGreaterThan(0)
		})

		it("should handle missing provider metadata gracefully", () => {
			const handler = new TestAnthropicVertexHandler(mockOptions)
			const result = handler.testProcessUsageMetrics({ inputTokens: 100, outputTokens: 50 }, undefined, {
				inputPrice: 3.0,
				outputPrice: 15.0,
			})

			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})

		it("should calculate cost using Anthropic-specific pricing", () => {
			const handler = new TestAnthropicVertexHandler(mockOptions)
			const result = handler.testProcessUsageMetrics(
				{ inputTokens: 1000, outputTokens: 500 },
				{
					anthropic: {
						cacheCreationInputTokens: 200,
						cacheReadInputTokens: 100,
					},
				},
				{
					inputPrice: 3.0,
					outputPrice: 15.0,
					cacheWritesPrice: 3.75,
					cacheReadsPrice: 0.3,
				},
			)

			// Cost = (3.0/1M * 1000) + (15.0/1M * 500) + (3.75/1M * 200) + (0.3/1M * 100)
			const expectedCost = (3.0 * 1000 + 15.0 * 500 + 3.75 * 200 + 0.3 * 100) / 1_000_000
			expect(result.totalCost).toBeCloseTo(expectedCost, 10)
		})
	})

	describe("auth paths", () => {
		it("should pass JSON credentials via googleAuthOptions", async () => {
			const jsonCreds = JSON.stringify({ type: "service_account", project_id: "test" })
			const handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-east5",
				vertexJsonCredentials: jsonCreds,
			})

			mockGenerateText.mockResolvedValue({ text: "response" })
			await handler.completePrompt("test")

			expect(mockCreateVertexAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					project: "test-project",
					location: "us-east5",
					googleAuthOptions: {
						credentials: JSON.parse(jsonCreds),
					},
				}),
			)
		})

		it("should pass key file via googleAuthOptions", async () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-east5",
				vertexKeyFile: "/path/to/key.json",
			})

			mockGenerateText.mockResolvedValue({ text: "response" })
			await handler.completePrompt("test")

			expect(mockCreateVertexAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					project: "test-project",
					location: "us-east5",
					googleAuthOptions: {
						keyFile: "/path/to/key.json",
					},
				}),
			)
		})

		it("should not pass googleAuthOptions for default ADC", async () => {
			const handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-east5",
			})

			mockGenerateText.mockResolvedValue({ text: "response" })
			await handler.completePrompt("test")

			expect(mockCreateVertexAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					project: "test-project",
					location: "us-east5",
				}),
			)
			// googleAuthOptions should be undefined (not passed)
			const callArg = mockCreateVertexAnthropic.mock.calls[0][0]
			expect(callArg.googleAuthOptions).toBeUndefined()
		})
	})
})
