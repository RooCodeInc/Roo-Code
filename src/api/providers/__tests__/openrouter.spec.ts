import type { RooMessage } from "../../../core/task-persistence/rooMessage"
// pnpm --filter roo-cline test api/providers/__tests__/openrouter.spec.ts

vitest.mock("vscode", () => ({}))

import { Anthropic } from "@anthropic-ai/sdk"

import { OpenRouterHandler } from "../openrouter"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock the AI SDK
const mockStreamText = vitest.fn()
const mockGenerateText = vitest.fn()
const mockCreateOpenRouter = vitest.fn()

vitest.mock("ai", () => ({
	streamText: (...args: unknown[]) => mockStreamText(...args),
	generateText: (...args: unknown[]) => mockGenerateText(...args),
	tool: vitest.fn((t) => t),
	jsonSchema: vitest.fn((s) => s),
}))

vitest.mock("@openrouter/ai-sdk-provider", () => ({
	createOpenRouter: (...args: unknown[]) => {
		mockCreateOpenRouter(...args)
		return {
			chat: vitest.fn((modelId: string) => ({ modelId })),
		}
	},
}))

vitest.mock("delay", () => ({ default: vitest.fn(() => Promise.resolve()) }))

const mockCaptureException = vitest.fn()

vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: (...args: unknown[]) => mockCaptureException(...args),
		},
	},
}))

vitest.mock("../fetchers/modelCache", () => ({
	getModels: vitest.fn().mockImplementation(() => {
		return Promise.resolve({
			"anthropic/claude-sonnet-4": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: "Claude 3.7 Sonnet",
				thinking: false,
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
				thinking: false,
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
			"deepseek/deepseek-r1": {
				maxTokens: 8192,
				contextWindow: 64000,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0.55,
				outputPrice: 2.19,
				description: "DeepSeek R1",
				supportsReasoningEffort: true,
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
			"google/gemini-2.5-pro": {
				maxTokens: 65536,
				contextWindow: 1048576,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 1.25,
				outputPrice: 10,
				description: "Gemini 2.5 Pro",
				thinking: true,
			},
			"google/gemini-2.5-flash": {
				maxTokens: 65536,
				contextWindow: 1048576,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 0.15,
				outputPrice: 0.6,
				description: "Gemini 2.5 Flash",
			},
		})
	}),
	getModelsFromCache: vitest.fn().mockReturnValue(null),
}))

vitest.mock("../fetchers/modelEndpointCache", () => ({
	getModelEndpoints: vitest.fn().mockResolvedValue({}),
}))

describe("OpenRouterHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		openRouterApiKey: "test-key",
		openRouterModelId: "anthropic/claude-sonnet-4",
	}

	beforeEach(() => {
		vitest.clearAllMocks()
	})

	it("initializes with correct options", () => {
		const handler = new OpenRouterHandler(mockOptions)
		expect(handler).toBeInstanceOf(OpenRouterHandler)
	})

	describe("fetchModel", () => {
		it("returns correct model info when options are provided", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const result = await handler.fetchModel()

			expect(result).toMatchObject({
				id: mockOptions.openRouterModelId,
				maxTokens: 8192,
				temperature: 0,
				reasoningEffort: undefined,
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
			// With the new clamping logic, 128000 tokens (64% of 200000 context window)
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
		it("generates correct stream chunks with basic usage and totalCost", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			// Create mock async iterator for fullStream
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test response", id: "1" }
			})()

			// Mock usage promises
			const mockUsage = Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 })
			const mockTotalUsage = Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 })

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: mockUsage,
				totalUsage: mockTotalUsage,
				providerMetadata: Promise.resolve(undefined),
			})

			const systemPrompt = "test system prompt"
			const messages: RooMessage[] = [{ role: "user" as const, content: "test message" }]

			const generator = handler.createMessage(systemPrompt, messages)
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			// Verify stream chunks - should have text and usage chunks
			expect(chunks).toHaveLength(2)
			expect(chunks[0]).toEqual({ type: "text", text: "test response" })
			// Usage chunk should include totalCost calculated from model pricing
			// Model: anthropic/claude-sonnet-4 with inputPrice: 3, outputPrice: 15 (per million)
			// Cost = (10 * 3 / 1_000_000) + (20 * 15 / 1_000_000) = 0.00003 + 0.0003 = 0.00033
			expect(chunks[1]).toMatchObject({
				type: "usage",
				inputTokens: 10,
				outputTokens: 20,
				totalCost: expect.any(Number),
			})
			expect((chunks[1] as any).totalCost).toBeCloseTo(0.00033, 6)

			// Verify streamText was called with correct parameters
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.any(Array),
					maxOutputTokens: 8192,
					temperature: 0,
				}),
			)
		})

		it("includes cache read tokens in usage when provider metadata contains them", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test", id: "1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
				totalUsage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
				providerMetadata: Promise.resolve({
					openrouter: {
						cachedInputTokens: 30,
					},
				}),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
				cacheReadTokens: 30,
				totalCost: expect.any(Number),
			})
		})

		it("includes reasoning tokens in usage when provider metadata contains them", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test", id: "1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 150, totalTokens: 250 }),
				totalUsage: Promise.resolve({ inputTokens: 100, outputTokens: 150, totalTokens: 250 }),
				providerMetadata: Promise.resolve({
					openrouter: {
						reasoningOutputTokens: 50,
					},
				}),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 150,
				reasoningTokens: 50,
				totalCost: expect.any(Number),
			})
		})

		it("includes all detailed usage metrics when provider metadata contains them", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test", id: "1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 200, outputTokens: 100, totalTokens: 300 }),
				totalUsage: Promise.resolve({ inputTokens: 200, outputTokens: 100, totalTokens: 300 }),
				providerMetadata: Promise.resolve({
					openrouter: {
						cachedInputTokens: 50,
						cacheCreationInputTokens: 20,
						reasoningOutputTokens: 30,
					},
				}),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 200,
				outputTokens: 100,
				cacheReadTokens: 50,
				cacheWriteTokens: 20,
				reasoningTokens: 30,
				totalCost: expect.any(Number),
			})
		})

		it("handles experimental_providerMetadata fallback", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test", id: "1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
				totalUsage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
				providerMetadata: Promise.resolve(undefined),
				experimental_providerMetadata: Promise.resolve({
					openrouter: {
						cachedInputTokens: 25,
					},
				}),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
				cacheReadTokens: 25,
				totalCost: expect.any(Number),
			})
		})

		it("handles reasoning delta chunks", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield { type: "reasoning-delta", text: "thinking...", id: "1" }
				yield { type: "text-delta", text: "result", id: "2" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			expect(chunks[0]).toEqual({ type: "reasoning", text: "thinking..." })
			expect(chunks[1]).toEqual({ type: "text", text: "result" })
		})

		it("accumulates reasoning details for getReasoningDetails()", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield { type: "reasoning-delta", text: "step 1...", id: "1" }
				yield { type: "reasoning-delta", text: "step 2...", id: "2" }
				yield { type: "text-delta", text: "result", id: "3" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])

			for await (const _ of generator) {
				// consume all chunks
			}

			// After streaming, getReasoningDetails should return accumulated reasoning
			const reasoningDetails = handler.getReasoningDetails()
			expect(reasoningDetails).toBeDefined()
			expect(reasoningDetails).toHaveLength(1)
			expect(reasoningDetails![0].type).toBe("reasoning.text")
			expect(reasoningDetails![0].text).toBe("step 1...step 2...")
			expect(reasoningDetails![0].index).toBe(0)
		})

		it("handles tool call streaming", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield { type: "tool-input-start", id: "call_1", toolName: "read_file" }
				yield { type: "tool-input-delta", id: "call_1", delta: '{"path":' }
				yield { type: "tool-input-delta", id: "call_1", delta: '"test.ts"}' }
				yield { type: "tool-input-end", id: "call_1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			expect(chunks[0]).toEqual({ type: "tool_call_start", id: "call_1", name: "read_file" })
			expect(chunks[1]).toEqual({ type: "tool_call_delta", id: "call_1", delta: '{"path":' })
			expect(chunks[2]).toEqual({ type: "tool_call_delta", id: "call_1", delta: '"test.ts"}' })
			expect(chunks[3]).toEqual({ type: "tool_call_end", id: "call_1" })
		})

		it("ignores tool-call events (handled by tool-input-start/delta/end)", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield {
					type: "tool-call",
					toolCallId: "call_1",
					toolName: "read_file",
					input: { path: "test.ts" },
				}
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			// tool-call is intentionally ignored by processAiSdkStreamPart,
			// only usage chunk should be present
			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toMatchObject({ type: "usage" })
		})

		it("handles API errors gracefully", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			mockStreamText.mockImplementation(() => {
				throw new Error("API Error")
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			expect(chunks[0]).toEqual({
				type: "error",
				error: "OpenRouterError",
				message: "OpenRouter API Error: API Error",
			})

			// Verify telemetry was called
			expect(mockCaptureException).toHaveBeenCalledTimes(1)
			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "API Error",
					provider: "OpenRouter",
					operation: "createMessage",
				}),
			)
		})

		it("handles stream errors", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield { type: "error", error: new Error("Stream error") }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
				totalUsage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			expect(chunks[0]).toEqual({
				type: "error",
				error: "StreamError",
				message: "Stream error",
			})
		})

		it("passes tools to streamText when provided", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test", id: "1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "read_file",
						description: "Read a file",
						parameters: { type: "object", properties: { path: { type: "string" } } },
					},
				},
			]

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }], {
				taskId: "test",
				tools,
			})

			for await (const _ of generator) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.objectContaining({
						read_file: expect.any(Object),
					}),
				}),
			)
		})

		it("passes reasoning parameters via extraBody when reasoning effort is enabled", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "deepseek/deepseek-r1",
				reasoningEffort: "high",
				enableReasoningEffort: true,
			})

			const mockFullStream = (async function* () {
				yield { type: "reasoning-delta", text: "thinking...", id: "1" }
				yield { type: "text-delta", text: "result", id: "2" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])

			for await (const _ of generator) {
				// consume
			}

			// Verify that reasoning was passed via extraBody when creating the provider
			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					extraBody: expect.objectContaining({
						reasoning: expect.objectContaining({
							effort: "high",
						}),
					}),
				}),
			)

			// Verify that providerOptions does NOT contain extended_thinking
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: undefined,
				}),
			)
		})

		it("does not pass reasoning via extraBody when reasoning is disabled", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "anthropic/claude-sonnet-4",
			})

			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test", id: "1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])

			for await (const _ of generator) {
				// consume
			}

			// Verify that createOpenRouter was called with correct base config
			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "test-key",
					baseURL: "https://openrouter.ai/api/v1",
				}),
			)

			// Verify that providerOptions is undefined when no provider routing
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: undefined,
				}),
			)
		})
	})

	describe("completePrompt", () => {
		it("returns correct response", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			mockGenerateText.mockResolvedValue({
				text: "test completion",
			})

			const result = await handler.completePrompt("test prompt")

			expect(result).toBe("test completion")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "test prompt",
					maxOutputTokens: 8192,
					temperature: 0,
				}),
			)
		})

		it("passes reasoning parameters via extraBody when reasoning effort is enabled", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "deepseek/deepseek-r1",
				reasoningEffort: "medium",
				enableReasoningEffort: true,
			})

			mockGenerateText.mockResolvedValue({
				text: "test completion with reasoning",
			})

			const result = await handler.completePrompt("test prompt")

			expect(result).toBe("test completion with reasoning")

			// Verify that reasoning was passed via extraBody when creating the provider
			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					extraBody: expect.objectContaining({
						reasoning: expect.objectContaining({
							effort: "medium",
						}),
					}),
				}),
			)

			// Verify that providerOptions does NOT contain extended_thinking
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: undefined,
				}),
			)
		})

		it("handles API errors", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			mockGenerateText.mockRejectedValue(new Error("API Error"))

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"OpenRouter completion error: API Error",
			)

			// Verify telemetry was called
			expect(mockCaptureException).toHaveBeenCalledTimes(1)
			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "API Error",
					provider: "OpenRouter",
					operation: "completePrompt",
				}),
			)
		})

		it("handles rate limit errors", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			mockGenerateText.mockRejectedValue(new Error("Rate limit exceeded"))

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"OpenRouter completion error: Rate limit exceeded",
			)

			// Verify telemetry was called
			expect(mockCaptureException).toHaveBeenCalledTimes(1)
			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Rate limit exceeded",
					provider: "OpenRouter",
					operation: "completePrompt",
				}),
			)
		})
	})

	describe("provider configuration", () => {
		it("creates OpenRouter provider with correct API key and base URL", async () => {
			const customOptions: ApiHandlerOptions = {
				openRouterApiKey: "custom-key",
				openRouterBaseUrl: "https://custom.openrouter.ai/api/v1",
				openRouterModelId: "anthropic/claude-sonnet-4",
			}

			const handler = new OpenRouterHandler(customOptions)

			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test", id: "1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])

			for await (const _ of generator) {
				// consume
			}

			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "custom-key",
					baseURL: "https://custom.openrouter.ai/api/v1",
				}),
			)
		})

		it("uses default base URL when not specified", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test", id: "1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])

			for await (const _ of generator) {
				// consume
			}

			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "test-key",
					baseURL: "https://openrouter.ai/api/v1",
				}),
			)
		})
	})

	describe("getReasoningDetails", () => {
		it("returns undefined when no reasoning was captured", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			// Stream with no reasoning
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "just text", id: "1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator = handler.createMessage("test", [{ role: "user", content: "test" }])

			for await (const _ of generator) {
				// consume all chunks
			}

			// No reasoning was captured, should return undefined
			const reasoningDetails = handler.getReasoningDetails()
			expect(reasoningDetails).toBeUndefined()
		})

		it("resets reasoning details between requests", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			// First request with reasoning
			const mockFullStream1 = (async function* () {
				yield { type: "reasoning-delta", text: "first request reasoning", id: "1" }
				yield { type: "text-delta", text: "result 1", id: "2" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream1,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator1 = handler.createMessage("test", [{ role: "user", content: "test" }])
			for await (const _ of generator1) {
				// consume
			}

			// Verify first request captured reasoning
			let reasoningDetails = handler.getReasoningDetails()
			expect(reasoningDetails).toBeDefined()
			expect(reasoningDetails![0].text).toBe("first request reasoning")

			// Second request without reasoning
			const mockFullStream2 = (async function* () {
				yield { type: "text-delta", text: "result 2", id: "1" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream2,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})

			const generator2 = handler.createMessage("test", [{ role: "user", content: "test" }])
			for await (const _ of generator2) {
				// consume
			}

			// Reasoning details should be reset (undefined since second request had no reasoning)
			reasoningDetails = handler.getReasoningDetails()
			expect(reasoningDetails).toBeUndefined()
		})

		it("returns undefined before any streaming occurs", () => {
			const handler = new OpenRouterHandler(mockOptions)

			// getReasoningDetails before any createMessage call
			const reasoningDetails = handler.getReasoningDetails()
			expect(reasoningDetails).toBeUndefined()
		})
	})

	describe("model-specific handling", () => {
		const mockStreamResult = () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "response", id: "1" }
			})()
			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
				totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			})
		}

		const consumeGenerator = async (
			handler: any,
			system = "test",
			msgs: any[] = [{ role: "user", content: "test" }],
		) => {
			const generator = handler.createMessage(system, msgs)
			for await (const _ of generator) {
				// consume
			}
		}

		it("passes topP for DeepSeek R1 models", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "deepseek/deepseek-r1",
			})
			mockStreamResult()
			await consumeGenerator(handler)

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					topP: 0.95,
				}),
			)
		})

		it("does not pass topP for non-R1 models", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "openai/gpt-4o",
			})
			mockStreamResult()
			await consumeGenerator(handler)

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					topP: undefined,
				}),
			)
		})

		it("does not use R1 format for DeepSeek R1 models (uses standard AI SDK path)", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "deepseek/deepseek-r1",
			})
			mockStreamResult()
			await consumeGenerator(handler, "system prompt")

			// R1 models should NOT pass extraBody.messages (R1 format conversion removed)
			const providerCall = mockCreateOpenRouter.mock.calls[0][0]
			expect(providerCall?.extraBody?.messages).toBeUndefined()

			// System prompt should be passed normally via streamText
			const streamTextCall = mockStreamText.mock.calls[0][0]
			expect(streamTextCall.system).toBe("system prompt")
		})

		it("applies Anthropic beta headers for Anthropic models", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "anthropic/claude-sonnet-4",
			})
			mockStreamResult()
			await consumeGenerator(handler)

			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: { "x-anthropic-beta": "fine-grained-tool-streaming-2025-05-14" },
				}),
			)
		})

		it("does not apply Anthropic beta headers for non-Anthropic models", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "openai/gpt-4o",
			})
			mockStreamResult()
			await consumeGenerator(handler)

			const call = mockCreateOpenRouter.mock.calls[0][0]
			expect(call.headers).toBeUndefined()
		})

		it("passes system prompt directly for Anthropic models (no caching transform)", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "anthropic/claude-sonnet-4",
			})
			mockStreamResult()
			await consumeGenerator(handler)

			// System prompt should be passed directly via streamText
			const streamTextCall = mockStreamText.mock.calls[0][0]
			expect(streamTextCall.system).toBe("test")

			// Messages should be the converted AI SDK messages (no system-role message injected)
			const systemMsgs = streamTextCall.messages.filter((m: any) => m.role === "system")
			expect(systemMsgs).toHaveLength(0)
		})

		it("disables reasoning for Gemini 2.5 Pro when not explicitly configured", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "google/gemini-2.5-pro",
			})
			mockStreamResult()
			await consumeGenerator(handler)

			expect(mockCreateOpenRouter).toHaveBeenCalledWith(
				expect.objectContaining({
					extraBody: expect.objectContaining({
						reasoning: { exclude: true },
					}),
				}),
			)
		})

		it("passes system prompt directly for Gemini models (no caching transform)", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "google/gemini-2.5-flash",
			})
			mockStreamResult()
			await consumeGenerator(handler)

			// System prompt should be passed directly via streamText
			const streamTextCall = mockStreamText.mock.calls[0][0]
			expect(streamTextCall.system).toBe("test")

			// No system-role message should be injected
			const systemMsgs = streamTextCall.messages.filter((m: any) => m.role === "system")
			expect(systemMsgs).toHaveLength(0)
		})

		it("does not use extraBody.messages for Gemini models outside caching set", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "google/gemini-3-pro-preview",
			})
			mockStreamResult()
			await consumeGenerator(handler)

			// Non-caching Gemini models should go through the AI SDK natively
			// (no extraBody.messages — reasoning_details are wired via providerOptions)
			const callArgs = mockCreateOpenRouter.mock.calls[0]?.[0] ?? {}
			const extraBody = callArgs.extraBody ?? {}
			expect(extraBody.messages).toBeUndefined()
		})

		it("passes topP to completePrompt for R1 models", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "deepseek/deepseek-r1",
			})
			mockGenerateText.mockResolvedValue({ text: "completion" })

			await handler.completePrompt("test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					topP: 0.95,
				}),
			)
		})
	})
})
