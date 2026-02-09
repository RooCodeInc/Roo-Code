// npx vitest run api/providers/__tests__/anthropic.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText, mockCreateAnthropic } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateAnthropic: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/anthropic", () => ({
	createAnthropic: mockCreateAnthropic.mockImplementation(() => ({
		chat: vi.fn((id: string) => ({ modelId: id, provider: "anthropic" })),
	})),
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
import type { ApiHandlerOptions } from "../../../shared/api"
import { AnthropicHandler } from "../anthropic"

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
class TestAnthropicHandler extends AnthropicHandler {
	public testProcessUsageMetrics(
		usage: { inputTokens?: number; outputTokens?: number },
		providerMetadata?: Record<string, Record<string, unknown>>,
		modelInfo?: Record<string, unknown>,
	) {
		return this.processUsageMetrics(usage, providerMetadata, modelInfo as any)
	}
}

describe("AnthropicHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		apiKey: "test-api-key",
		apiModelId: "claude-3-5-sonnet-20241022",
	}

	beforeEach(() => vi.clearAllMocks())

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			const handler = new AnthropicHandler(mockOptions)
			expect(handler).toBeInstanceOf(AnthropicHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should initialize with undefined API key", () => {
			const handler = new AnthropicHandler({ ...mockOptions, apiKey: undefined })
			expect(handler).toBeInstanceOf(AnthropicHandler)
		})

		it("should use custom base URL if provided", async () => {
			const handler = new AnthropicHandler({
				...mockOptions,
				anthropicBaseUrl: "https://custom.anthropic.com",
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("test", [{ role: "user", content: "hello" }])
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://custom.anthropic.com",
				}),
			)
		})

		it("should pass undefined baseURL when empty string provided", async () => {
			const handler = new AnthropicHandler({
				...mockOptions,
				anthropicBaseUrl: "",
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("test", [{ role: "user", content: "hello" }])
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: undefined,
				}),
			)
		})

		it("should use apiKey when anthropicUseAuthToken is not set", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("test", [{ role: "user", content: "hello" }])
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockCreateAnthropic).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "test-api-key" }))
			expect(mockCreateAnthropic.mock.calls[0][0]).not.toHaveProperty("authToken")
		})

		it("should use apiKey when anthropicUseAuthToken is set but no base URL", async () => {
			const handler = new AnthropicHandler({
				...mockOptions,
				anthropicUseAuthToken: true,
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("test", [{ role: "user", content: "hello" }])
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockCreateAnthropic).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "test-api-key" }))
			expect(mockCreateAnthropic.mock.calls[0][0]).not.toHaveProperty("authToken")
		})

		it("should use authToken when both anthropicBaseUrl and anthropicUseAuthToken are set", async () => {
			const handler = new AnthropicHandler({
				...mockOptions,
				anthropicBaseUrl: "https://custom.anthropic.com",
				anthropicUseAuthToken: true,
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("test", [{ role: "user", content: "hello" }])
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					authToken: "test-api-key",
					baseURL: "https://custom.anthropic.com",
				}),
			)
			expect(mockCreateAnthropic.mock.calls[0][0]).not.toHaveProperty("apiKey")
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			const handler = new AnthropicHandler(mockOptions)
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("getModel", () => {
		it("should return default model if no model ID is provided", () => {
			const handler = new AnthropicHandler({ ...mockOptions, apiModelId: undefined })
			const model = handler.getModel()
			expect(model.id).toBeDefined()
			expect(model.info).toBeDefined()
		})

		it("should return specified model if valid model ID is provided", () => {
			const handler = new AnthropicHandler(mockOptions)
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.apiModelId)
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should honor custom maxTokens for thinking models", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = handler.getModel()
			expect(result.maxTokens).toBe(32_768)
			expect(result.reasoningBudget).toEqual(16_384)
			expect(result.temperature).toBe(1.0)
		})

		it("should not honor custom maxTokens for non-thinking models", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = handler.getModel()
			expect(result.maxTokens).toBe(8192)
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0)
		})

		it("should strip :thinking suffix from model ID and include betas", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
			})

			const model = handler.getModel()
			expect(model.id).toBe("claude-3-7-sonnet-20250219")
			expect(model.betas).toContain("output-128k-2025-02-19")
		})

		it("should handle Claude 4.5 Sonnet model correctly", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-sonnet-4-5",
			})
			const model = handler.getModel()
			expect(model.id).toBe("claude-sonnet-4-5")
			expect(model.info.maxTokens).toBe(64000)
			expect(model.info.contextWindow).toBe(200000)
			expect(model.info.supportsReasoningBudget).toBe(true)
		})

		it("should enable 1M context for Claude 4.5 Sonnet when beta flag is set", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-sonnet-4-5",
				anthropicBeta1MContext: true,
			})
			const model = handler.getModel()
			expect(model.info.contextWindow).toBe(1000000)
			expect(model.info.inputPrice).toBe(6.0)
			expect(model.info.outputPrice).toBe(22.5)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: NeutralMessageParam[] = [{ role: "user", content: [{ type: "text" as const, text: "Hello!" }] }]

		it("should handle streaming text responses", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "Test response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
		})

		it("should include usage information", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }], { inputTokens: 100, outputTokens: 50 })

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.inputTokens).toBe(100)
			expect(usageChunk.outputTokens).toBe(50)
		})

		it("should include Anthropic cache metrics from providerMetadata", async () => {
			const handler = new AnthropicHandler(mockOptions)
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
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.cacheWriteTokens).toBe(20)
			expect(usageChunk.cacheReadTokens).toBe(10)
		})

		it("should apply cache control to system prompt for prompt-caching models", async () => {
			const handler = new AnthropicHandler(mockOptions) // claude-3-5-sonnet supports prompt cache
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.system).toEqual(
				expect.objectContaining({
					role: "system",
					content: systemPrompt,
					providerOptions: expect.objectContaining({
						anthropic: { cacheControl: { type: "ephemeral" } },
					}),
				}),
			)
		})

		it("should apply cache breakpoints to last 2 user messages", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const multiMessages: NeutralMessageParam[] = [
				{ role: "user", content: [{ type: "text" as const, text: "First message" }] },
				{ role: "assistant", content: [{ type: "text" as const, text: "Response" }] },
				{ role: "user", content: [{ type: "text" as const, text: "Second message" }] },
			]

			const stream = handler.createMessage(systemPrompt, multiMessages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			const aiSdkMessages = callArgs.messages
			const userMessages = aiSdkMessages.filter((m: any) => m.role === "user")

			// Both user messages should have cache control applied
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

		it("should pass temperature 0 as default", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.temperature).toBe(0)
		})

		it("should include maxOutputTokens from model info", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBe(8192)
		})

		it("should handle reasoning stream parts", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([
				{ type: "reasoning", text: "Let me think..." },
				{ type: "text-delta", text: "The answer is 42" },
			])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Let me think...")

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("The answer is 42")
		})

		it("should handle tool calls via AI SDK stream parts", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([
				{ type: "tool-input-start", id: "toolu_123", toolName: "get_weather" },
				{ type: "tool-input-delta", id: "toolu_123", delta: '{"location":' },
				{ type: "tool-input-delta", id: "toolu_123", delta: '"London"}' },
				{ type: "tool-input-end", id: "toolu_123" },
			])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolCallStart = chunks.filter((c) => c.type === "tool_call_start")
			expect(toolCallStart).toHaveLength(1)
			expect(toolCallStart[0].id).toBe("toolu_123")
			expect(toolCallStart[0].name).toBe("get_weather")

			const toolCallDeltas = chunks.filter((c) => c.type === "tool_call_delta")
			expect(toolCallDeltas).toHaveLength(2)

			const toolCallEnd = chunks.filter((c) => c.type === "tool_call_end")
			expect(toolCallEnd).toHaveLength(1)
		})

		it("should include tools in streamText call when tools are provided", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

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

		it("should pass tool_choice 'auto' via mapToolChoice", async () => {
			const handler = new AnthropicHandler(mockOptions)
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

		it("should pass tool_choice 'required' via mapToolChoice", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tool_choice: "required",
			})
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.toolChoice).toBe("required")
		})

		it("should pass tool_choice 'none' via mapToolChoice", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tool_choice: "none",
			})
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.toolChoice).toBe("none")
		})

		it("should convert specific tool_choice to AI SDK format", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tool_choice: { type: "function" as const, function: { name: "get_weather" } },
			})
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.toolChoice).toEqual({ type: "tool", toolName: "get_weather" })
		})

		it("should include anthropic-beta header with fine-grained-tool-streaming and prompt-caching", async () => {
			const handler = new AnthropicHandler(mockOptions) // claude-3-5-sonnet supports prompt cache
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.headers).toBeDefined()
			const betas: string = callArgs.headers["anthropic-beta"]
			expect(betas).toContain("fine-grained-tool-streaming-2025-05-14")
			expect(betas).toContain("prompt-caching-2024-07-31")
		})

		it("should include context-1m beta for supported models when enabled", async () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-sonnet-4-5",
				anthropicBeta1MContext: true,
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.headers["anthropic-beta"]).toContain("context-1m-2025-08-07")
		})

		it("should not include context-1m beta for unsupported models", async () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-5-sonnet-20241022",
				anthropicBeta1MContext: true,
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.headers["anthropic-beta"]).not.toContain("context-1m-2025-08-07")
		})

		it("should include output-128k beta for :thinking models", async () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.headers["anthropic-beta"]).toContain("output-128k-2025-02-19")
		})

		it("should set providerOptions with thinking for thinking models", async () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions).toBeDefined()
			expect(callArgs.providerOptions.anthropic.thinking).toEqual({
				type: "enabled",
				budgetTokens: 16_384,
			})
		})

		it("should not set providerOptions for non-thinking models", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions).toBeUndefined()
		})

		it("should handle API errors and capture telemetry", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta" as const, text: "" }
					throw new Error("API Error")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// consume
				}
			}).rejects.toThrow("API Error")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "API Error",
					provider: "Anthropic",
					modelId: mockOptions.apiModelId,
					operation: "createMessage",
				}),
			)
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			const handler = new AnthropicHandler(mockOptions)
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
			const handler = new AnthropicHandler(mockOptions)
			mockGenerateText.mockRejectedValue(new Error("API Error"))

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("API Error")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "API Error",
					provider: "Anthropic",
					modelId: mockOptions.apiModelId,
					operation: "completePrompt",
				}),
			)
		})

		it("should handle empty response", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockGenerateText.mockResolvedValue({ text: "" })

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should pass model and temperature to generateText", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockGenerateText.mockResolvedValue({ text: "response" })

			await handler.completePrompt("Test prompt")

			const callArgs = mockGenerateText.mock.calls[0][0]
			expect(callArgs.prompt).toBe("Test prompt")
			expect(callArgs.temperature).toBe(0)
			expect(callArgs.model).toBeDefined()
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly process basic usage metrics", () => {
			const handler = new TestAnthropicHandler(mockOptions)
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
			const handler = new TestAnthropicHandler(mockOptions)
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
			const handler = new TestAnthropicHandler(mockOptions)
			const result = handler.testProcessUsageMetrics({ inputTokens: 100, outputTokens: 50 }, undefined, {
				inputPrice: 3.0,
				outputPrice: 15.0,
			})

			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})

		it("should calculate cost using Anthropic-specific pricing", () => {
			const handler = new TestAnthropicHandler(mockOptions)
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

	describe("error handling", () => {
		const testMessages: NeutralMessageParam[] = [
			{ role: "user", content: [{ type: "text" as const, text: "Hello" }] },
		]

		it("should capture telemetry when createMessage stream throws", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta" as const, text: "" }
					throw new Error("Connection failed")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage("test", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// consume
				}
			}).rejects.toThrow()

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Connection failed",
					provider: "Anthropic",
					modelId: mockOptions.apiModelId,
					operation: "createMessage",
				}),
			)
		})

		it("should capture telemetry when completePrompt throws", async () => {
			const handler = new AnthropicHandler(mockOptions)
			mockGenerateText.mockRejectedValue(new Error("Unexpected error"))

			await expect(handler.completePrompt("test")).rejects.toThrow("Unexpected error")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Unexpected error",
					provider: "Anthropic",
					modelId: mockOptions.apiModelId,
					operation: "completePrompt",
				}),
			)
		})
	})
})
