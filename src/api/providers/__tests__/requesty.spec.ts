// npx vitest run api/providers/__tests__/requesty.spec.ts

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
		return vi.fn(() => ({
			modelId: "coding/claude-4-sonnet",
			provider: "requesty",
		}))
	}),
}))

vi.mock("delay", () => ({ default: vi.fn(() => Promise.resolve()) }))

const mockGetModels = vi.fn()
const mockGetModelsFromCache = vi.fn()

vi.mock("../fetchers/modelCache", () => ({
	getModels: (...args: unknown[]) => mockGetModels(...args),
	getModelsFromCache: (...args: unknown[]) => mockGetModelsFromCache(...args),
}))

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { requestyDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { RequestyHandler } from "../requesty"

const testModelInfo = {
	maxTokens: 8192,
	contextWindow: 200000,
	supportsImages: true,
	supportsPromptCache: true,
	inputPrice: 3,
	outputPrice: 15,
	cacheWritesPrice: 3.75,
	cacheReadsPrice: 0.3,
	description: "Claude 4 Sonnet",
}

describe("RequestyHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		requestyApiKey: "test-key",
		requestyModelId: "coding/claude-4-sonnet",
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockGetModelsFromCache.mockReturnValue(null)
		mockGetModels.mockResolvedValue({
			"coding/claude-4-sonnet": testModelInfo,
		})
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			const handler = new RequestyHandler(mockOptions)
			expect(handler).toBeInstanceOf(RequestyHandler)
		})

		it("should use default model ID if not provided", () => {
			const handler = new RequestyHandler({ requestyApiKey: "test-key" })
			const model = handler.getModel()
			expect(model.id).toBe(requestyDefaultModelId)
		})

		it("should use cache if available at construction time", () => {
			mockGetModelsFromCache.mockReturnValue({
				"coding/claude-4-sonnet": testModelInfo,
			})
			const handler = new RequestyHandler(mockOptions)
			const model = handler.getModel()
			expect(model.id).toBe("coding/claude-4-sonnet")
			expect(model.info).toMatchObject(testModelInfo)
		})
	})

	describe("fetchModel", () => {
		it("returns correct model info after fetching", async () => {
			const handler = new RequestyHandler(mockOptions)
			const result = await handler.fetchModel()

			expect(mockGetModels).toHaveBeenCalledWith(
				expect.objectContaining({
					provider: "requesty",
					baseUrl: expect.stringContaining("requesty"),
				}),
			)
			expect(result).toMatchObject({
				id: "coding/claude-4-sonnet",
				info: expect.objectContaining(testModelInfo),
			})
		})

		it("returns default model info when model not in fetched data", async () => {
			mockGetModels.mockResolvedValue({})
			const handler = new RequestyHandler(mockOptions)
			const result = await handler.fetchModel()

			expect(result.id).toBe("coding/claude-4-sonnet")
			// Falls back to requestyDefaultModelInfo
			expect(result.info).toBeDefined()
		})
	})

	describe("getModel", () => {
		it("should return model with anthropic format params", () => {
			mockGetModelsFromCache.mockReturnValue({
				"coding/claude-4-sonnet": testModelInfo,
			})
			const handler = new RequestyHandler(mockOptions)
			const model = handler.getModel()

			expect(model.id).toBe("coding/claude-4-sonnet")
			expect(model.info).toBeDefined()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})

		it("should apply router tool preferences for openai models", () => {
			mockGetModelsFromCache.mockReturnValue({
				"openai/gpt-4": { ...testModelInfo },
			})
			const handler = new RequestyHandler({
				...mockOptions,
				requestyModelId: "openai/gpt-4",
			})
			const model = handler.getModel()

			expect(model.info.excludedTools).toContain("apply_diff")
			expect(model.info.excludedTools).toContain("write_to_file")
			expect(model.info.includedTools).toContain("apply_patch")
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: NeutralMessageParam[] = [{ role: "user", content: [{ type: "text" as const, text: "Hello!" }] }]

		it("should handle streaming responses", async () => {
			const handler = new RequestyHandler(mockOptions)

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 10,
					outputTokens: 5,
					details: {},
					raw: {
						prompt_tokens_details: { caching_tokens: 3, cached_tokens: 2 },
					},
				}),
			})

			const chunks: any[] = []
			for await (const chunk of handler.createMessage(systemPrompt, messages)) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
		})

		it("should pass requesty trace metadata as providerOptions", async () => {
			const handler = new RequestyHandler(mockOptions)

			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, details: {}, raw: {} }),
			})

			const metadata = { taskId: "task-123", mode: "code" }
			const stream = handler.createMessage(systemPrompt, messages, metadata)
			// Consume the stream
			for await (const _chunk of stream) {
				// no-op
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: expect.objectContaining({
						requesty: { trace_id: "task-123", extra: { mode: "code" } },
					}),
				}),
			)
		})

		it("should include tools and toolChoice when provided", async () => {
			const handler = new RequestyHandler(mockOptions)

			async function* mockFullStream() {
				yield { type: "text-delta", text: "response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, details: {}, raw: {} }),
			})

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

			const metadata = { taskId: "test-task", tools: mockTools, tool_choice: "auto" as const }
			for await (const _chunk of handler.createMessage(systemPrompt, messages, metadata)) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Object),
				}),
			)
		})

		it("should handle API errors", async () => {
			const handler = new RequestyHandler(mockOptions)
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta", text: "" }
					throw new Error("API Error")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const generator = handler.createMessage(systemPrompt, messages)
			await expect(async () => {
				for await (const _chunk of generator) {
					// consume
				}
			}).rejects.toThrow()
		})
	})

	describe("completePrompt", () => {
		it("should complete a prompt using generateText", async () => {
			const handler = new RequestyHandler(mockOptions)
			mockGenerateText.mockResolvedValue({ text: "Test completion" })

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Test completion")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
				}),
			)
		})

		it("should call fetchModel before completing", async () => {
			const handler = new RequestyHandler(mockOptions)
			mockGenerateText.mockResolvedValue({ text: "done" })

			await handler.completePrompt("test")

			expect(mockGetModels).toHaveBeenCalledWith(expect.objectContaining({ provider: "requesty" }))
		})

		it("handles API errors", async () => {
			const handler = new RequestyHandler(mockOptions)
			mockGenerateText.mockRejectedValue(new Error("API Error"))

			await expect(handler.completePrompt("test prompt")).rejects.toThrow("API Error")
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly process usage metrics including cache and cost", async () => {
			class TestRequestyHandler extends RequestyHandler {
				public testProcessUsageMetrics(usage: any) {
					return this.processUsageMetrics(usage)
				}
			}

			mockGetModelsFromCache.mockReturnValue({
				"coding/claude-4-sonnet": testModelInfo,
			})
			const handler = new TestRequestyHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: {},
				raw: {
					prompt_tokens_details: { caching_tokens: 5, cached_tokens: 2 },
				},
			}

			const result = handler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(5)
			expect(result.cacheReadTokens).toBe(2)
			expect(result.totalCost).toEqual(expect.any(Number))
			expect(result.totalCost).toBeGreaterThan(0)
		})

		it("should handle missing cache metrics gracefully", async () => {
			class TestRequestyHandler extends RequestyHandler {
				public testProcessUsageMetrics(usage: any) {
					return this.processUsageMetrics(usage)
				}
			}

			mockGetModelsFromCache.mockReturnValue({
				"coding/claude-4-sonnet": testModelInfo,
			})
			const handler = new TestRequestyHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: {},
				raw: {},
			}

			const result = handler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(0)
			expect(result.cacheReadTokens).toBe(0)
		})

		it("should fall back to details.cachedInputTokens when raw is missing", async () => {
			class TestRequestyHandler extends RequestyHandler {
				public testProcessUsageMetrics(usage: any) {
					return this.processUsageMetrics(usage)
				}
			}

			mockGetModelsFromCache.mockReturnValue({
				"coding/claude-4-sonnet": testModelInfo,
			})
			const handler = new TestRequestyHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: { cachedInputTokens: 15 },
				raw: undefined,
			}

			const result = handler.testProcessUsageMetrics(usage)

			expect(result.cacheReadTokens).toBe(15)
		})
	})
})
