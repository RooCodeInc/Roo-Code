// npx vitest run api/providers/__tests__/openrouter.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText, mockCreateOpenRouter } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateOpenRouter: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@openrouter/ai-sdk-provider", () => ({
	createOpenRouter: mockCreateOpenRouter.mockImplementation(() => ({
		chat: vi.fn((id: string) => ({ modelId: id, provider: "openrouter" })),
	})),
}))

vi.mock("delay", () => ({ default: vi.fn(() => Promise.resolve()) }))

const mockCaptureException = vi.fn()

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: (...args: unknown[]) => mockCaptureException(...args),
		},
	},
}))

vi.mock("../fetchers/modelCache", () => ({
	getModels: vi.fn().mockImplementation(() =>
		Promise.resolve({
			"anthropic/claude-sonnet-4": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: "Claude Sonnet 4",
			},
			"anthropic/claude-sonnet-4.5": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: "Claude 4.5 Sonnet",
			},
			"anthropic/claude-3.7-sonnet:thinking": {
				maxTokens: 128000,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: "Claude 3.7 Sonnet with thinking",
			},
			"openai/gpt-4o": {
				maxTokens: 16384,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: false,
				inputPrice: 2.5,
				outputPrice: 10,
				description: "GPT-4o",
			},
			"openai/o1": {
				maxTokens: 100000,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: false,
				inputPrice: 15,
				outputPrice: 60,
				description: "OpenAI o1",
				excludedTools: ["existing_excluded"],
				includedTools: ["existing_included"],
			},
			"deepseek/deepseek-r1": {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0.55,
				outputPrice: 2.19,
				description: "DeepSeek R1",
			},
			"google/gemini-2.5-pro-preview": {
				maxTokens: 65536,
				contextWindow: 1048576,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 1.25,
				outputPrice: 10,
				description: "Gemini 2.5 Pro Preview",
			},
		}),
	),
}))

vi.mock("../fetchers/modelEndpointCache", () => ({
	getModelEndpoints: vi.fn().mockImplementation(() => Promise.resolve({})),
}))

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { DEEP_SEEK_DEFAULT_TEMPERATURE } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"
import { OpenRouterHandler } from "../openrouter"

// Helper: create a standard mock fullStream async generator
function createMockFullStream(
	parts: Array<{ type: string; text?: string; id?: string; toolName?: string; delta?: string }>,
) {
	return async function* () {
		for (const part of parts) {
			yield part
		}
	}
}

// Helper: set up mock return value for streamText
function mockStreamTextReturn(
	parts: Array<{ type: string; text?: string; id?: string; toolName?: string; delta?: string }>,
	usage = { inputTokens: 10, outputTokens: 5 },
	providerMetadata: Record<string, any> = {},
) {
	mockStreamText.mockReturnValue({
		fullStream: createMockFullStream(parts)(),
		usage: Promise.resolve(usage),
		providerMetadata: Promise.resolve(providerMetadata),
	})
}

describe("OpenRouterHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		openRouterApiKey: "test-key",
		openRouterModelId: "anthropic/claude-sonnet-4",
	}

	beforeEach(() => vi.clearAllMocks())

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			const handler = new OpenRouterHandler(mockOptions)
			expect(handler).toBeInstanceOf(OpenRouterHandler)
		})

		it("should create provider with correct apiKey and headers", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("test", [{ role: "user", content: "hello" }])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "test-key",
					headers: expect.objectContaining({
						"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
						"X-Title": "Roo Code",
					}),
					compatibility: "strict",
				}),
			)
		})

		it("should use 'not-provided' when API key is not set", async () => {
			const handler = new OpenRouterHandler({})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("test", [{ role: "user", content: "hello" }])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "not-provided",
				}),
			)
		})

		it("should pass custom baseURL when provided", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterBaseUrl: "https://custom.openrouter.ai/api/v1",
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("test", [{ role: "user", content: "hello" }])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://custom.openrouter.ai/api/v1",
				}),
			)
		})

		it("should pass undefined baseURL when empty string provided", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterBaseUrl: "",
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("test", [{ role: "user", content: "hello" }])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: undefined,
				}),
			)
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			const handler = new OpenRouterHandler(mockOptions)
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("fetchModel", () => {
		it("returns correct model info when options are provided", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const result = await handler.fetchModel()

			expect(result).toMatchObject({
				id: mockOptions.openRouterModelId,
				maxTokens: 8192,
				temperature: 0,
				topP: undefined,
			})
		})

		it("returns default model info when options are not provided", async () => {
			const handler = new OpenRouterHandler({})
			const result = await handler.fetchModel()
			expect(result.id).toBe("anthropic/claude-sonnet-4.5")
			expect(result.info.supportsPromptCache).toBe(true)
		})

		it("honors custom maxTokens for thinking models", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "anthropic/claude-3.7-sonnet:thinking",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = await handler.fetchModel()
			// With clamping logic, 128000 tokens (64% of 200000 context window)
			// gets clamped to 20% of context window: 200000 * 0.2 = 40000
			expect(result.maxTokens).toBe(40000)
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0)
		})

		it("does not honor custom maxTokens for non-thinking models", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = await handler.fetchModel()
			expect(result.maxTokens).toBe(8192)
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0)
		})

		it("adds excludedTools and includedTools for OpenAI models", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "openai/gpt-4o",
			})

			const result = await handler.fetchModel()
			expect(result.id).toBe("openai/gpt-4o")
			expect(result.info.excludedTools).toContain("apply_diff")
			expect(result.info.excludedTools).toContain("write_to_file")
			expect(result.info.includedTools).toContain("apply_patch")
		})

		it("merges excludedTools and includedTools with existing values for OpenAI models", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "openai/o1",
			})

			const result = await handler.fetchModel()
			expect(result.id).toBe("openai/o1")
			// Should have the new exclusions
			expect(result.info.excludedTools).toContain("apply_diff")
			expect(result.info.excludedTools).toContain("write_to_file")
			// Should preserve existing exclusions
			expect(result.info.excludedTools).toContain("existing_excluded")
			// Should have the new inclusions
			expect(result.info.includedTools).toContain("apply_patch")
			// Should preserve existing inclusions
			expect(result.info.includedTools).toContain("existing_included")
		})

		it("does not add excludedTools or includedTools for non-OpenAI models", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "anthropic/claude-sonnet-4",
			})

			const result = await handler.fetchModel()
			expect(result.id).toBe("anthropic/claude-sonnet-4")
			// Should NOT have the tool exclusions/inclusions
			expect(result.info.excludedTools).toBeUndefined()
			expect(result.info.includedTools).toBeUndefined()
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: NeutralMessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Hello!" }],
			},
		]

		it("should handle streaming text responses", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "Test response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
		})

		it("should include usage information", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "Test response" }], { inputTokens: 10, outputTokens: 20 })

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.inputTokens).toBe(10)
			expect(usageChunk?.outputTokens).toBe(20)
		})

		it("should include OpenRouter cost in usage from providerMetadata", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockStreamTextReturn(
				[{ type: "text-delta", text: "response" }],
				{ inputTokens: 10, outputTokens: 20 },
				{
					openrouter: {
						usage: {
							cost: 0.001,
							costDetails: { upstreamInferenceCost: 0.0005 },
							promptTokensDetails: { cachedTokens: 5 },
							completionTokensDetails: { reasoningTokens: 3 },
						},
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
			expect(usageChunk?.totalCost).toBe(0.0015) // 0.001 + 0.0005
			expect(usageChunk?.cacheReadTokens).toBe(5)
			expect(usageChunk?.reasoningTokens).toBe(3)
		})

		it("should handle tool calls via AI SDK stream parts", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockStreamTextReturn([
				{ type: "tool-input-start", id: "call_1", toolName: "test_tool" },
				{ type: "tool-input-delta", id: "call_1", delta: '{"arg":' },
				{ type: "tool-input-delta", id: "call_1", delta: '"value"}' },
				{ type: "tool-input-end", id: "call_1" },
			])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolCallStart = chunks.filter((c) => c.type === "tool_call_start")
			expect(toolCallStart).toHaveLength(1)
			expect(toolCallStart[0].id).toBe("call_1")
			expect(toolCallStart[0].name).toBe("test_tool")

			const toolCallDeltas = chunks.filter((c) => c.type === "tool_call_delta")
			expect(toolCallDeltas).toHaveLength(2)

			const toolCallEnd = chunks.filter((c) => c.type === "tool_call_end")
			expect(toolCallEnd).toHaveLength(1)
		})

		it("should pass system prompt as string for non-caching models", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterModelId: "openai/gpt-4o", // Not in OPEN_ROUTER_PROMPT_CACHING_MODELS
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.system).toBe(systemPrompt)
		})

		it("should apply cache control for prompt-caching models", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterModelId: "anthropic/claude-sonnet-4",
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			// System prompt should be wrapped with cache control
			expect(callArgs.system).toEqual(
				expect.objectContaining({
					role: "system",
					content: systemPrompt,
					providerOptions: expect.objectContaining({
						openrouter: { cacheControl: { type: "ephemeral" } },
					}),
				}),
			)
		})

		it("should pass temperature 0 as default", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.temperature).toBe(0)
		})

		it("should include providerOptions with usage include", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openrouter?.usage).toEqual({ include: true })
		})

		it("should include provider routing when specific provider is set", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterSpecificProvider: "Anthropic",
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openrouter?.provider).toEqual({
				order: ["Anthropic"],
				only: ["Anthropic"],
				allow_fallbacks: false,
			})
		})

		it("should add x-anthropic-beta header for anthropic models", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterModelId: "anthropic/claude-sonnet-4",
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.headers).toEqual({
				"x-anthropic-beta": "fine-grained-tool-streaming-2025-05-14",
			})
		})

		it("should not add x-anthropic-beta header for non-anthropic models", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterModelId: "openai/gpt-4o",
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.headers).toBeUndefined()
		})

		it("should include maxOutputTokens when model has maxTokens", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBe(8192)
		})

		it("should exclude reasoning for Gemini 2.5 Pro when reasoning is undefined", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterModelId: "google/gemini-2.5-pro-preview",
			})
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openrouter?.reasoning).toEqual({ exclude: true })
		})
	})

	describe("error handling", () => {
		const testMessages: NeutralMessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Hello" }],
			},
		]

		it("should handle API errors and capture telemetry", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta" as const, text: "" }
					throw new Error("API Error")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage("test", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// consume
				}
			}).rejects.toThrow("API Error")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "API Error",
					provider: "OpenRouter",
					modelId: mockOptions.openRouterModelId,
					operation: "createMessage",
				}),
			)
		})

		it("should capture telemetry when createMessage throws an exception", async () => {
			const handler = new OpenRouterHandler(mockOptions)
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
					provider: "OpenRouter",
					modelId: mockOptions.openRouterModelId,
					operation: "createMessage",
				}),
			)
		})

		it("should handle rate limiting (status 429)", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const rateLimitError = new Error("Rate limit exceeded: free-models-per-day") as any
			rateLimitError.status = 429

			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta" as const, text: "" }
					throw rateLimitError
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage("test", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// consume
				}
			}).rejects.toThrow("Rate limit exceeded")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Rate limit exceeded: free-models-per-day",
					provider: "OpenRouter",
					modelId: mockOptions.openRouterModelId,
					operation: "createMessage",
				}),
			)
		})

		it("should handle rate limit errors with 429 in message", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const error = new Error("429 Rate limit exceeded: free-models-per-day")

			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta" as const, text: "" }
					throw error
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage("test", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// consume
				}
			}).rejects.toThrow("429 Rate limit exceeded")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "429 Rate limit exceeded: free-models-per-day",
					provider: "OpenRouter",
					modelId: mockOptions.openRouterModelId,
					operation: "createMessage",
				}),
			)
		})

		it("should handle errors containing 'rate limit' text", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const error = new Error("Request failed due to rate limit")

			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta" as const, text: "" }
					throw error
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage("test", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// consume
				}
			}).rejects.toThrow("rate limit")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Request failed due to rate limit",
					provider: "OpenRouter",
					modelId: mockOptions.openRouterModelId,
					operation: "createMessage",
				}),
			)
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockGenerateText.mockResolvedValue({ text: "test completion" })

			const result = await handler.completePrompt("test prompt")

			expect(result).toBe("test completion")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "test prompt",
				}),
			)
		})

		it("should handle API errors and capture telemetry", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockGenerateText.mockRejectedValue(new Error("API Error"))

			await expect(handler.completePrompt("test prompt")).rejects.toThrow("API Error")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "API Error",
					provider: "OpenRouter",
					modelId: mockOptions.openRouterModelId,
					operation: "completePrompt",
				}),
			)
		})

		it("should handle unexpected errors and capture telemetry", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockGenerateText.mockRejectedValue(new Error("Unexpected error"))

			await expect(handler.completePrompt("test prompt")).rejects.toThrow("Unexpected error")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Unexpected error",
					provider: "OpenRouter",
					modelId: mockOptions.openRouterModelId,
					operation: "completePrompt",
				}),
			)
		})

		it("should handle empty response", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			mockGenerateText.mockResolvedValue({ text: "" })

			const result = await handler.completePrompt("test prompt")
			expect(result).toBe("")
		})

		it("should pass provider routing when specific provider is set", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterSpecificProvider: "Anthropic",
			})
			mockGenerateText.mockResolvedValue({ text: "response" })

			await handler.completePrompt("test prompt")

			const callArgs = mockGenerateText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openrouter?.provider).toEqual({
				order: ["Anthropic"],
				only: ["Anthropic"],
				allow_fallbacks: false,
			})
		})

		it("should handle rate limit errors (status 429)", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const error = new Error("Rate limit exceeded: free-models-per-day") as any
			error.status = 429
			mockGenerateText.mockRejectedValue(error)

			await expect(handler.completePrompt("test prompt")).rejects.toThrow("Rate limit exceeded")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Rate limit exceeded: free-models-per-day",
					provider: "OpenRouter",
					modelId: mockOptions.openRouterModelId,
					operation: "completePrompt",
				}),
			)
		})

		it("should handle rate limit errors with 429 in message", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const error = new Error("429 Rate limit exceeded: free-models-per-day")
			mockGenerateText.mockRejectedValue(error)

			await expect(handler.completePrompt("test prompt")).rejects.toThrow("429 Rate limit exceeded")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "429 Rate limit exceeded: free-models-per-day",
					provider: "OpenRouter",
					modelId: mockOptions.openRouterModelId,
					operation: "completePrompt",
				}),
			)
		})

		it("should handle errors containing 'rate limit' text", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const error = new Error("Request failed due to rate limit")
			mockGenerateText.mockRejectedValue(error)

			await expect(handler.completePrompt("test prompt")).rejects.toThrow("rate limit")

			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Request failed due to rate limit",
					provider: "OpenRouter",
					modelId: mockOptions.openRouterModelId,
					operation: "completePrompt",
				}),
			)
		})
	})

	describe("getModel", () => {
		it("should return model info for configured model", () => {
			const handler = new OpenRouterHandler(mockOptions)
			const model = handler.getModel()
			expect(model.id).toBe("anthropic/claude-sonnet-4")
			expect(model.info).toBeDefined()
		})

		it("should use default model when no model ID provided", () => {
			const handler = new OpenRouterHandler({})
			const model = handler.getModel()
			expect(model.id).toBe("anthropic/claude-sonnet-4.5")
		})

		it("should include temperature 0 as default", () => {
			const handler = new OpenRouterHandler(mockOptions)
			const model = handler.getModel()
			expect(model.temperature).toBe(0)
		})

		it("should include model parameters from getModelParams", () => {
			const handler = new OpenRouterHandler(mockOptions)
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})

		it("should use DeepSeek default temperature for DeepSeek R1 models", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterModelId: "deepseek/deepseek-r1",
			})
			const result = await handler.fetchModel()
			expect(result.temperature).toBe(DEEP_SEEK_DEFAULT_TEMPERATURE)
		})

		it("should set topP to 0.95 for deepseek-r1 models", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterModelId: "deepseek/deepseek-r1",
			})
			const result = await handler.fetchModel()
			expect(result.topP).toBe(0.95)
		})

		it("should not set topP for non-deepseek models", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const result = await handler.fetchModel()
			expect(result.topP).toBeUndefined()
		})

		it("should respect user-provided temperature", () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				modelTemperature: 0.7,
			})
			const model = handler.getModel()
			expect(model.temperature).toBe(0.7)
		})
	})

	describe("processUsageMetrics", () => {
		// Expose protected method for testing
		class TestOpenRouterHandler extends OpenRouterHandler {
			public testProcessUsageMetrics(usage: any, providerMetadata?: any) {
				return this.processUsageMetrics(usage, providerMetadata)
			}
		}

		it("should correctly process basic usage metrics", () => {
			const handler = new TestOpenRouterHandler(mockOptions)
			const result = handler.testProcessUsageMetrics({
				inputTokens: 100,
				outputTokens: 50,
			})

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.totalCost).toBe(0)
		})

		it("should extract OpenRouter cost from provider metadata", () => {
			const handler = new TestOpenRouterHandler(mockOptions)
			const result = handler.testProcessUsageMetrics(
				{ inputTokens: 100, outputTokens: 50 },
				{
					openrouter: {
						usage: {
							cost: 0.001,
							costDetails: { upstreamInferenceCost: 0.0005 },
						},
					},
				},
			)

			expect(result.totalCost).toBe(0.0015)
		})

		it("should extract cached tokens from provider metadata", () => {
			const handler = new TestOpenRouterHandler(mockOptions)
			const result = handler.testProcessUsageMetrics(
				{ inputTokens: 100, outputTokens: 50 },
				{
					openrouter: {
						usage: {
							promptTokensDetails: { cachedTokens: 25 },
						},
					},
				},
			)

			expect(result.cacheReadTokens).toBe(25)
		})

		it("should extract reasoning tokens from provider metadata", () => {
			const handler = new TestOpenRouterHandler(mockOptions)
			const result = handler.testProcessUsageMetrics(
				{ inputTokens: 100, outputTokens: 50 },
				{
					openrouter: {
						usage: {
							completionTokensDetails: { reasoningTokens: 30 },
						},
					},
				},
			)

			expect(result.reasoningTokens).toBe(30)
		})

		it("should handle missing provider metadata gracefully", () => {
			const handler = new TestOpenRouterHandler(mockOptions)
			const result = handler.testProcessUsageMetrics({ inputTokens: 100, outputTokens: 50 })

			expect(result.cacheReadTokens).toBeUndefined()
			expect(result.reasoningTokens).toBeUndefined()
			expect(result.totalCost).toBe(0)
		})
	})

	describe("generateImage", () => {
		it("should return error when API key is not provided", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const result = await handler.generateImage("test prompt", "test-model", "")

			expect(result.success).toBe(false)
			expect(result.error).toBe("OpenRouter API key is required for image generation")
		})
	})
})
