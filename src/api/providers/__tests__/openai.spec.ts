// npx vitest run api/providers/__tests__/openai.spec.ts

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

const mockCreateOpenAI = vi.hoisted(() =>
	vi.fn(() => {
		return {
			chat: vi.fn(() => ({
				modelId: "gpt-4",
				provider: "openai.chat",
			})),
			responses: vi.fn(() => ({
				modelId: "gpt-4",
				provider: "openai.responses",
			})),
		}
	}),
)

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: mockCreateOpenAI,
}))

const mockCreateOpenAICompatible = vi.hoisted(() =>
	vi.fn(() => {
		return vi.fn((modelId: string) => ({
			modelId,
			provider: "openai-compatible",
		}))
	}),
)

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: mockCreateOpenAICompatible,
}))

const mockCreateAzure = vi.hoisted(() =>
	vi.fn(() => {
		return {
			chat: vi.fn((modelId: string) => ({
				modelId,
				provider: "azure.chat",
			})),
		}
	}),
)

vi.mock("@ai-sdk/azure", () => ({
	createAzure: mockCreateAzure,
}))

// Mock axios for getOpenAiModels tests
vi.mock("axios", () => ({
	default: {
		get: vi.fn(),
	},
}))

import { OpenAiHandler, getOpenAiModels } from "../openai"
import { ApiHandlerOptions } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"
import { openAiModelInfoSaneDefaults } from "@roo-code/types"
import axios from "axios"

function createMockStreamResult(options?: {
	textChunks?: string[]
	reasoningChunks?: string[]
	toolCalls?: Array<{ id: string; name: string; delta: string }>
	usage?: { inputTokens: number; outputTokens: number }
}) {
	const {
		textChunks = ["Test response"],
		reasoningChunks = [],
		toolCalls = [],
		usage = { inputTokens: 10, outputTokens: 5 },
	} = options ?? {}

	async function* mockFullStream() {
		for (const text of textChunks) {
			yield { type: "text-delta", text }
		}
		for (const text of reasoningChunks) {
			yield { type: "reasoning-delta", text }
		}
		for (const tc of toolCalls) {
			yield { type: "tool-input-start", id: tc.id, toolName: tc.name }
			yield { type: "tool-input-delta", id: tc.id, delta: tc.delta }
			yield { type: "tool-input-end", id: tc.id }
		}
	}

	return {
		fullStream: mockFullStream(),
		usage: Promise.resolve(usage),
		providerMetadata: Promise.resolve(undefined),
	}
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

		it("should create an OpenAI provider with correct configuration", () => {
			new OpenAiHandler(mockOptions)
			expect(mockCreateOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.openai.com/v1",
					apiKey: "test-api-key",
				}),
			)
		})

		it("should report as AI SDK provider", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
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
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: systemPrompt,
					temperature: 0,
				}),
			)
		})

		it("should handle non-streaming mode", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "Test response",
				toolCalls: [],
				usage: { inputTokens: 10, outputTokens: 5 },
			})

			const handler = new OpenAiHandler({
				...mockOptions,
				openAiStreamingEnabled: false,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunk = chunks.find((chunk) => chunk.type === "text")
			const usageChunk = chunks.find((chunk) => chunk.type === "usage")

			expect(textChunk).toBeDefined()
			expect(textChunk?.text).toBe("Test response")
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.inputTokens).toBe(10)
			expect(usageChunk?.outputTokens).toBe(5)
		})

		it("should handle tool calls in non-streaming mode", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "",
				toolCalls: [
					{
						toolCallId: "call_1",
						toolName: "test_tool",
						args: { arg: "value" },
					},
				],
				usage: { inputTokens: 10, outputTokens: 5 },
			})

			const handler = new OpenAiHandler({
				...mockOptions,
				openAiStreamingEnabled: false,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolCallChunks = chunks.filter((chunk) => chunk.type === "tool_call")
			expect(toolCallChunks).toHaveLength(1)
			expect(toolCallChunks[0]).toEqual({
				type: "tool_call",
				id: "call_1",
				name: "test_tool",
				arguments: '{"arg":"value"}',
			})
		})

		it("should handle tool calls in streaming responses", async () => {
			mockStreamText.mockReturnValueOnce(
				createMockStreamResult({
					textChunks: [],
					toolCalls: [{ id: "call_1", name: "test_tool", delta: '{"arg":"value"}' }],
				}),
			)

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolStartChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
			expect(toolStartChunks).toHaveLength(1)
			expect(toolStartChunks[0]).toEqual({
				type: "tool_call_start",
				id: "call_1",
				name: "test_tool",
			})

			const toolDeltaChunks = chunks.filter((chunk) => chunk.type === "tool_call_delta")
			expect(toolDeltaChunks).toHaveLength(1)

			const toolEndChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")
			expect(toolEndChunks).toHaveLength(1)
		})

		it("should include reasoning_effort when reasoning effort is enabled", async () => {
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

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
			const stream = reasoningHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: expect.objectContaining({
						openai: expect.objectContaining({
							reasoningEffort: "high",
						}),
					}),
				}),
			)
		})

		it("should not include reasoning_effort when reasoning effort is disabled", async () => {
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

			const noReasoningOptions: ApiHandlerOptions = {
				...mockOptions,
				enableReasoningEffort: false,
				openAiCustomModelInfo: { contextWindow: 128_000, supportsPromptCache: false },
			}
			const noReasoningHandler = new OpenAiHandler(noReasoningOptions)
			const stream = noReasoningHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions).toBeUndefined()
		})

		it("should include maxOutputTokens when includeMaxTokens is true", async () => {
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

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
			const stream = handlerWithMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					maxOutputTokens: 4096,
				}),
			)
		})

		it("should not include maxOutputTokens when includeMaxTokens is false", async () => {
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

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
			const stream = handlerWithoutMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBeUndefined()
		})

		it("should not include maxOutputTokens when includeMaxTokens is undefined", async () => {
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

			const optionsWithUndefinedMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithDefaultMaxTokens = new OpenAiHandler(optionsWithUndefinedMaxTokens)
			const stream = handlerWithDefaultMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBeUndefined()
		})

		it("should use user-configured modelMaxTokens instead of model default maxTokens", async () => {
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

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
			const stream = handlerWithUserMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					maxOutputTokens: 32000,
				}),
			)
		})

		it("should fallback to model default maxTokens when user modelMaxTokens is not set", async () => {
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

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
			const stream = handlerWithoutUserMaxTokens.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					maxOutputTokens: 4096,
				}),
			)
		})
	})

	describe("error handling", () => {
		const testMessages: Anthropic.Messages.MessageParam[] = [
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

		it("should handle API errors in streaming", async () => {
			const errorStream = {
				fullStream: {
					[Symbol.asyncIterator]() {
						return {
							next: () => Promise.reject(new Error("API Error")),
						}
					},
				},
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve(undefined),
			}
			mockStreamText.mockReturnValueOnce(errorStream)

			const stream = handler.createMessage("system prompt", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
				}
			}).rejects.toThrow("API Error")
		})

		it("should handle API errors in non-streaming", async () => {
			mockGenerateText.mockRejectedValueOnce(new Error("API Error"))

			const handler = new OpenAiHandler({
				...mockOptions,
				openAiStreamingEnabled: false,
			})

			const stream = handler.createMessage("system prompt", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
				}
			}).rejects.toThrow("API Error")
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "Test response",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
				}),
			)
		})

		it("should handle API errors", async () => {
			mockGenerateText.mockRejectedValueOnce(new Error("API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("OpenAI completion error: API Error")
		})

		it("should handle empty response", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "",
			})
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
	})

	describe("Azure AI Inference Service", () => {
		function makeAzureOptions() {
			return {
				...mockOptions,
				openAiBaseUrl: "https://test.services.ai.azure.com",
				openAiModelId: "deepseek-v3",
				azureApiVersion: "2024-05-01-preview",
			}
		}

		it("should initialize with Azure AI Inference Service configuration", () => {
			const azureOptions = makeAzureOptions()
			const azureHandler = new OpenAiHandler(azureOptions)
			expect(azureHandler).toBeInstanceOf(OpenAiHandler)
			expect(azureHandler.getModel().id).toBe(azureOptions.openAiModelId)
		})

		it("should use createOpenAICompatible for Azure AI Inference", () => {
			new OpenAiHandler(makeAzureOptions())
			expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://test.services.ai.azure.com/models",
					apiKey: "test-api-key",
					queryParams: { "api-version": "2024-05-01-preview" },
				}),
			)
		})

		it("should handle streaming responses with Azure AI Inference Service", async () => {
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

			const azureHandler = new OpenAiHandler(makeAzureOptions())
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = azureHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
		})

		it("should handle non-streaming responses with Azure AI Inference Service", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "Test response",
				toolCalls: [],
				usage: { inputTokens: 10, outputTokens: 5 },
			})

			const azureHandler = new OpenAiHandler({
				...makeAzureOptions(),
				openAiStreamingEnabled: false,
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = azureHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunk = chunks.find((chunk) => chunk.type === "text")
			const usageChunk = chunks.find((chunk) => chunk.type === "usage")

			expect(textChunk).toBeDefined()
			expect(textChunk?.text).toBe("Test response")
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.inputTokens).toBe(10)
			expect(usageChunk?.outputTokens).toBe(5)
		})

		it("should handle completePrompt with Azure AI Inference Service", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "Test response",
			})

			const azureHandler = new OpenAiHandler(makeAzureOptions())
			const result = await azureHandler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
		})
	})

	describe("Azure OpenAI", () => {
		it("should use createAzure for Azure OpenAI", () => {
			new OpenAiHandler({
				...mockOptions,
				openAiBaseUrl: "https://myinstance.openai.azure.com",
				openAiUseAzure: true,
				azureApiVersion: "2024-06-01",
			})
			expect(mockCreateAzure).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://myinstance.openai.azure.com/openai",
					apiKey: "test-api-key",
					apiVersion: "2024-06-01",
					useDeploymentBasedUrls: true,
				}),
			)
		})
	})

	describe("O3 Family Models", () => {
		const o3Options = {
			...mockOptions,
			openAiModelId: "o3-mini",
			openAiCustomModelInfo: {
				contextWindow: 128_000,
				maxTokens: 65536,
				supportsPromptCache: false,
				reasoningEffort: "medium" as "low" | "medium" | "high",
			},
		}

		it("should handle O3 model with streaming and developer role", async () => {
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

			const o3Handler = new OpenAiHandler({
				...o3Options,
				includeMaxTokens: true,
				modelMaxTokens: 32000,
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = o3Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: "Formatting re-enabled\nYou are a helpful assistant.",
					temperature: undefined,
					maxOutputTokens: 32000,
					providerOptions: expect.objectContaining({
						openai: expect.objectContaining({
							systemMessageMode: "developer",
							reasoningEffort: "medium",
						}),
					}),
				}),
			)
		})

		it("should handle O3 model with streaming and exclude maxOutputTokens when includeMaxTokens is false", async () => {
			mockStreamText.mockReturnValueOnce(createMockStreamResult())

			const o3Handler = new OpenAiHandler({
				...o3Options,
				includeMaxTokens: false,
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = o3Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.maxOutputTokens).toBeUndefined()
		})

		it("should handle O3 model non-streaming with reasoning_effort and maxOutputTokens", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "Test response",
				toolCalls: [],
				usage: { inputTokens: 10, outputTokens: 5 },
			})

			const o3Handler = new OpenAiHandler({
				...o3Options,
				openAiStreamingEnabled: false,
				includeMaxTokens: true,
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = o3Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: "Formatting re-enabled\nYou are a helpful assistant.",
					temperature: undefined,
					maxOutputTokens: 65536,
					providerOptions: expect.objectContaining({
						openai: expect.objectContaining({
							systemMessageMode: "developer",
							reasoningEffort: "medium",
						}),
					}),
				}),
			)
		})

		it("should handle tool calls with O3 model in streaming mode", async () => {
			mockStreamText.mockReturnValueOnce(
				createMockStreamResult({
					textChunks: [],
					toolCalls: [{ id: "call_1", name: "test_tool", delta: "{}" }],
				}),
			)

			const o3Handler = new OpenAiHandler(o3Options)

			const stream = o3Handler.createMessage("system", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolStartChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
			expect(toolStartChunks).toHaveLength(1)
			expect(toolStartChunks[0]).toEqual({
				type: "tool_call_start",
				id: "call_1",
				name: "test_tool",
			})
		})

		it("should handle tool calls with O3 model in non-streaming mode", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "",
				toolCalls: [
					{
						toolCallId: "call_1",
						toolName: "test_tool",
						args: {},
					},
				],
				usage: { inputTokens: 10, outputTokens: 5 },
			})

			const o3Handler = new OpenAiHandler({
				...o3Options,
				openAiStreamingEnabled: false,
			})

			const stream = o3Handler.createMessage("system", [])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolCallChunks = chunks.filter((chunk) => chunk.type === "tool_call")
			expect(toolCallChunks).toHaveLength(1)
			expect(toolCallChunks[0]).toEqual({
				type: "tool_call",
				id: "call_1",
				name: "test_tool",
				arguments: "{}",
			})
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
