import type { RooMessage } from "../../../core/task-persistence/rooMessage"
// npx vitest run api/providers/__tests__/requesty.spec.ts

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

vi.mock("@requesty/ai-sdk", () => ({
	createRequesty: vi.fn(() => {
		return vi.fn(() => ({
			modelId: "coding/claude-4-sonnet",
			provider: "requesty",
		}))
	}),
}))

vi.mock("delay", () => ({ default: vi.fn(() => Promise.resolve()) }))

vi.mock("../fetchers/modelCache", () => ({
	getModels: vi.fn().mockImplementation(() => {
		return Promise.resolve({
			"coding/claude-4-sonnet": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: "Claude 4 Sonnet",
			},
		})
	}),
}))

import type { Anthropic } from "@anthropic-ai/sdk"
import { createRequesty } from "@requesty/ai-sdk"

import { requestyDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"
import type { ApiHandlerCreateMessageMetadata } from "../../index"

import { RequestyHandler } from "../requesty"

describe("RequestyHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		requestyApiKey: "test-key",
		requestyModelId: "coding/claude-4-sonnet",
	}

	beforeEach(() => vi.clearAllMocks())

	describe("constructor", () => {
		it("initializes with correct options", () => {
			const handler = new RequestyHandler(mockOptions)
			expect(handler).toBeInstanceOf(RequestyHandler)

			expect(createRequesty).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://router.requesty.ai/v1",
					apiKey: mockOptions.requestyApiKey,
					compatibility: "compatible",
				}),
			)
		})

		it("can use a custom base URL", () => {
			const handler = new RequestyHandler({
				...mockOptions,
				requestyBaseUrl: "https://custom.requesty.ai/v1",
			})
			expect(handler).toBeInstanceOf(RequestyHandler)

			expect(createRequesty).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://custom.requesty.ai/v1",
					apiKey: mockOptions.requestyApiKey,
				}),
			)
		})

		it("uses 'not-provided' when no API key is given", () => {
			const handler = new RequestyHandler({})
			expect(handler).toBeInstanceOf(RequestyHandler)

			expect(createRequesty).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "not-provided",
				}),
			)
		})
	})

	describe("fetchModel", () => {
		it("returns correct model info when options are provided", async () => {
			const handler = new RequestyHandler(mockOptions)
			const result = await handler.fetchModel()

			expect(result).toMatchObject({
				id: mockOptions.requestyModelId,
				info: {
					maxTokens: 8192,
					contextWindow: 200000,
					supportsImages: true,
					supportsPromptCache: true,
					inputPrice: 3,
					outputPrice: 15,
					cacheWritesPrice: 3.75,
					cacheReadsPrice: 0.3,
					description: "Claude 4 Sonnet",
				},
			})
		})

		it("returns default model info when requestyModelId is not provided", async () => {
			const handler = new RequestyHandler({ requestyApiKey: "test-key" })
			const result = await handler.fetchModel()

			expect(result.id).toBe(requestyDefaultModelId)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "test system prompt"
		const messages: RooMessage[] = [{ role: "user" as const, content: "test message" }]

		it("generates correct stream chunks", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "test response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 20,
			})

			const mockProviderMetadata = Promise.resolve({
				requesty: {
					usage: {
						cachingTokens: 5,
						cachedTokens: 2,
					},
				},
			})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
				providerMetadata: mockProviderMetadata,
			})

			const handler = new RequestyHandler(mockOptions)
			const chunks: any[] = []
			for await (const chunk of handler.createMessage(systemPrompt, messages)) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(2)
			expect(chunks[0]).toEqual({ type: "text", text: "test response" })
			expect(chunks[1]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 20,
				cacheWriteTokens: 5,
				cacheReadTokens: 2,
				reasoningTokens: undefined,
				totalCost: expect.any(Number),
				totalInputTokens: 10,
				totalOutputTokens: 20,
			})
		})

		it("calls streamText with correct parameters", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const handler = new RequestyHandler(mockOptions)
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: "test system prompt",
					temperature: 0,
					maxOutputTokens: 8192,
				}),
			)
		})

		it("passes trace_id and mode via providerOptions", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				mode: "code",
			}

			const handler = new RequestyHandler(mockOptions)
			const stream = handler.createMessage(systemPrompt, messages, metadata)
			for await (const _chunk of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: {
						requesty: expect.objectContaining({
							extraBody: {
								requesty: {
									trace_id: "test-task",
									extra: { mode: "code" },
								},
							},
						}),
					},
				}),
			)
		})

		it("handles API errors", async () => {
			const mockError = new Error("API Error")

			async function* errorStream() {
				yield { type: "text-delta", text: "" }
				throw mockError
			}

			mockStreamText.mockReturnValue({
				fullStream: errorStream(),
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			const handler = new RequestyHandler(mockOptions)
			const generator = handler.createMessage(systemPrompt, messages)
			await generator.next()
			await expect(generator.next()).rejects.toThrow()
		})

		describe("native tool support", () => {
			const toolMessages: RooMessage[] = [{ role: "user" as const, content: "What's the weather?" }]

			it("should include tools in request when tools are provided", async () => {
				const mockTools = [
					{
						type: "function",
						function: {
							name: "get_weather",
							description: "Get the current weather",
							parameters: {
								type: "object",
								properties: {
									location: { type: "string" },
								},
								required: ["location"],
							},
						},
					},
				]

				async function* mockFullStream() {
					yield { type: "text-delta", text: "test response" }
				}

				mockStreamText.mockReturnValue({
					fullStream: mockFullStream(),
					usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
					providerMetadata: Promise.resolve({}),
				})

				const metadata: ApiHandlerCreateMessageMetadata = {
					taskId: "test-task",
					tools: mockTools as any,
					tool_choice: "auto",
				}

				const handler = new RequestyHandler(mockOptions)
				const stream = handler.createMessage(systemPrompt, toolMessages, metadata)
				for await (const _chunk of stream) {
					// consume
				}

				expect(mockStreamText).toHaveBeenCalledWith(
					expect.objectContaining({
						tools: expect.any(Object),
						toolChoice: expect.any(String),
					}),
				)
			})

			it("should handle tool call streaming parts", async () => {
				async function* mockFullStream() {
					yield {
						type: "tool-input-start",
						id: "call_123",
						toolName: "get_weather",
					}
					yield {
						type: "tool-input-delta",
						id: "call_123",
						delta: '{"location":"New York"}',
					}
					yield {
						type: "tool-input-end",
						id: "call_123",
					}
				}

				mockStreamText.mockReturnValue({
					fullStream: mockFullStream(),
					usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
					providerMetadata: Promise.resolve({}),
				})

				const handler = new RequestyHandler(mockOptions)
				const chunks: any[] = []
				for await (const chunk of handler.createMessage(systemPrompt, toolMessages)) {
					chunks.push(chunk)
				}

				const startChunks = chunks.filter((c) => c.type === "tool_call_start")
				expect(startChunks).toHaveLength(1)
				expect(startChunks[0]).toEqual({
					type: "tool_call_start",
					id: "call_123",
					name: "get_weather",
				})

				const deltaChunks = chunks.filter((c) => c.type === "tool_call_delta")
				expect(deltaChunks).toHaveLength(1)
				expect(deltaChunks[0]).toEqual({
					type: "tool_call_delta",
					id: "call_123",
					delta: '{"location":"New York"}',
				})

				const endChunks = chunks.filter((c) => c.type === "tool_call_end")
				expect(endChunks).toHaveLength(1)
				expect(endChunks[0]).toEqual({
					type: "tool_call_end",
					id: "call_123",
				})
			})
		})
	})

	describe("completePrompt", () => {
		it("returns correct response", async () => {
			mockGenerateText.mockResolvedValue({
				text: "test completion",
			})

			const handler = new RequestyHandler(mockOptions)
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
			const mockError = new Error("API Error")
			mockGenerateText.mockRejectedValue(mockError)

			const handler = new RequestyHandler(mockOptions)
			await expect(handler.completePrompt("test prompt")).rejects.toThrow()
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly process usage metrics with Requesty provider metadata", () => {
			class TestRequestyHandler extends RequestyHandler {
				public testProcessUsageMetrics(usage: any, modelInfo?: any, providerMetadata?: any) {
					return this.processUsageMetrics(usage, modelInfo, providerMetadata)
				}
			}

			const testHandler = new TestRequestyHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
			}

			const providerMetadata = {
				requesty: {
					usage: {
						cachingTokens: 10,
						cachedTokens: 20,
					},
				},
			}

			const modelInfo = {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
			}

			const result = testHandler.testProcessUsageMetrics(usage, modelInfo, providerMetadata)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(10)
			expect(result.cacheReadTokens).toBe(20)
			expect(result.totalCost).toBeGreaterThan(0)
		})

		it("should fall back to usage.details when providerMetadata is absent", () => {
			class TestRequestyHandler extends RequestyHandler {
				public testProcessUsageMetrics(usage: any, modelInfo?: any, providerMetadata?: any) {
					return this.processUsageMetrics(usage, modelInfo, providerMetadata)
				}
			}

			const testHandler = new TestRequestyHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: {
					cachedInputTokens: 15,
					reasoningTokens: 25,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(0)
			expect(result.cacheReadTokens).toBe(15)
			expect(result.reasoningTokens).toBe(25)
		})

		it("should handle missing cache metrics gracefully", () => {
			class TestRequestyHandler extends RequestyHandler {
				public testProcessUsageMetrics(usage: any, modelInfo?: any, providerMetadata?: any) {
					return this.processUsageMetrics(usage, modelInfo, providerMetadata)
				}
			}

			const testHandler = new TestRequestyHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(0)
			expect(result.cacheReadTokens).toBe(0)
			expect(result.totalCost).toBe(0)
		})
	})

	describe("isAiSdkProvider", () => {
		it("returns true", () => {
			const handler = new RequestyHandler(mockOptions)
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})
})
