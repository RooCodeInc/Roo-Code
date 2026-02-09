// npx vitest run api/providers/__tests__/openai.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText, mockCreateOpenAI } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateOpenAI: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: mockCreateOpenAI.mockImplementation(() => ({
		chat: vi.fn(() => ({
			modelId: "gpt-4",
			provider: "openai.chat",
		})),
	})),
}))

// Mock axios for getOpenAiModels tests
vi.mock("axios", () => ({
	default: {
		get: vi.fn(),
	},
}))

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { openAiModelInfoSaneDefaults } from "@roo-code/types"
import axios from "axios"

import type { ApiHandlerOptions } from "../../../shared/api"

import { OpenAiHandler, getOpenAiModels } from "../openai"

// Helper: create a standard mock fullStream generator
function createMockFullStream(
	parts: Array<{ type: string; text?: string; id?: string; toolName?: string; delta?: string }>,
) {
	return async function* () {
		for (const part of parts) {
			yield part
		}
	}
}

// Helper: create default mock return value for streamText
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

describe("OpenAiHandler", () => {
	let handler: OpenAiHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			openAiApiKey: "test-api-key",
			openAiModelId: "gpt-4",
			openAiBaseUrl: "https://api.openai.com/v1",
		}
		handler = new OpenAiHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(OpenAiHandler)
			expect(handler.getModel().id).toBe(mockOptions.openAiModelId)
		})

		it("should use custom base URL if provided", () => {
			const customBaseUrl = "https://custom.openai.com/v1"
			const handlerWithCustomUrl = new OpenAiHandler({
				...mockOptions,
				openAiBaseUrl: customBaseUrl,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(OpenAiHandler)
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: NeutralMessageParam[] = [
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
			mockStreamTextReturn([{ type: "text-delta", text: "Test response" }])

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
			mockStreamTextReturn([{ type: "text-delta", text: "Test response" }], { inputTokens: 10, outputTokens: 5 })

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((chunk) => chunk.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.inputTokens).toBe(10)
			expect(usageChunk?.outputTokens).toBe(5)
		})

		it("should handle tool calls via AI SDK stream parts", async () => {
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

		it("should include reasoning_effort when reasoning effort is enabled", async () => {
			const reasoningOptions: ApiHandlerOptions = {
				...mockOptions,
				enableReasoningEffort: true,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					supportsPromptCache: false,
					supportsReasoningEffort: true,
					reasoningEffort: "high",
				},
			}
			const reasoningHandler = new OpenAiHandler(reasoningOptions)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = reasoningHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.reasoningEffort).toBe("high")
		})

		it("should not include reasoning_effort when reasoning effort is disabled", async () => {
			const noReasoningOptions: ApiHandlerOptions = {
				...mockOptions,
				enableReasoningEffort: false,
				openAiCustomModelInfo: { contextWindow: 128_000, supportsPromptCache: false },
			}
			const noReasoningHandler = new OpenAiHandler(noReasoningOptions)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = noReasoningHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions).toBeUndefined()
		})

		it("should include maxOutputTokens when includeMaxTokens is true", async () => {
			const optionsWithMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: true,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithMaxTokens = new OpenAiHandler(optionsWithMaxTokens)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handlerWithMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBe(4096)
		})

		it("should not include maxOutputTokens when includeMaxTokens is false", async () => {
			const optionsWithoutMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: false,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithoutMaxTokens = new OpenAiHandler(optionsWithoutMaxTokens)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handlerWithoutMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBeUndefined()
		})

		it("should not include maxOutputTokens when includeMaxTokens is undefined", async () => {
			const optionsWithUndefinedMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithDefaultMaxTokens = new OpenAiHandler(optionsWithUndefinedMaxTokens)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handlerWithDefaultMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBeUndefined()
		})

		it("should use user-configured modelMaxTokens instead of model default maxTokens", async () => {
			const optionsWithUserMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: true,
				modelMaxTokens: 32000,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithUserMaxTokens = new OpenAiHandler(optionsWithUserMaxTokens)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handlerWithUserMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBe(32000)
		})

		it("should fallback to model default maxTokens when user modelMaxTokens is not set", async () => {
			const optionsWithoutUserMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: true,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithoutUserMaxTokens = new OpenAiHandler(optionsWithoutUserMaxTokens)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handlerWithoutUserMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBe(4096)
		})

		it("should pass system prompt to streamText", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.system).toBe(systemPrompt)
		})

		it("should pass temperature 0 as default", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.temperature).toBe(0)
		})
	})

	describe("error handling", () => {
		const testMessages: NeutralMessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text" as const,
						text: "Hello",
					},
				],
			},
		]

		it("should handle API errors", async () => {
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta" as const, textDelta: "" }
					throw new Error("API Error")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage("system prompt", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow("API Error")
		})

		it("should handle rate limiting", async () => {
			const rateLimitError = new Error("Rate limit exceeded")
			;(rateLimitError as any).status = 429

			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta" as const, textDelta: "" }
					throw rateLimitError
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage("system prompt", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow("Rate limit exceeded")
		})
	})

	describe("completePrompt", () => {
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

		it("should handle API errors", async () => {
			mockGenerateText.mockRejectedValue(new Error("API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("OpenAI completion error: API Error")
		})

		it("should handle empty response", async () => {
			mockGenerateText.mockResolvedValue({ text: "" })
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})

	describe("getModel", () => {
		it("should return model info with sane defaults", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.openAiModelId)
			expect(model.info).toBeDefined()
			expect(model.info.contextWindow).toBe(128_000)
			expect(model.info.supportsImages).toBe(true)
		})

		it("should handle undefined model ID", () => {
			const handlerWithoutModel = new OpenAiHandler({
				...mockOptions,
				openAiModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe("")
			expect(model.info).toBeDefined()
		})

		it("should use sane defaults when no custom model info is provided", () => {
			const model = handler.getModel()
			expect(model.info).toBe(openAiModelInfoSaneDefaults)
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})

		it("should use 0 as the default temperature", () => {
			const model = handler.getModel()
			expect(model.temperature).toBe(0)
		})

		it("should respect user-provided temperature", () => {
			const handlerWithTemp = new OpenAiHandler({
				...mockOptions,
				modelTemperature: 0.7,
			})
			const model = handlerWithTemp.getModel()
			expect(model.temperature).toBe(0.7)
		})
	})

	describe("Azure AI Inference Service", () => {
		const azureOptions: ApiHandlerOptions = {
			...mockOptions,
			openAiBaseUrl: "https://test.services.ai.azure.com",
			openAiModelId: "deepseek-v3",
			azureApiVersion: "2024-05-01-preview",
		}

		it("should initialize with Azure AI Inference Service configuration", () => {
			const azureHandler = new OpenAiHandler(azureOptions)
			expect(azureHandler).toBeInstanceOf(OpenAiHandler)
			expect(azureHandler.getModel().id).toBe(azureOptions.openAiModelId)
		})

		it("should create provider with /models appended to baseURL for Azure AI Inference", async () => {
			const azureHandler = new OpenAiHandler(azureOptions)

			mockStreamTextReturn([{ type: "text-delta", text: "Test response" }])

			const stream = azureHandler.createMessage("You are a helpful assistant.", [
				{ role: "user", content: "Hello!" },
			])
			for await (const _chunk of stream) {
				// consume stream
			}

			// Verify createOpenAI was called with /models appended to baseURL
			expect(mockCreateOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://test.services.ai.azure.com/models",
				}),
			)
		})

		it("should handle streaming responses with Azure AI Inference Service", async () => {
			const azureHandler = new OpenAiHandler(azureOptions)

			mockStreamTextReturn([{ type: "text-delta", text: "Test response" }])

			const stream = azureHandler.createMessage("You are a helpful assistant.", [
				{ role: "user", content: "Hello!" },
			])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
		})

		it("should handle completePrompt with Azure AI Inference Service", async () => {
			const azureHandler = new OpenAiHandler(azureOptions)
			mockGenerateText.mockResolvedValue({ text: "Test response" })

			const result = await azureHandler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
		})
	})

	describe("Azure OpenAI", () => {
		it("should create provider with api-key header for Azure OpenAI", async () => {
			const azureOptions: ApiHandlerOptions = {
				...mockOptions,
				openAiBaseUrl: "https://myresource.openai.azure.com",
				openAiUseAzure: true,
			}
			const azureHandler = new OpenAiHandler(azureOptions)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = azureHandler.createMessage("system", [{ role: "user", content: "Hello!" }])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockCreateOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						"api-key": "test-api-key",
					}),
				}),
			)
		})
	})

	describe("O3 Family Models", () => {
		const o3Options: ApiHandlerOptions = {
			...mockOptions,
			openAiModelId: "o3-mini",
			openAiCustomModelInfo: {
				contextWindow: 128_000,
				maxTokens: 65536,
				supportsPromptCache: false,
				reasoningEffort: "medium" as "low" | "medium" | "high",
			},
		}

		it("should use developer systemMessageMode for O3 models", async () => {
			const o3Handler = new OpenAiHandler(o3Options)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = o3Handler.createMessage("You are a helpful assistant.", [])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.systemMessageMode).toBe("developer")
		})

		it("should prepend 'Formatting re-enabled' to system prompt for O3 models", async () => {
			const o3Handler = new OpenAiHandler(o3Options)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = o3Handler.createMessage("You are a helpful assistant.", [])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.system).toBe("Formatting re-enabled\nYou are a helpful assistant.")
		})

		it("should pass undefined temperature for O3 models", async () => {
			const o3Handler = new OpenAiHandler(o3Options)

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = o3Handler.createMessage("You are a helpful assistant.", [])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.temperature).toBeUndefined()
		})

		it("should handle O3 model with maxOutputTokens when includeMaxTokens is true", async () => {
			const o3Handler = new OpenAiHandler({
				...o3Options,
				includeMaxTokens: true,
				modelMaxTokens: 32000,
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = o3Handler.createMessage("You are a helpful assistant.", [])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBe(32000)
		})

		it("should handle O3 model without maxOutputTokens when includeMaxTokens is false", async () => {
			const o3Handler = new OpenAiHandler({
				...o3Options,
				includeMaxTokens: false,
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = o3Handler.createMessage("You are a helpful assistant.", [])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBeUndefined()
		})

		it("should handle tool calls with O3 model", async () => {
			const o3Handler = new OpenAiHandler(o3Options)

			mockStreamTextReturn([
				{ type: "tool-input-start", id: "call_1", toolName: "test_tool" },
				{ type: "tool-input-delta", id: "call_1", delta: "{}" },
				{ type: "tool-input-end", id: "call_1" },
			])

			const stream = o3Handler.createMessage("system", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolCallStart = chunks.filter((c) => c.type === "tool_call_start")
			expect(toolCallStart).toHaveLength(1)
			expect(toolCallStart[0].name).toBe("test_tool")
		})

		it("should detect o1 models as O3 family", async () => {
			const o1Handler = new OpenAiHandler({
				...mockOptions,
				openAiModelId: "o1-preview",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = o1Handler.createMessage("system", [])
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.systemMessageMode).toBe("developer")
		})

		it("should detect o4 models as O3 family", async () => {
			const o4Handler = new OpenAiHandler({
				...mockOptions,
				openAiModelId: "o4-mini",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = o4Handler.createMessage("system", [])
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.systemMessageMode).toBe("developer")
		})

		it("should handle O3 model with Azure AI Inference Service", async () => {
			const o3AzureHandler = new OpenAiHandler({
				...o3Options,
				openAiBaseUrl: "https://test.services.ai.azure.com",
				includeMaxTokens: false,
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = o3AzureHandler.createMessage("You are a helpful assistant.", [])
			for await (const _chunk of stream) {
				// consume stream
			}

			// Verify Azure AI Inference baseURL with /models
			expect(mockCreateOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://test.services.ai.azure.com/models",
				}),
			)

			// Verify O3 family settings
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.systemMessageMode).toBe("developer")
			expect(callArgs.temperature).toBeUndefined()
			expect(callArgs.maxOutputTokens).toBeUndefined()
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly process usage metrics", () => {
			class TestOpenAiHandler extends OpenAiHandler {
				public testProcessUsageMetrics(usage: any, providerMetadata?: any) {
					return this.processUsageMetrics(usage, providerMetadata)
				}
			}

			const testHandler = new TestOpenAiHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
		})

		it("should handle cache metrics from usage.details", () => {
			class TestOpenAiHandler extends OpenAiHandler {
				public testProcessUsageMetrics(usage: any, providerMetadata?: any) {
					return this.processUsageMetrics(usage, providerMetadata)
				}
			}

			const testHandler = new TestOpenAiHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: {
					cachedInputTokens: 25,
					reasoningTokens: 30,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.cacheReadTokens).toBe(25)
		})

		it("should handle cache metrics from providerMetadata", () => {
			class TestOpenAiHandler extends OpenAiHandler {
				public testProcessUsageMetrics(usage: any, providerMetadata?: any) {
					return this.processUsageMetrics(usage, providerMetadata)
				}
			}

			const testHandler = new TestOpenAiHandler(mockOptions)

			const usage = { inputTokens: 100, outputTokens: 50 }
			const providerMetadata = {
				openai: {
					cacheCreationInputTokens: 80,
					cachedInputTokens: 20,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage, providerMetadata)

			expect(result.cacheWriteTokens).toBe(80)
			expect(result.cacheReadTokens).toBe(20)
		})

		it("should handle missing cache metrics gracefully", () => {
			class TestOpenAiHandler extends OpenAiHandler {
				public testProcessUsageMetrics(usage: any, providerMetadata?: any) {
					return this.processUsageMetrics(usage, providerMetadata)
				}
			}

			const testHandler = new TestOpenAiHandler(mockOptions)

			const usage = { inputTokens: 100, outputTokens: 50 }
			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})
	})

	describe("provider creation", () => {
		it("should pass custom headers to createOpenAI", async () => {
			const handlerWithHeaders = new OpenAiHandler({
				...mockOptions,
				openAiHeaders: { "X-Custom": "value" },
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handlerWithHeaders.createMessage("system", [{ role: "user", content: "Hello!" }])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockCreateOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Custom": "value",
					}),
				}),
			)
		})

		it("should use default baseURL when none provided", async () => {
			const handlerNoUrl = new OpenAiHandler({
				...mockOptions,
				openAiBaseUrl: undefined,
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handlerNoUrl.createMessage("system", [{ role: "user", content: "Hello!" }])
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockCreateOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.openai.com/v1",
				}),
			)
		})

		it("should use provider.chat() to create model", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage("system", [{ role: "user", content: "Hello!" }])
			for await (const _chunk of stream) {
				// consume stream
			}

			// Verify the mock provider's chat method was called
			const mockProviderInstance = mockCreateOpenAI.mock.results[0]?.value
			expect(mockProviderInstance?.chat).toHaveBeenCalled()
		})
	})
})

describe("getOpenAiModels", () => {
	beforeEach(() => {
		vi.mocked(axios.get).mockClear()
	})

	it("should return empty array when baseUrl is not provided", async () => {
		const result = await getOpenAiModels(undefined, "test-key")
		expect(result).toEqual([])
		expect(axios.get).not.toHaveBeenCalled()
	})

	it("should return empty array when baseUrl is empty string", async () => {
		const result = await getOpenAiModels("", "test-key")
		expect(result).toEqual([])
		expect(axios.get).not.toHaveBeenCalled()
	})

	it("should trim whitespace from baseUrl", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "gpt-4" }, { id: "gpt-3.5-turbo" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		const result = await getOpenAiModels("  https://api.openai.com/v1  ", "test-key")

		expect(axios.get).toHaveBeenCalledWith("https://api.openai.com/v1/models", expect.any(Object))
		expect(result).toEqual(["gpt-4", "gpt-3.5-turbo"])
	})

	it("should handle baseUrl with trailing spaces", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "model-1" }, { id: "model-2" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		const result = await getOpenAiModels("https://api.example.com/v1 ", "test-key")

		expect(axios.get).toHaveBeenCalledWith("https://api.example.com/v1/models", expect.any(Object))
		expect(result).toEqual(["model-1", "model-2"])
	})

	it("should handle baseUrl with leading spaces", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "model-1" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		const result = await getOpenAiModels(" https://api.example.com/v1", "test-key")

		expect(axios.get).toHaveBeenCalledWith("https://api.example.com/v1/models", expect.any(Object))
		expect(result).toEqual(["model-1"])
	})

	it("should return empty array for invalid URL after trimming", async () => {
		const result = await getOpenAiModels("   not-a-valid-url   ", "test-key")
		expect(result).toEqual([])
		expect(axios.get).not.toHaveBeenCalled()
	})

	it("should include authorization header when apiKey is provided", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "model-1" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		await getOpenAiModels("https://api.example.com/v1", "test-api-key")

		expect(axios.get).toHaveBeenCalledWith(
			"https://api.example.com/v1/models",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer test-api-key",
				}),
			}),
		)
	})

	it("should include custom headers when provided", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "model-1" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		const customHeaders = {
			"X-Custom-Header": "custom-value",
		}

		await getOpenAiModels("https://api.example.com/v1", "test-key", customHeaders)

		expect(axios.get).toHaveBeenCalledWith(
			"https://api.example.com/v1/models",
			expect.objectContaining({
				headers: expect.objectContaining({
					"X-Custom-Header": "custom-value",
					Authorization: "Bearer test-key",
				}),
			}),
		)
	})

	it("should handle API errors gracefully", async () => {
		vi.mocked(axios.get).mockRejectedValueOnce(new Error("Network error"))

		const result = await getOpenAiModels("https://api.example.com/v1", "test-key")

		expect(result).toEqual([])
	})

	it("should handle malformed response data", async () => {
		vi.mocked(axios.get).mockResolvedValueOnce({ data: null })

		const result = await getOpenAiModels("https://api.example.com/v1", "test-key")

		expect(result).toEqual([])
	})

	it("should deduplicate model IDs", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "gpt-4" }, { id: "gpt-4" }, { id: "gpt-3.5-turbo" }, { id: "gpt-4" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		const result = await getOpenAiModels("https://api.example.com/v1", "test-key")

		expect(result).toEqual(["gpt-4", "gpt-3.5-turbo"])
	})
})
