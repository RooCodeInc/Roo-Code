import type { RooMessage } from "../../../core/task-persistence/rooMessage"
// npx vitest run src/api/providers/__tests__/anthropic-vertex.spec.ts

import { AnthropicVertexHandler } from "../anthropic-vertex"
import { ApiHandlerOptions } from "../../../shared/api"

import { VERTEX_1M_CONTEXT_MODEL_IDS } from "@roo-code/types"

import { ApiStreamChunk } from "../../transform/stream"

// Mock TelemetryService
vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: vitest.fn(),
		},
	},
}))

// Mock the AI SDK
const mockStreamText = vitest.fn()
const mockGenerateText = vitest.fn()

vitest.mock("ai", () => ({
	streamText: (...args: any[]) => mockStreamText(...args),
	generateText: (...args: any[]) => mockGenerateText(...args),
	tool: vitest.fn(),
	jsonSchema: vitest.fn(),
	ToolSet: {},
}))

// Mock the @ai-sdk/google-vertex/anthropic provider
const mockCreateVertexAnthropic = vitest.fn()

vitest.mock("@ai-sdk/google-vertex/anthropic", () => ({
	createVertexAnthropic: (...args: any[]) => mockCreateVertexAnthropic(...args),
}))

// Mock ai-sdk transform utilities
vitest.mock("../../transform/ai-sdk", () => ({
	convertToAiSdkMessages: vitest.fn().mockReturnValue([{ role: "user", content: [{ type: "text", text: "Hello" }] }]),
	convertToolsForAiSdk: vitest.fn().mockReturnValue(undefined),
	processAiSdkStreamPart: vitest.fn().mockImplementation(function* (part: any) {
		if (part.type === "text-delta") {
			yield { type: "text", text: part.text }
		} else if (part.type === "reasoning-delta") {
			yield { type: "reasoning", text: part.text }
		} else if (part.type === "tool-input-start") {
			yield { type: "tool_call_start", id: part.id, name: part.toolName }
		} else if (part.type === "tool-input-delta") {
			yield { type: "tool_call_delta", id: part.id, delta: part.delta }
		} else if (part.type === "tool-input-end") {
			yield { type: "tool_call_end", id: part.id }
		}
	}),
	mapToolChoice: vitest.fn().mockReturnValue(undefined),
	handleAiSdkError: vitest.fn().mockImplementation((error: any) => error),
}))

// Import mocked modules
import { convertToAiSdkMessages, convertToolsForAiSdk, mapToolChoice } from "../../transform/ai-sdk"
import { Anthropic } from "@anthropic-ai/sdk"

// Helper: create a mock provider function
function createMockProviderFn() {
	const providerFn = vitest.fn().mockReturnValue("mock-model")
	return providerFn
}

// Helper: create a mock streamText result
function createMockStreamResult(
	parts: any[],
	usage?: { inputTokens: number; outputTokens: number },
	providerMetadata?: Record<string, any>,
) {
	return {
		fullStream: (async function* () {
			for (const part of parts) {
				yield part
			}
		})(),
		usage: Promise.resolve(usage ?? { inputTokens: 0, outputTokens: 0 }),
		providerMetadata: Promise.resolve(providerMetadata ?? {}),
	}
}

describe("AnthropicVertexHandler", () => {
	let handler: AnthropicVertexHandler
	let mockProviderFn: ReturnType<typeof createMockProviderFn>

	beforeEach(() => {
		mockProviderFn = createMockProviderFn()
		mockCreateVertexAnthropic.mockReturnValue(mockProviderFn)
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided config for Claude", () => {
			handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			expect(mockCreateVertexAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					project: "test-project",
					location: "us-central1",
				}),
			)
		})

		it("should use JSON credentials when provided", () => {
			const credentials = { client_email: "test@test.com", private_key: "test-key" }
			handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				vertexJsonCredentials: JSON.stringify(credentials),
			})

			expect(mockCreateVertexAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					googleAuthOptions: { credentials },
				}),
			)
		})

		it("should use key file when provided", () => {
			handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				vertexKeyFile: "/path/to/key.json",
			})

			expect(mockCreateVertexAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					googleAuthOptions: { keyFile: "/path/to/key.json" },
				}),
			)
		})

		it("should use default values when project/region not provided", () => {
			handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
			})

			expect(mockCreateVertexAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					project: "not-provided",
					location: "us-east5",
				}),
			)
		})

		it("should include anthropic-beta header when 1M context is enabled", () => {
			handler = new AnthropicVertexHandler({
				apiModelId: VERTEX_1M_CONTEXT_MODEL_IDS[0],
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				vertex1MContext: true,
			})

			expect(mockCreateVertexAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						"anthropic-beta": "context-1m-2025-08-07",
					}),
				}),
			)
		})

		it("should not include anthropic-beta header when 1M context is disabled", () => {
			handler = new AnthropicVertexHandler({
				apiModelId: VERTEX_1M_CONTEXT_MODEL_IDS[0],
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				vertex1MContext: false,
			})

			const calledHeaders = mockCreateVertexAnthropic.mock.calls[0][0].headers
			expect(calledHeaders["anthropic-beta"]).toBeUndefined()
		})
	})

	describe("createMessage", () => {
		const mockMessages: RooMessage[] = [
			{
				role: "user",
				content: "Hello",
			},
			{
				role: "assistant",
				content: "Hi there!",
			},
		]

		const systemPrompt = "You are a helpful assistant"

		beforeEach(() => {
			handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})
		})

		it("should handle streaming responses correctly for Claude", async () => {
			const streamParts = [
				{ type: "text-delta", text: "Hello" },
				{ type: "text-delta", text: " world!" },
			]

			mockStreamText.mockReturnValue(createMockStreamResult(streamParts, { inputTokens: 10, outputTokens: 5 }))

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks: ApiStreamChunk[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Text chunks from processAiSdkStreamPart + final usage
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0]).toEqual({ type: "text", text: "Hello" })
			expect(textChunks[1]).toEqual({ type: "text", text: " world!" })

			// Usage chunk at the end
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toMatchObject({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
			})

			// Verify streamText was called with correct params
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "mock-model",
					system: systemPrompt,
				}),
			)
		})

		it("should pass messages directly to streamText as ModelMessage[]", async () => {
			mockStreamText.mockReturnValue(createMockStreamResult([]))

			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const _chunk of stream) {
				// consume
			}

			// Messages are now already in ModelMessage format, passed directly to streamText
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: mockMessages,
				}),
			)
		})

		it("should pass tools through AI SDK conversion pipeline", async () => {
			mockStreamText.mockReturnValue(createMockStreamResult([]))

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

			const stream = handler.createMessage(systemPrompt, mockMessages, {
				taskId: "test-task",
				tools: mockTools,
			})

			for await (const _chunk of stream) {
				// consume
			}

			expect(convertToolsForAiSdk).toHaveBeenCalled()
		})

		it("should handle API errors for Claude", async () => {
			const mockError = new Error("Vertex API error")
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta", text: "" }
					throw mockError
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should throw before yielding meaningful chunks
				}
			}).rejects.toThrow()
		})

		it("should handle cache-related usage metrics from providerMetadata", async () => {
			mockStreamText.mockReturnValue(
				createMockStreamResult(
					[{ type: "text-delta", text: "Hello" }],
					{ inputTokens: 10, outputTokens: 5 },
					{
						anthropic: {
							cacheCreationInputTokens: 3,
							cacheReadInputTokens: 2,
						},
					},
				),
			)

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks: ApiStreamChunk[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toMatchObject({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheWriteTokens: 3,
				cacheReadTokens: 2,
			})
		})

		it("should handle reasoning/thinking stream events", async () => {
			const streamParts = [
				{ type: "reasoning-delta", text: "Let me think about this..." },
				{ type: "reasoning-delta", text: " I need to consider all options." },
				{ type: "text-delta", text: "Here's my answer:" },
			]

			mockStreamText.mockReturnValue(createMockStreamResult(streamParts))

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks: ApiStreamChunk[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(2)
			expect(reasoningChunks[0].text).toBe("Let me think about this...")
			expect(reasoningChunks[1].text).toBe(" I need to consider all options.")

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Here's my answer:")
		})

		it("should capture thought signature from stream events", async () => {
			const streamParts = [
				{
					type: "reasoning-delta",
					text: "thinking...",
					providerMetadata: {
						anthropic: { signature: "test-signature-abc123" },
					},
				},
				{ type: "text-delta", text: "answer" },
			]

			mockStreamText.mockReturnValue(createMockStreamResult(streamParts))

			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const _chunk of stream) {
				// consume
			}

			expect(handler.getThoughtSignature()).toBe("test-signature-abc123")
		})

		it("should capture redacted thinking blocks from stream events", async () => {
			const streamParts = [
				{
					type: "reasoning-delta",
					text: "",
					providerMetadata: {
						anthropic: { redactedData: "encrypted-redacted-data" },
					},
				},
				{ type: "text-delta", text: "answer" },
			]

			mockStreamText.mockReturnValue(createMockStreamResult(streamParts))

			const stream = handler.createMessage(systemPrompt, mockMessages)
			for await (const _chunk of stream) {
				// consume
			}

			const redactedBlocks = handler.getRedactedThinkingBlocks()
			expect(redactedBlocks).toHaveLength(1)
			expect(redactedBlocks![0]).toEqual({
				type: "redacted_thinking",
				data: "encrypted-redacted-data",
			})
		})

		it("should configure thinking providerOptions for thinking models", async () => {
			const thinkingHandler = new AnthropicVertexHandler({
				apiModelId: "claude-3-7-sonnet@20250219:thinking",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				modelMaxTokens: 16384,
				modelMaxThinkingTokens: 4096,
			})

			mockStreamText.mockReturnValue(createMockStreamResult([]))

			const stream = thinkingHandler.createMessage(systemPrompt, [{ role: "user", content: "Hello" }])
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: expect.objectContaining({
						anthropic: expect.objectContaining({
							thinking: {
								type: "enabled",
								budgetTokens: 4096,
							},
						}),
					}),
				}),
			)
		})
	})

	describe("completePrompt", () => {
		beforeEach(() => {
			handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})
		})

		it("should complete prompt successfully for Claude", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test response",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "mock-model",
					prompt: "Test prompt",
				}),
			)
		})

		it("should handle API errors for Claude", async () => {
			const mockError = new Error("Vertex API error")
			mockGenerateText.mockRejectedValue(mockError)

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow()
		})
	})

	describe("getModel", () => {
		it("should return correct model info for Claude", () => {
			handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe("claude-3-5-sonnet-v2@20241022")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(8192)
			expect(modelInfo.info.contextWindow).toBe(200_000)
		})

		it("honors custom maxTokens for thinking models", () => {
			const handler = new AnthropicVertexHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet@20250219:thinking",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = handler.getModel()
			expect(result.maxTokens).toBe(32_768)
			expect(result.reasoningBudget).toEqual(16_384)
			expect(result.temperature).toBe(1.0)
		})

		it("does not honor custom maxTokens for non-thinking models", () => {
			const handler = new AnthropicVertexHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet@20250219",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = handler.getModel()
			expect(result.maxTokens).toBe(8192)
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0)
		})

		it("should enable 1M context for Claude Sonnet 4 when beta flag is set", () => {
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

		it("should enable 1M context for Claude Sonnet 4.5 when beta flag is set", () => {
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

	describe("thinking model configuration", () => {
		it("should configure thinking for models with :thinking suffix", () => {
			const thinkingHandler = new AnthropicVertexHandler({
				apiModelId: "claude-3-7-sonnet@20250219:thinking",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				modelMaxTokens: 16384,
				modelMaxThinkingTokens: 4096,
			})

			const modelInfo = thinkingHandler.getModel()

			expect(modelInfo.id).toBe("claude-3-7-sonnet@20250219")
			expect(modelInfo.reasoningBudget).toBe(4096)
			expect(modelInfo.temperature).toBe(1.0)
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
				modelMaxTokens: 1000, // This would result in 800 tokens for thinking, but minimum is 1024
			})

			expect(handlerWithSmallMaxTokens.getModel().reasoningBudget).toBe(1024)
		})

		it("should pass thinking configuration to API via providerOptions", async () => {
			const thinkingHandler = new AnthropicVertexHandler({
				apiModelId: "claude-3-7-sonnet@20250219:thinking",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				modelMaxTokens: 16384,
				modelMaxThinkingTokens: 4096,
			})

			mockStreamText.mockReturnValue(createMockStreamResult([]))

			const stream = thinkingHandler.createMessage("You are a helpful assistant", [
				{ role: "user", content: "Hello" },
			])

			for await (const _chunk of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 1.0,
					providerOptions: expect.objectContaining({
						anthropic: expect.objectContaining({
							thinking: {
								type: "enabled",
								budgetTokens: 4096,
							},
						}),
					}),
				}),
			)
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("thought signature and redacted thinking", () => {
		beforeEach(() => {
			handler = new AnthropicVertexHandler({
				apiModelId: "claude-3-5-sonnet-v2@20241022",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})
		})

		it("should return undefined for thought signature before any request", () => {
			expect(handler.getThoughtSignature()).toBeUndefined()
		})

		it("should return undefined for redacted thinking blocks before any request", () => {
			expect(handler.getRedactedThinkingBlocks()).toBeUndefined()
		})

		it("should reset thought signature on each createMessage call", async () => {
			// First call with signature
			mockStreamText.mockReturnValue(
				createMockStreamResult([
					{
						type: "reasoning-delta",
						text: "thinking",
						providerMetadata: { anthropic: { signature: "sig-1" } },
					},
				]),
			)

			const stream1 = handler.createMessage("test", [{ role: "user", content: "Hello" }])
			for await (const _chunk of stream1) {
				// consume
			}
			expect(handler.getThoughtSignature()).toBe("sig-1")

			// Second call without signature
			mockStreamText.mockReturnValue(createMockStreamResult([{ type: "text-delta", text: "just text" }]))

			const stream2 = handler.createMessage("test", [{ role: "user", content: "Hello again" }])
			for await (const _chunk of stream2) {
				// consume
			}
			expect(handler.getThoughtSignature()).toBeUndefined()
		})
	})
})
