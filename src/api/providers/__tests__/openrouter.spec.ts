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
		it("generates correct stream chunks", async () => {
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
			})

			const systemPrompt = "test system prompt"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user" as const, content: "test message" }]

			const generator = handler.createMessage(systemPrompt, messages)
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			// Verify stream chunks - should have text and usage chunks
			expect(chunks).toHaveLength(2)
			expect(chunks[0]).toEqual({ type: "text", text: "test response" })
			expect(chunks[1]).toEqual({ type: "usage", inputTokens: 10, outputTokens: 20 })

			// Verify streamText was called with correct parameters
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: systemPrompt,
					messages: expect.any(Array),
					maxOutputTokens: 8192,
					temperature: 0,
				}),
			)
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

		it("handles complete tool call events", async () => {
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

			expect(chunks[0]).toEqual({
				type: "tool_call",
				id: "call_1",
				name: "read_file",
				arguments: '{"path":"test.ts"}',
			})
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

		it("handles API errors", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			mockGenerateText.mockRejectedValue(new Error("API Error"))

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"OpenRouter completion error: API Error",
			)
		})

		it("handles rate limit errors", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			mockGenerateText.mockRejectedValue(new Error("Rate limit exceeded"))

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"OpenRouter completion error: Rate limit exceeded",
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

			expect(mockCreateOpenRouter).toHaveBeenCalledWith({
				apiKey: "custom-key",
				baseURL: "https://custom.openrouter.ai/api/v1",
			})
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

			expect(mockCreateOpenRouter).toHaveBeenCalledWith({
				apiKey: "test-key",
				baseURL: "https://openrouter.ai/api/v1",
			})
		})
	})
})
