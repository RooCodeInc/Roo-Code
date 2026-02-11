// npx vitest run api/providers/__tests__/roo.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import { rooDefaultModelId } from "@roo-code/types"

import { ApiHandlerOptions } from "../../../shared/api"
import type { RooMessage } from "../../../core/task-persistence/rooMessage"

// Mock the AI SDK
const mockStreamText = vitest.fn()
const mockGenerateText = vitest.fn()
const mockCreateOpenAICompatible = vitest.fn()

vitest.mock("ai", () => ({
	streamText: (...args: unknown[]) => mockStreamText(...args),
	generateText: (...args: unknown[]) => mockGenerateText(...args),
	tool: vitest.fn((t) => t),
	jsonSchema: vitest.fn((s) => s),
}))

vitest.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: (...args: unknown[]) => {
		mockCreateOpenAICompatible(...args)
		return vitest.fn((modelId: string) => ({ modelId, provider: "roo" }))
	},
}))

// Mock CloudService - Define functions outside to avoid initialization issues
const mockGetSessionTokenFn = vitest.fn()
const mockHasInstanceFn = vitest.fn()

vitest.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: () => mockHasInstanceFn(),
		get instance() {
			return {
				authService: {
					getSessionToken: () => mockGetSessionTokenFn(),
				},
				on: vitest.fn(),
				off: vitest.fn(),
			}
		},
	},
}))

// Mock i18n
vitest.mock("../../../i18n", () => ({
	t: vitest.fn((key: string) => {
		if (key === "common:errors.roo.authenticationRequired") {
			return "Authentication required for Roo Code Cloud"
		}
		return key
	}),
}))

// Mock model cache
vitest.mock("../../providers/fetchers/modelCache", () => ({
	getModels: vitest.fn(),
	flushModels: vitest.fn(),
	getModelsFromCache: vitest.fn((provider: string) => {
		if (provider === "roo") {
			return {
				"xai/grok-code-fast-1": {
					maxTokens: 16_384,
					contextWindow: 262_144,
					supportsImages: false,
					supportsReasoningEffort: true, // Enable reasoning for tests
					supportsPromptCache: true,
					inputPrice: 0,
					outputPrice: 0,
				},
				"minimax/minimax-m2:free": {
					maxTokens: 32_768,
					contextWindow: 1_000_000,
					supportsImages: false,
					supportsPromptCache: true,
					inputPrice: 0.15,
					outputPrice: 0.6,
				},
				"anthropic/claude-haiku-4.5": {
					maxTokens: 8_192,
					contextWindow: 200_000,
					supportsImages: true,
					supportsPromptCache: true,
					inputPrice: 0.8,
					outputPrice: 4,
				},
			}
		}
		return {}
	}),
}))

// Import after mocks are set up
import { RooHandler } from "../roo"
import { CloudService } from "@roo-code/cloud"

/**
 * Helper to create a mock stream result for streamText.
 */
function createMockStreamResult(options?: {
	textChunks?: string[]
	reasoningChunks?: string[]
	toolCallParts?: Array<{ type: string; id?: string; toolName?: string; delta?: string }>
	inputTokens?: number
	outputTokens?: number
	providerMetadata?: Record<string, any>
}) {
	const {
		textChunks = ["Test response"],
		reasoningChunks = [],
		toolCallParts = [],
		inputTokens = 10,
		outputTokens = 5,
		providerMetadata = undefined,
	} = options ?? {}

	const fullStream = (async function* () {
		for (const text of reasoningChunks) {
			yield { type: "reasoning-delta", text }
		}
		for (const text of textChunks) {
			yield { type: "text-delta", text, id: "1" }
		}
		for (const part of toolCallParts) {
			yield part
		}
	})()

	return {
		fullStream,
		usage: Promise.resolve({ inputTokens, outputTokens }),
		providerMetadata: Promise.resolve(providerMetadata),
	}
}

describe("RooHandler", () => {
	let handler: RooHandler
	let mockOptions: ApiHandlerOptions
	const systemPrompt = "You are a helpful assistant."
	const messages: RooMessage[] = [
		{
			role: "user",
			content: "Hello!",
		},
	]

	beforeEach(() => {
		mockOptions = {
			apiModelId: "xai/grok-code-fast-1",
		}
		// Set up CloudService mocks for successful authentication
		mockHasInstanceFn.mockReturnValue(true)
		mockGetSessionTokenFn.mockReturnValue("test-session-token")
		mockStreamText.mockClear()
		mockGenerateText.mockClear()
		mockCreateOpenAICompatible.mockClear()
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with valid session token", () => {
			handler = new RooHandler(mockOptions)
			expect(handler).toBeInstanceOf(RooHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should not throw error if CloudService is not available", () => {
			mockHasInstanceFn.mockReturnValue(false)
			expect(() => {
				new RooHandler(mockOptions)
			}).not.toThrow()
			// Constructor should succeed even without CloudService
			const handler = new RooHandler(mockOptions)
			expect(handler).toBeInstanceOf(RooHandler)
		})

		it("should not throw error if session token is not available", () => {
			mockHasInstanceFn.mockReturnValue(true)
			mockGetSessionTokenFn.mockReturnValue(null)
			expect(() => {
				new RooHandler(mockOptions)
			}).not.toThrow()
			// Constructor should succeed even without session token
			const handler = new RooHandler(mockOptions)
			expect(handler).toBeInstanceOf(RooHandler)
		})

		it("should initialize with default model if no model specified", () => {
			handler = new RooHandler({})
			expect(handler).toBeInstanceOf(RooHandler)
			expect(handler.getModel().id).toBe(rooDefaultModelId)
		})

		it("should pass correct configuration to base class", () => {
			handler = new RooHandler(mockOptions)
			expect(handler).toBeInstanceOf(RooHandler)
			expect(handler).toBeDefined()
		})
	})

	describe("createMessage", () => {
		beforeEach(() => {
			handler = new RooHandler(mockOptions)
		})

		it("should update API key before making request", async () => {
			const freshToken = "fresh-session-token"
			mockGetSessionTokenFn.mockReturnValue(freshToken)
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Just consume
			}

			// Verify createOpenAICompatible was called (per-request provider creates fresh one)
			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: freshToken,
				}),
			)
		})

		it("should handle streaming responses", async () => {
			mockStreamText.mockReturnValue(createMockStreamResult())

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

		it("should include usage information", async () => {
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(5)
		})

		it("should handle API errors", async () => {
			mockStreamText.mockReturnValue({
				fullStream: {
					[Symbol.asyncIterator]() {
						return {
							next: () => Promise.reject(new Error("API Error")),
						}
					},
				},
				usage: new Promise(() => {}), // never resolves; stream throws before usage is awaited
				providerMetadata: Promise.resolve(undefined),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow()
		})

		it("should handle empty response content", async () => {
			mockStreamText.mockReturnValue(
				createMockStreamResult({
					textChunks: [],
					inputTokens: 10,
					outputTokens: 0,
				}),
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(0)
			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
		})

		it("should handle multiple messages in conversation", async () => {
			mockStreamText.mockReturnValue(createMockStreamResult())

			const multipleMessages: RooMessage[] = [
				{ role: "user", content: "First message" },
				{ role: "assistant", content: "First response" },
				{ role: "user", content: "Second message" },
			]

			const stream = handler.createMessage(systemPrompt, multipleMessages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify streamText was called with system prompt and converted messages
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: systemPrompt,
					messages: expect.any(Array),
				}),
			)
		})

		it("should pass X-Roo-App-Version header via createOpenAICompatible", async () => {
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Roo-App-Version": expect.any(String),
					}),
				}),
			)
		})

		it("should pass X-Roo-Task-ID header when taskId is provided", async () => {
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages, { taskId: "test-task-123" })
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Roo-App-Version": expect.any(String),
						"X-Roo-Task-ID": "test-task-123",
					}),
				}),
			)
		})
	})

	describe("completePrompt", () => {
		beforeEach(() => {
			handler = new RooHandler(mockOptions)
		})

		it("should complete prompt successfully", async () => {
			mockGenerateText.mockResolvedValue({ text: "Test response" })

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
				}),
			)
		})

		it("should update API key before making request", async () => {
			const freshToken = "fresh-session-token"
			mockGetSessionTokenFn.mockReturnValue(freshToken)
			mockGenerateText.mockResolvedValue({ text: "Test response" })

			await handler.completePrompt("Test prompt")

			// Verify createOpenAICompatible was called with fresh token
			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: freshToken,
				}),
			)
		})

		it("should handle API errors", async () => {
			mockGenerateText.mockRejectedValue(new Error("API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("Roo Code Cloud")
		})

		it("should handle empty response", async () => {
			mockGenerateText.mockResolvedValue({ text: "" })
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})

	describe("getModel", () => {
		beforeEach(() => {
			handler = new RooHandler(mockOptions)
		})

		it("should return model info for specified model", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe(mockOptions.apiModelId)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBeDefined()
			expect(modelInfo.info.contextWindow).toBeDefined()
		})

		it("should return default model when no model specified", () => {
			const handlerWithoutModel = new RooHandler({})
			const modelInfo = handlerWithoutModel.getModel()
			expect(modelInfo.id).toBe(rooDefaultModelId)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBeDefined()
			expect(modelInfo.info.contextWindow).toBeDefined()
		})

		it("should handle unknown model ID with fallback info", () => {
			const handlerWithUnknownModel = new RooHandler({
				apiModelId: "unknown-model-id",
			})
			const modelInfo = handlerWithUnknownModel.getModel()
			expect(modelInfo.id).toBe("unknown-model-id")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBeDefined()
			expect(modelInfo.info.contextWindow).toBeDefined()
			expect(modelInfo.info.supportsImages).toBeDefined()
			expect(modelInfo.info.supportsPromptCache).toBeDefined()
			expect(modelInfo.info.inputPrice).toBeDefined()
			expect(modelInfo.info.outputPrice).toBeDefined()
		})

		it("should handle any model ID since models are loaded dynamically", () => {
			const testModelIds = ["xai/grok-code-fast-1", "roo/sonic", "deepseek/deepseek-chat-v3.1"]

			for (const modelId of testModelIds) {
				const handlerWithModel = new RooHandler({ apiModelId: modelId })
				const modelInfo = handlerWithModel.getModel()
				expect(modelInfo.id).toBe(modelId)
				expect(modelInfo.info).toBeDefined()
				expect(modelInfo.info.maxTokens).toBeDefined()
				expect(modelInfo.info.contextWindow).toBeDefined()
			}
		})

		it("should return cached model info with settings applied from API", () => {
			const handlerWithMinimax = new RooHandler({
				apiModelId: "minimax/minimax-m2:free",
			})
			const modelInfo = handlerWithMinimax.getModel()
			expect(modelInfo.info.inputPrice).toBe(0.15)
			expect(modelInfo.info.outputPrice).toBe(0.6)
		})
	})

	describe("temperature and model configuration", () => {
		it("should use default temperature of 0", async () => {
			handler = new RooHandler(mockOptions)
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0,
				}),
			)
		})

		it("should respect custom temperature setting", async () => {
			handler = new RooHandler({
				...mockOptions,
				modelTemperature: 0.9,
			})
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.9,
				}),
			)
		})

		it("should use correct API endpoint", () => {
			handler = new RooHandler(mockOptions)
			expect(handler).toBeInstanceOf(RooHandler)
		})
	})

	describe("authentication flow", () => {
		it("should use session token as API key", () => {
			const testToken = "test-session-token-123"
			mockGetSessionTokenFn.mockReturnValue(testToken)

			handler = new RooHandler(mockOptions)
			expect(handler).toBeInstanceOf(RooHandler)
			expect(mockGetSessionTokenFn).toHaveBeenCalled()
		})

		it("should handle undefined auth service gracefully", () => {
			mockHasInstanceFn.mockReturnValue(true)
			const originalGetSessionToken = mockGetSessionTokenFn.getMockImplementation()

			mockGetSessionTokenFn.mockImplementation(() => undefined)

			try {
				Object.defineProperty(CloudService, "instance", {
					get: () => ({
						authService: undefined,
						on: vitest.fn(),
						off: vitest.fn(),
					}),
					configurable: true,
				})

				expect(() => {
					new RooHandler(mockOptions)
				}).not.toThrow()
				const handler = new RooHandler(mockOptions)
				expect(handler).toBeInstanceOf(RooHandler)
			} finally {
				if (originalGetSessionToken) {
					mockGetSessionTokenFn.mockImplementation(originalGetSessionToken)
				} else {
					mockGetSessionTokenFn.mockReturnValue("test-session-token")
				}
			}
		})

		it("should handle empty session token gracefully", () => {
			mockGetSessionTokenFn.mockReturnValue("")

			expect(() => {
				new RooHandler(mockOptions)
			}).not.toThrow()
			const handler = new RooHandler(mockOptions)
			expect(handler).toBeInstanceOf(RooHandler)
		})
	})

	describe("reasoning effort support", () => {
		/**
		 * Helper: extracts the `transformRequestBody` function from the most recent
		 * `createOpenAICompatible` call and invokes it with a sample body to return
		 * the transformed result. Returns `undefined` when no transform was provided.
		 */
		function getTransformedBody(): Record<string, unknown> | undefined {
			const callArgs = mockCreateOpenAICompatible.mock.calls[0]?.[0]
			if (!callArgs?.transformRequestBody) {
				return undefined
			}
			const sampleBody = { model: "test-model", messages: [] }
			return callArgs.transformRequestBody(sampleBody)
		}

		it("should inject reasoning { enabled: false } via transformRequestBody when not enabled", async () => {
			handler = new RooHandler(mockOptions)
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			// Reasoning is injected via transformRequestBody when creating the provider
			const transformed = getTransformedBody()
			expect(transformed).toBeDefined()
			expect(transformed!.reasoning).toEqual({ enabled: false })
			// Original body fields are preserved
			expect(transformed!.model).toBe("test-model")
		})

		it("should inject reasoning { enabled: false } via transformRequestBody when explicitly disabled", async () => {
			handler = new RooHandler({
				...mockOptions,
				enableReasoningEffort: false,
			})
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			const transformed = getTransformedBody()
			expect(transformed).toBeDefined()
			expect(transformed!.reasoning).toEqual({ enabled: false })
		})

		it("should inject reasoning { enabled: true, effort: 'low' } via transformRequestBody", async () => {
			handler = new RooHandler({
				...mockOptions,
				reasoningEffort: "low",
			})
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			const transformed = getTransformedBody()
			expect(transformed).toBeDefined()
			expect(transformed!.reasoning).toEqual({ enabled: true, effort: "low" })
		})

		it("should inject reasoning { enabled: true, effort: 'medium' } via transformRequestBody", async () => {
			handler = new RooHandler({
				...mockOptions,
				reasoningEffort: "medium",
			})
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			const transformed = getTransformedBody()
			expect(transformed).toBeDefined()
			expect(transformed!.reasoning).toEqual({ enabled: true, effort: "medium" })
		})

		it("should inject reasoning { enabled: true, effort: 'high' } via transformRequestBody", async () => {
			handler = new RooHandler({
				...mockOptions,
				reasoningEffort: "high",
			})
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			const transformed = getTransformedBody()
			expect(transformed).toBeDefined()
			expect(transformed!.reasoning).toEqual({ enabled: true, effort: "high" })
		})

		it("should not provide transformRequestBody for minimal (treated as none)", async () => {
			handler = new RooHandler({
				...mockOptions,
				reasoningEffort: "minimal",
			})
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			// minimal should result in no reasoning parameter, thus no transformRequestBody
			const callArgs = mockCreateOpenAICompatible.mock.calls[0][0]
			expect(callArgs.transformRequestBody).toBeUndefined()
		})

		it("should handle enableReasoningEffort: false overriding reasoningEffort setting", async () => {
			handler = new RooHandler({
				...mockOptions,
				enableReasoningEffort: false,
				reasoningEffort: "high",
			})
			mockStreamText.mockReturnValue(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			// When explicitly disabled, should send enabled: false regardless of effort setting
			const transformed = getTransformedBody()
			expect(transformed).toBeDefined()
			expect(transformed!.reasoning).toEqual({ enabled: false })
		})
	})

	describe("usage and cost processing", () => {
		beforeEach(() => {
			handler = new RooHandler(mockOptions)
		})

		it("should use server-side cost from providerMetadata when available", async () => {
			mockStreamText.mockReturnValue(
				createMockStreamResult({
					inputTokens: 100,
					outputTokens: 50,
					providerMetadata: {
						roo: { cost: 0.005 },
					},
				}),
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.totalCost).toBe(0.005)
		})

		it("should report 0 cost for free models", async () => {
			const freeHandler = new RooHandler({
				apiModelId: "xai/grok-code-fast-1", // has isFree: false but inputPrice/outputPrice = 0
			})

			mockStreamText.mockReturnValue(
				createMockStreamResult({
					inputTokens: 100,
					outputTokens: 50,
					providerMetadata: {
						roo: { cost: 0.005 },
					},
				}),
			)

			const stream = freeHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			// Model is not marked as isFree, so cost should be from server
			expect(usageChunk.totalCost).toBe(0.005)
		})

		it("should include cache tokens from providerMetadata", async () => {
			mockStreamText.mockReturnValue(
				createMockStreamResult({
					inputTokens: 100,
					outputTokens: 50,
					providerMetadata: {
						roo: {
							cache_creation_input_tokens: 20,
							cache_read_input_tokens: 30,
						},
					},
				}),
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.cacheWriteTokens).toBe(20)
			expect(usageChunk.cacheReadTokens).toBe(30)
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			handler = new RooHandler(mockOptions)
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("tool calls handling", () => {
		beforeEach(() => {
			handler = new RooHandler(mockOptions)
		})

		it("should yield tool call events from AI SDK stream", async () => {
			mockStreamText.mockReturnValue(
				createMockStreamResult({
					textChunks: [],
					toolCallParts: [
						{ type: "tool-input-start", id: "call_123", toolName: "read_file" },
						{ type: "tool-input-delta", id: "call_123", delta: '{"path":"test.ts"}' },
						{ type: "tool-input-end", id: "call_123" },
					],
				}),
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const startChunks = chunks.filter((c) => c.type === "tool_call_start")
			const deltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
			const endChunks = chunks.filter((c) => c.type === "tool_call_end")

			expect(startChunks).toHaveLength(1)
			expect(startChunks[0].id).toBe("call_123")
			expect(startChunks[0].name).toBe("read_file")

			expect(deltaChunks).toHaveLength(1)
			expect(deltaChunks[0].id).toBe("call_123")
			expect(deltaChunks[0].delta).toBe('{"path":"test.ts"}')

			expect(endChunks).toHaveLength(1)
			expect(endChunks[0].id).toBe("call_123")
		})

		it("should handle multiple tool calls", async () => {
			mockStreamText.mockReturnValue(
				createMockStreamResult({
					textChunks: [],
					toolCallParts: [
						{ type: "tool-input-start", id: "call_1", toolName: "read_file" },
						{ type: "tool-input-delta", id: "call_1", delta: '{"path":"file1.ts"}' },
						{ type: "tool-input-end", id: "call_1" },
						{ type: "tool-input-start", id: "call_2", toolName: "read_file" },
						{ type: "tool-input-delta", id: "call_2", delta: '{"path":"file2.ts"}' },
						{ type: "tool-input-end", id: "call_2" },
					],
				}),
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const startChunks = chunks.filter((c) => c.type === "tool_call_start")
			const endChunks = chunks.filter((c) => c.type === "tool_call_end")

			expect(startChunks).toHaveLength(2)
			expect(startChunks[0].id).toBe("call_1")
			expect(startChunks[1].id).toBe("call_2")

			expect(endChunks).toHaveLength(2)
			expect(endChunks[0].id).toBe("call_1")
			expect(endChunks[1].id).toBe("call_2")
		})

		it("should not yield tool call chunks when no tool calls present", async () => {
			mockStreamText.mockReturnValue(
				createMockStreamResult({
					textChunks: ["Regular text response"],
				}),
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolChunks = chunks.filter(
				(c) => c.type === "tool_call_start" || c.type === "tool_call_delta" || c.type === "tool_call_end",
			)
			expect(toolChunks).toHaveLength(0)
		})
	})
})
