// npx vitest api/providers/__tests__/deepinfra.spec.ts

const { mockStreamText, mockGenerateText, mockCreateDeepInfra } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateDeepInfra: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/deepinfra", () => ({
	createDeepInfra: mockCreateDeepInfra.mockImplementation(() => {
		return vi.fn(() => ({
			modelId: "test-model",
			provider: "deepinfra",
		}))
	}),
}))

import { deepInfraDefaultModelId, deepInfraDefaultModelInfo } from "@roo-code/types"

vi.mock("../fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({
		[deepInfraDefaultModelId]: deepInfraDefaultModelInfo,
	}),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

import type { Anthropic } from "@anthropic-ai/sdk"
import type { ApiHandlerOptions } from "../../../shared/api"
import { DeepInfraHandler } from "../deepinfra"

describe("DeepInfraHandler", () => {
	let handler: DeepInfraHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			deepInfraApiKey: "test-api-key",
			deepInfraModelId: deepInfraDefaultModelId,
		}
		handler = new DeepInfraHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(DeepInfraHandler)
			expect(handler.getModel().id).toBe(deepInfraDefaultModelId)
		})

		it("should use default model ID if not provided", () => {
			const handlerWithoutModel = new DeepInfraHandler({
				...mockOptions,
				deepInfraModelId: undefined,
			})
			expect(handlerWithoutModel.getModel().id).toBe(deepInfraDefaultModelId)
		})
	})

	describe("createProvider", () => {
		it("should create provider with correct options", () => {
			// Trigger provider creation via getLanguageModel
			const testHandler = new DeepInfraHandler({
				deepInfraApiKey: "my-key",
				deepInfraBaseUrl: "https://custom.deepinfra.com/v1",
			})

			// Access protected method via any
			;(testHandler as any).createProvider()

			expect(mockCreateDeepInfra).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "my-key",
					baseURL: "https://custom.deepinfra.com/v1",
					headers: {
						"X-Deepinfra-Source": "roo-code",
						"X-Deepinfra-Version": "2025-08-25",
					},
				}),
			)
		})

		it("should use default base URL when not provided", () => {
			;(handler as any).createProvider()

			expect(mockCreateDeepInfra).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.deepinfra.com/v1/openai",
				}),
			)
		})

		it("should use 'not-provided' as API key when not set", () => {
			const handlerWithoutKey = new DeepInfraHandler({})
			;(handlerWithoutKey as any).createProvider()

			expect(mockCreateDeepInfra).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "not-provided",
				}),
			)
		})
	})

	describe("getModel", () => {
		it("should return default model when no model is specified", () => {
			const model = handler.getModel()
			expect(model.id).toBe(deepInfraDefaultModelId)
			expect(model.info).toEqual(deepInfraDefaultModelInfo)
		})

		it("should return default model info for unknown model", () => {
			const handlerWithUnknown = new DeepInfraHandler({
				...mockOptions,
				deepInfraModelId: "unknown/model",
			})
			const model = handlerWithUnknown.getModel()
			expect(model.id).toBe("unknown/model")
			expect(model.info).toEqual(deepInfraDefaultModelInfo)
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text" as const,
						text: "Hello!",
					},
				],
			},
		]

		it("should handle streaming responses", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
			})

			const mockProviderMetadata = Promise.resolve({})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
				providerMetadata: mockProviderMetadata,
			})

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

		it("should handle reasoning content in stream", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning", text: "Let me think..." }
				yield { type: "text-delta", text: "Answer" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
			})

			const mockProviderMetadata = Promise.resolve({})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
				providerMetadata: mockProviderMetadata,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Let me think...")

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Answer")
		})

		it("should include usage information with cost calculation", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 20,
			})

			const mockProviderMetadata = Promise.resolve({})

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: mockUsage,
				providerMetadata: mockProviderMetadata,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(20)
			expect(usageChunks[0].totalCost).toEqual(expect.any(Number))
		})

		it("should pass tools and toolChoice to streamText", async () => {
			const testTools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: {
							type: "object",
							properties: {
								arg1: { type: "string", description: "First argument" },
							},
							required: ["arg1"],
						},
					},
				},
			]

			async function* mockFullStream() {
				yield { type: "finish", finishReason: "stop" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task-id",
				tools: testTools,
				tool_choice: "auto",
			})

			for await (const _ of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: systemPrompt,
					tools: expect.any(Object),
				}),
			)
		})

		it("should handle tool call streaming events", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-input-start",
					id: "call_123",
					toolName: "test_tool",
				}
				yield {
					type: "tool-input-delta",
					id: "call_123",
					delta: '{"arg1":',
				}
				yield {
					type: "tool-input-delta",
					id: "call_123",
					delta: '"value"}',
				}
				yield {
					type: "tool-input-end",
					id: "call_123",
				}
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task-id",
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const startChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
			expect(startChunks).toHaveLength(1)
			expect(startChunks[0].id).toBe("call_123")
			expect(startChunks[0].name).toBe("test_tool")

			const deltaChunks = chunks.filter((chunk) => chunk.type === "tool_call_delta")
			expect(deltaChunks).toHaveLength(2)
		})

		it("should handle errors using handleAiSdkError", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "" }
				throw new Error("API error")
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			await expect(async () => {
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow()
		})
	})

	describe("completePrompt", () => {
		it("should complete a prompt using generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test completion",
			})

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Test completion")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
				}),
			)
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly calculate cost with model info", () => {
			class TestDeepInfraHandler extends DeepInfraHandler {
				public testProcessUsageMetrics(usage: any, providerMetadata?: any, modelInfo?: any) {
					return this.processUsageMetrics(usage, providerMetadata, modelInfo)
				}
			}

			const testHandler = new TestDeepInfraHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
			}

			const result = testHandler.testProcessUsageMetrics(usage, {}, deepInfraDefaultModelInfo)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.totalCost).toEqual(expect.any(Number))
			expect(result.totalCost).toBeGreaterThan(0)
		})

		it("should handle cache metrics from providerMetadata", () => {
			class TestDeepInfraHandler extends DeepInfraHandler {
				public testProcessUsageMetrics(usage: any, providerMetadata?: any, modelInfo?: any) {
					return this.processUsageMetrics(usage, providerMetadata, modelInfo)
				}
			}

			const testHandler = new TestDeepInfraHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
			}

			const providerMetadata = {
				deepinfra: {
					cacheWriteTokens: 15,
					cachedTokens: 5,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage, providerMetadata, deepInfraDefaultModelInfo)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(15)
			expect(result.cacheReadTokens).toBe(5)
			expect(result.totalCost).toEqual(expect.any(Number))
		})

		it("should handle missing cache metrics gracefully", () => {
			class TestDeepInfraHandler extends DeepInfraHandler {
				public testProcessUsageMetrics(usage: any, providerMetadata?: any, modelInfo?: any) {
					return this.processUsageMetrics(usage, providerMetadata, modelInfo)
				}
			}

			const testHandler = new TestDeepInfraHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
			}

			const result = testHandler.testProcessUsageMetrics(usage, {}, deepInfraDefaultModelInfo)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})

		it("should return zero cost without model info", () => {
			class TestDeepInfraHandler extends DeepInfraHandler {
				public testProcessUsageMetrics(usage: any, providerMetadata?: any, modelInfo?: any) {
					return this.processUsageMetrics(usage, providerMetadata, modelInfo)
				}
			}

			const testHandler = new TestDeepInfraHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.totalCost).toBe(0)
		})

		it("should use cachedInputTokens from usage details as fallback", () => {
			class TestDeepInfraHandler extends DeepInfraHandler {
				public testProcessUsageMetrics(usage: any, providerMetadata?: any, modelInfo?: any) {
					return this.processUsageMetrics(usage, providerMetadata, modelInfo)
				}
			}

			const testHandler = new TestDeepInfraHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: {
					cachedInputTokens: 25,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage, {}, deepInfraDefaultModelInfo)

			expect(result.cacheReadTokens).toBe(25)
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})
})
