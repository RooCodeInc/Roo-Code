// npx vitest run api/providers/__tests__/roo.spec.ts

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { rooDefaultModelId } from "@roo-code/types"

import { ApiHandlerOptions } from "../../../shared/api"

// ── AI SDK mocks ──────────────────────────────────────────────────

const { mockStreamText, mockGenerateText, mockLanguageModel, mockCreateOpenAICompatible } = vi.hoisted(() => {
	const mockLanguageModel = vi.fn(() => ({
		modelId: "test-model",
		provider: "roo",
	}))

	const mockCreateOpenAICompatible = vi.fn(() => {
		const providerFn = Object.assign(
			vi.fn(() => ({ modelId: "test-model", provider: "roo" })),
			{
				languageModel: mockLanguageModel,
			},
		)
		return providerFn
	})

	return {
		mockStreamText: vi.fn(),
		mockGenerateText: vi.fn(),
		mockLanguageModel,
		mockCreateOpenAICompatible,
	}
})

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return { ...actual, streamText: mockStreamText, generateText: mockGenerateText }
})

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: mockCreateOpenAICompatible,
}))

// ── CloudService mocks ────────────────────────────────────────────

const mockGetSessionTokenFn = vi.fn()
const mockHasInstanceFn = vi.fn()

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: () => mockHasInstanceFn(),
		get instance() {
			return {
				authService: {
					getSessionToken: () => mockGetSessionTokenFn(),
				},
				on: vi.fn(),
				off: vi.fn(),
			}
		},
	},
}))

// ── i18n mock ─────────────────────────────────────────────────────

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => {
		if (key === "common:errors.roo.authenticationRequired") {
			return "Authentication required for Roo Code Cloud"
		}
		return key
	}),
}))

// ── Model cache mock ──────────────────────────────────────────────

vi.mock("../../providers/fetchers/modelCache", () => ({
	getModels: vi.fn(),
	flushModels: vi.fn(),
	getModelsFromCache: vi.fn((provider: string) => {
		if (provider === "roo") {
			return {
				"xai/grok-code-fast-1": {
					maxTokens: 16_384,
					contextWindow: 262_144,
					supportsImages: false,
					supportsReasoningEffort: true,
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

// ── Import after mocks ────────────────────────────────────────────

import { RooHandler } from "../roo"

// ── Test helpers ──────────────────────────────────────────────────

function createDefaultStreamMock(
	textContent = "Test response",
	rawUsage: Record<string, unknown> = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
) {
	async function* fullStream() {
		if (textContent) {
			yield { type: "text-delta" as const, text: textContent }
		}
	}
	return {
		fullStream: fullStream(),
		usage: Promise.resolve({
			inputTokens: rawUsage.prompt_tokens ?? 10,
			outputTokens: rawUsage.completion_tokens ?? 5,
			details: {},
			raw: rawUsage,
		}),
	}
}

// ── Tests ─────────────────────────────────────────────────────────

describe("RooHandler", () => {
	let handler: RooHandler
	let mockOptions: ApiHandlerOptions
	const systemPrompt = "You are a helpful assistant."
	const messages: NeutralMessageParam[] = [
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
		vi.clearAllMocks()
		// Restore default mock implementations after clearAllMocks
		mockHasInstanceFn.mockReturnValue(true)
		mockGetSessionTokenFn.mockReturnValue("test-session-token")
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
			const handler = new RooHandler(mockOptions)
			expect(handler).toBeInstanceOf(RooHandler)
		})

		it("should not throw error if session token is not available", () => {
			mockHasInstanceFn.mockReturnValue(true)
			mockGetSessionTokenFn.mockReturnValue(null)
			expect(() => {
				new RooHandler(mockOptions)
			}).not.toThrow()
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
			// Verify createOpenAICompatible was called with correct config
			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "roo",
					apiKey: "test-session-token",
					baseURL: expect.stringContaining("/v1"),
				}),
			)
		})
	})

	describe("createMessage", () => {
		beforeEach(() => {
			handler = new RooHandler(mockOptions)
			// Clear mocks from constructor
			mockCreateOpenAICompatible.mockClear()
			mockLanguageModel.mockClear()
			mockStreamText.mockReturnValue(createDefaultStreamMock())
		})

		it("should refresh auth before making request", async () => {
			const freshToken = "fresh-session-token"
			mockGetSessionTokenFn.mockReturnValue(freshToken)

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			// Verify provider was recreated with fresh token
			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: freshToken,
					headers: expect.objectContaining({
						"X-Roo-App-Version": expect.any(String),
					}),
				}),
			)
			expect(mockGetSessionTokenFn).toHaveBeenCalled()
		})

		it("should handle streaming responses", async () => {
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
			async function* failingStream(): AsyncGenerator<never> {
				yield* [] as never[]
				throw new Error("API Error")
			}
			mockStreamText.mockReturnValue({
				fullStream: failingStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, details: {}, raw: {} }),
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
				createDefaultStreamMock("", { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 }),
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
			const multipleMessages: NeutralMessageParam[] = [
				{ role: "user", content: "First message" },
				{ role: "assistant", content: "First response" },
				{ role: "user", content: "Second message" },
			]

			const stream = handler.createMessage(systemPrompt, multipleMessages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			// Verify streamText was called with system prompt and messages
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: systemPrompt,
					messages: expect.any(Array),
				}),
			)

			// Verify custom headers were set on the provider
			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Roo-App-Version": expect.any(String),
					}),
				}),
			)
		})

		it("should include X-Roo-Task-ID header when taskId is present", async () => {
			const stream = handler.createMessage(systemPrompt, messages, { taskId: "task-abc-123" })
			for await (const _chunk of stream) {
				// Consume stream
			}

			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Roo-App-Version": expect.any(String),
						"X-Roo-Task-ID": "task-abc-123",
					}),
				}),
			)
		})
	})

	describe("completePrompt", () => {
		beforeEach(() => {
			handler = new RooHandler(mockOptions)
			mockCreateOpenAICompatible.mockClear()
			mockLanguageModel.mockClear()
			mockGenerateText.mockResolvedValue({ text: "Test response" })
		})

		it("should complete prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
				}),
			)
		})

		it("should refresh auth before making request", async () => {
			const freshToken = "fresh-session-token"
			mockGetSessionTokenFn.mockReturnValue(freshToken)

			await handler.completePrompt("Test prompt")

			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: freshToken,
				}),
			)
			expect(mockGetSessionTokenFn).toHaveBeenCalled()
		})

		it("should handle API errors", async () => {
			mockGenerateText.mockRejectedValueOnce(new Error("API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("API Error")
		})

		it("should handle empty response", async () => {
			mockGenerateText.mockResolvedValueOnce({ text: "" })
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
			mockCreateOpenAICompatible.mockClear()
			mockLanguageModel.mockClear()
			mockStreamText.mockReturnValue(createDefaultStreamMock())

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
			mockCreateOpenAICompatible.mockClear()
			mockLanguageModel.mockClear()
			mockStreamText.mockReturnValue(createDefaultStreamMock())

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
			// Verify the provider was created with the expected base URL
			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: expect.stringMatching(/\/v1$/),
				}),
			)
		})
	})

	describe("authentication flow", () => {
		it("should use session token as API key", () => {
			const testToken = "test-session-token-123"
			mockGetSessionTokenFn.mockReturnValue(testToken)

			handler = new RooHandler(mockOptions)
			expect(handler).toBeInstanceOf(RooHandler)
			expect(mockGetSessionTokenFn).toHaveBeenCalled()
			// Verify the provider was created with the session token
			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: testToken,
				}),
			)
		})

		it("should handle undefined auth service gracefully", () => {
			const originalImpl = mockGetSessionTokenFn.getMockImplementation()
			mockGetSessionTokenFn.mockImplementation(() => undefined)

			try {
				expect(() => {
					new RooHandler(mockOptions)
				}).not.toThrow()
				const handler = new RooHandler(mockOptions)
				expect(handler).toBeInstanceOf(RooHandler)
			} finally {
				if (originalImpl) {
					mockGetSessionTokenFn.mockImplementation(originalImpl)
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

		it("should recreate provider on each createMessage call", async () => {
			handler = new RooHandler(mockOptions)
			mockCreateOpenAICompatible.mockClear()
			mockStreamText.mockReturnValue(createDefaultStreamMock())

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume
			}

			// refreshProvider should have called createOpenAICompatible
			expect(mockCreateOpenAICompatible).toHaveBeenCalledTimes(1)

			// Call again
			mockStreamText.mockReturnValue(createDefaultStreamMock())
			const stream2 = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream2) {
				// Consume
			}

			expect(mockCreateOpenAICompatible).toHaveBeenCalledTimes(2)
		})
	})

	describe("reasoning effort support", () => {
		/**
		 * Helper to extract the transformRequestBody function from the most recent
		 * `provider.languageModel()` call and invoke it with a test body.
		 */
		function getTransformedBody() {
			const lastCall = mockLanguageModel.mock.calls[mockLanguageModel.mock.calls.length - 1] as unknown[]
			const options = lastCall?.[1] as {
				transformRequestBody?: (body: Record<string, unknown>) => Record<string, unknown>
			}
			const transformFn = options?.transformRequestBody
			if (!transformFn) {
				return { model: "test", messages: [] } as Record<string, unknown>
			}
			return transformFn({ model: "test", messages: [] })
		}

		beforeEach(() => {
			mockStreamText.mockReturnValue(createDefaultStreamMock())
		})

		it("should include reasoning with enabled: false when not enabled", async () => {
			handler = new RooHandler(mockOptions)
			mockLanguageModel.mockClear()

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			const body = getTransformedBody()
			expect(body.reasoning).toEqual({ enabled: false })
		})

		it("should include reasoning with enabled: false when explicitly disabled", async () => {
			handler = new RooHandler({
				...mockOptions,
				enableReasoningEffort: false,
			})
			mockLanguageModel.mockClear()

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			const body = getTransformedBody()
			expect(body.reasoning).toEqual({ enabled: false })
		})

		it("should include reasoning with enabled: true and effort: low", async () => {
			handler = new RooHandler({
				...mockOptions,
				reasoningEffort: "low",
			})
			mockLanguageModel.mockClear()

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			const body = getTransformedBody()
			expect(body.reasoning).toEqual({ enabled: true, effort: "low" })
		})

		it("should include reasoning with enabled: true and effort: medium", async () => {
			handler = new RooHandler({
				...mockOptions,
				reasoningEffort: "medium",
			})
			mockLanguageModel.mockClear()

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			const body = getTransformedBody()
			expect(body.reasoning).toEqual({ enabled: true, effort: "medium" })
		})

		it("should include reasoning with enabled: true and effort: high", async () => {
			handler = new RooHandler({
				...mockOptions,
				reasoningEffort: "high",
			})
			mockLanguageModel.mockClear()

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			const body = getTransformedBody()
			expect(body.reasoning).toEqual({ enabled: true, effort: "high" })
		})

		it("should not include reasoning for minimal (treated as none)", async () => {
			handler = new RooHandler({
				...mockOptions,
				reasoningEffort: "minimal",
			})
			mockLanguageModel.mockClear()

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			// minimal should result in no reasoning parameter
			const body = getTransformedBody()
			expect(body.reasoning).toBeUndefined()
		})

		it("should handle enableReasoningEffort: false overriding reasoningEffort setting", async () => {
			handler = new RooHandler({
				...mockOptions,
				enableReasoningEffort: false,
				reasoningEffort: "high",
			})
			mockLanguageModel.mockClear()

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume stream
			}

			// When explicitly disabled, should send enabled: false regardless of effort setting
			const body = getTransformedBody()
			expect(body.reasoning).toEqual({ enabled: false })
		})
	})

	describe("tool calls handling", () => {
		beforeEach(() => {
			handler = new RooHandler(mockOptions)
			mockCreateOpenAICompatible.mockClear()
			mockLanguageModel.mockClear()
		})

		it("should yield tool call chunks from AI SDK stream", async () => {
			async function* mockFullStream() {
				yield { type: "tool-input-start" as const, id: "call_123", toolName: "read_file" }
				yield { type: "tool-input-delta" as const, id: "call_123", delta: '{"path":"test.ts"}' }
				yield { type: "tool-input-end" as const, id: "call_123" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
					details: {},
					raw: { prompt_tokens: 10, completion_tokens: 5 },
				}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const startChunks = chunks.filter((c) => c.type === "tool_call_start")
			const deltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
			const endChunks = chunks.filter((c) => c.type === "tool_call_end")

			expect(startChunks).toHaveLength(1)
			expect(startChunks[0]).toEqual({
				type: "tool_call_start",
				id: "call_123",
				name: "read_file",
			})
			expect(deltaChunks).toHaveLength(1)
			expect(deltaChunks[0]).toEqual({
				type: "tool_call_delta",
				id: "call_123",
				delta: '{"path":"test.ts"}',
			})
			expect(endChunks).toHaveLength(1)
			expect(endChunks[0]).toEqual({
				type: "tool_call_end",
				id: "call_123",
			})
		})

		it("should handle multiple tool calls", async () => {
			async function* mockFullStream() {
				yield { type: "tool-input-start" as const, id: "call_1", toolName: "read_file" }
				yield { type: "tool-input-delta" as const, id: "call_1", delta: '{"path":"file1.ts"}' }
				yield { type: "tool-input-end" as const, id: "call_1" }
				yield { type: "tool-input-start" as const, id: "call_2", toolName: "read_file" }
				yield { type: "tool-input-delta" as const, id: "call_2", delta: '{"path":"file2.ts"}' }
				yield { type: "tool-input-end" as const, id: "call_2" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
					details: {},
					raw: { prompt_tokens: 10, completion_tokens: 5 },
				}),
			})

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
		})

		it("should handle streaming arguments across multiple deltas", async () => {
			async function* mockFullStream() {
				yield { type: "tool-input-start" as const, id: "call_789", toolName: "execute_command" }
				yield { type: "tool-input-delta" as const, id: "call_789", delta: '{"command":"' }
				yield { type: "tool-input-delta" as const, id: "call_789", delta: "npm install" }
				yield { type: "tool-input-delta" as const, id: "call_789", delta: '"}' }
				yield { type: "tool-input-end" as const, id: "call_789" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
					details: {},
					raw: { prompt_tokens: 10, completion_tokens: 5 },
				}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const deltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
			expect(deltaChunks).toHaveLength(3)
			expect(deltaChunks[0].delta).toBe('{"command":"')
			expect(deltaChunks[1].delta).toBe("npm install")
			expect(deltaChunks[2].delta).toBe('"}')
		})

		it("should not yield tool call chunks when no tools present", async () => {
			mockStreamText.mockReturnValue(createDefaultStreamMock())

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

	describe("reasoning streaming", () => {
		beforeEach(() => {
			handler = new RooHandler(mockOptions)
			mockCreateOpenAICompatible.mockClear()
			mockLanguageModel.mockClear()
		})

		it("should yield reasoning chunks from AI SDK stream", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning-delta" as const, text: "Let me think..." }
				yield { type: "reasoning-delta" as const, text: " about this." }
				yield { type: "text-delta" as const, text: "Here is my answer." }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
					details: {},
					raw: { prompt_tokens: 10, completion_tokens: 5 },
				}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			const textChunks = chunks.filter((c) => c.type === "text")

			expect(reasoningChunks).toHaveLength(2)
			expect(reasoningChunks[0].text).toBe("Let me think...")
			expect(reasoningChunks[1].text).toBe(" about this.")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Here is my answer.")
		})
	})

	describe("usage metrics", () => {
		beforeEach(() => {
			handler = new RooHandler(mockOptions)
			mockCreateOpenAICompatible.mockClear()
			mockLanguageModel.mockClear()
		})

		it("should return cost from raw usage", async () => {
			mockStreamText.mockReturnValue(
				createDefaultStreamMock("response", {
					prompt_tokens: 100,
					completion_tokens: 50,
					cost: 0.005,
				}),
			)

			const chunks: any[] = []
			for await (const chunk of handler.createMessage(systemPrompt, messages)) {
				chunks.push(chunk)
			}

			const usage = chunks.find((c) => c.type === "usage")
			expect(usage).toBeDefined()
			expect(usage.totalCost).toBe(0.005)
		})

		it("should set totalCost to 0 for free models", async () => {
			const freeHandler = new RooHandler({
				apiModelId: "xai/grok-code-fast-1",
			})
			// Override getModel to return isFree
			const origGetModel = freeHandler.getModel.bind(freeHandler)
			vi.spyOn(freeHandler, "getModel").mockImplementation(() => {
				const model = origGetModel()
				return { ...model, info: { ...model.info, isFree: true } }
			})

			mockCreateOpenAICompatible.mockClear()
			mockLanguageModel.mockClear()
			mockStreamText.mockReturnValue(
				createDefaultStreamMock("response", {
					prompt_tokens: 100,
					completion_tokens: 50,
					cost: 0.005,
				}),
			)

			const chunks: any[] = []
			for await (const chunk of freeHandler.createMessage(systemPrompt, messages)) {
				chunks.push(chunk)
			}

			const usage = chunks.find((c) => c.type === "usage")
			expect(usage).toBeDefined()
			expect(usage.totalCost).toBe(0)
		})

		it("should handle cache token metrics", async () => {
			mockStreamText.mockReturnValue(
				createDefaultStreamMock("response", {
					prompt_tokens: 100,
					completion_tokens: 50,
					cache_creation_input_tokens: 20,
					prompt_tokens_details: { cached_tokens: 30 },
					cost: 0.003,
				}),
			)

			const chunks: any[] = []
			for await (const chunk of handler.createMessage(systemPrompt, messages)) {
				chunks.push(chunk)
			}

			const usage = chunks.find((c) => c.type === "usage")
			expect(usage).toBeDefined()
			expect(usage.cacheWriteTokens).toBe(20)
			expect(usage.cacheReadTokens).toBe(30)
		})
	})
})
