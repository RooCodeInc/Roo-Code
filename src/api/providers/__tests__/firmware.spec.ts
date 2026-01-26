// Mocks must come first, before imports
const mockCreate = vi.fn()
const mockWithResponse = vi.fn()
const mockFetch = vi.fn()

vi.mock("openai", () => {
	const mockConstructor = vi.fn()

	return {
		__esModule: true,
		default: mockConstructor.mockImplementation((config: { apiKey?: string; baseURL?: string }) => ({
			apiKey: config?.apiKey,
			baseURL: config?.baseURL,
			chat: {
				completions: {
					create: mockCreate.mockImplementation(() => ({
						withResponse: mockWithResponse,
					})),
				},
			},
		})),
	}
})

vi.mock("../fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({
		"claude-sonnet-4-5": {
			maxTokens: 8192,
			contextWindow: 200000,
			supportsImages: true,
			supportsPromptCache: true,
			inputPrice: 3.0,
			outputPrice: 15.0,
		},
		"gpt-4o": {
			maxTokens: 4096,
			contextWindow: 128000,
			supportsImages: true,
			supportsPromptCache: false,
			inputPrice: 2.5,
			outputPrice: 10.0,
		},
	}),
}))

import OpenAI from "openai"
import type { Anthropic } from "@anthropic-ai/sdk"

import type { ApiHandlerOptions } from "../../../shared/api"
import { FirmwareHandler } from "../firmware"
import { getModels } from "../fetchers/modelCache"

describe("FirmwareHandler", () => {
	let handler: FirmwareHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			firmwareApiKey: "test-api-key",
			firmwareModelId: "claude-sonnet-4-5",
		}
		handler = new FirmwareHandler(mockOptions)
		vi.clearAllMocks()
		mockCreate.mockClear()
		mockWithResponse.mockClear()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(FirmwareHandler)
			expect(handler.getModel().id).toBe(mockOptions.firmwareModelId)
		})

	it("should use default model ID if not provided", () => {
		const handlerWithoutModel = new FirmwareHandler({
			...mockOptions,
			firmwareModelId: undefined,
		})
		expect(handlerWithoutModel.getModel().id).toBe("anthropic/claude-sonnet-4-5-20250929")
	})

		it("should initialize OpenAI client with correct base URL", () => {
			vi.clearAllMocks()
			new FirmwareHandler(mockOptions)
			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://app.firmware.ai/api/v1",
					apiKey: "test-api-key",
				}),
			)
		})

		it("should use placeholder API key when not provided", () => {
			vi.clearAllMocks()
			new FirmwareHandler({})
			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "not-provided",
				}),
			)
		})
	})

	describe("getModel", () => {
		it("should return model info for valid model ID", () => {
			const model = handler.getModel()
			expect(model.id).toBe("claude-sonnet-4-5")
			expect(model.info).toBeDefined()
		})

		it("should return default model info if model not in list", () => {
			const handlerWithUnknownModel = new FirmwareHandler({
				...mockOptions,
				firmwareModelId: "unknown-model",
			})
			const model = handlerWithUnknownModel.getModel()
			expect(model.id).toBe("unknown-model")
			expect(model.info).toBeDefined()
			expect(model.info.contextWindow).toBe(128000)
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})
	})

	describe("fetchModel", () => {
		it("should fetch models from the API", async () => {
			await handler.fetchModel()
			expect(getModels).toHaveBeenCalledWith({
				provider: "firmware",
				apiKey: "test-api-key",
				baseUrl: "https://app.firmware.ai/api/v1",
			})
		})

		it("should return model info after fetching", async () => {
			const model = await handler.fetchModel()
			expect(model.id).toBe("claude-sonnet-4-5")
			expect(model.info).toBeDefined()
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

		beforeEach(() => {
			mockWithResponse.mockResolvedValue({
				data: {
					[Symbol.asyncIterator]: () => ({
						next: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [{ delta: { content: "Test " }, index: 0 }],
									usage: null,
								},
							})
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [{ delta: { content: "response" }, index: 0 }],
									usage: null,
								},
							})
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [{ delta: {}, index: 0, finish_reason: "stop" }],
									usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
								},
							})
							.mockResolvedValueOnce({ done: true }),
					}),
				},
			})
		})

		it("should handle streaming responses", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks.length).toBe(2)
			expect(textChunks[0].text).toBe("Test ")
			expect(textChunks[1].text).toBe("response")
		})

		it("should include usage information", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(5)
		})

		it("should call API with correct parameters", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// Consume the stream
			}

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "claude-sonnet-4-5",
					stream: true,
					stream_options: { include_usage: true },
					messages: expect.arrayContaining([{ role: "system", content: systemPrompt }]),
				}),
			)
		})

		it("should pass tools to the API when provided", async () => {
			const tools: any[] = [
				{
					type: "function",
					function: {
						name: "get_weather",
						description: "Get weather",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const stream = handler.createMessage(systemPrompt, messages, { taskId: "test", tools })
			for await (const _chunk of stream) {
				// Consume the stream
			}

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.arrayContaining([
						expect.objectContaining({
							function: expect.objectContaining({
								name: "get_weather",
							}),
						}),
					]),
				}),
			)
		})
	})

	describe("completePrompt", () => {
		beforeEach(() => {
			mockCreate.mockImplementation(() => ({
				id: "test-completion",
				choices: [
					{
						message: { role: "assistant", content: "Test response", refusal: null },
						finish_reason: "stop",
						index: 0,
					},
				],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				withResponse: mockWithResponse,
			}))
		})

		it("should return completion text", async () => {
			const result = await handler.completePrompt("Tell me a joke")
			expect(result).toBe("Test response")
		})

		it("should call API with correct parameters", async () => {
			await handler.completePrompt("Tell me a joke")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "claude-sonnet-4-5",
					messages: [{ role: "user", content: "Tell me a joke" }],
				}),
			)
		})

		it("should not include stream parameter", async () => {
			await handler.completePrompt("Tell me a joke")

			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.stream).toBeUndefined()
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly process usage metrics", () => {
			class TestFirmwareHandler extends FirmwareHandler {
				public testProcessUsageMetrics(usage: any, modelInfo?: any) {
					return this.processUsageMetrics(usage, modelInfo)
				}
			}

			const testHandler = new TestFirmwareHandler(mockOptions)

			const usage = {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
		})

		it("should handle cache metrics when present", () => {
			class TestFirmwareHandler extends FirmwareHandler {
				public testProcessUsageMetrics(usage: any, modelInfo?: any) {
					return this.processUsageMetrics(usage, modelInfo)
				}
			}

			const testHandler = new TestFirmwareHandler(mockOptions)

			const usage = {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
				prompt_tokens_details: {
					cache_write_tokens: 80,
					cached_tokens: 20,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.cacheWriteTokens).toBe(80)
			expect(result.cacheReadTokens).toBe(20)
		})

		it("should handle missing cache metrics gracefully", () => {
			class TestFirmwareHandler extends FirmwareHandler {
				public testProcessUsageMetrics(usage: any, modelInfo?: any) {
					return this.processUsageMetrics(usage, modelInfo)
				}
			}

			const testHandler = new TestFirmwareHandler(mockOptions)

			const usage = {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})
	})
})

describe("Firmware fetchers", () => {
	const originalFetch = global.fetch

	beforeEach(() => {
		global.fetch = mockFetch
		vi.clearAllMocks()
	})

	afterEach(() => {
		global.fetch = originalFetch
	})

	describe("getFirmwareModels", () => {
		let getFirmwareModels: typeof import("../fetchers/firmware").getFirmwareModels

		beforeEach(async () => {
			vi.resetModules()
			const module = await import("../fetchers/firmware")
			getFirmwareModels = module.getFirmwareModels
		})

		it("should fetch and parse models correctly", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [
						{
							id: "claude-sonnet-4-5",
							max_tokens: 8192,
							context_window: 200000,
							supports_vision: true,
							supports_prompt_cache: true,
							pricing: { input: 3.0, output: 15.0 },
						},
						{
							id: "gpt-4o",
							max_tokens: 4096,
							context_window: 128000,
							supports_vision: true,
						},
					],
				}),
			})

			const models = await getFirmwareModels("test-key")

			expect(mockFetch).toHaveBeenCalledWith(
				"https://app.firmware.ai/api/v1/models",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-key",
					}),
				}),
			)

			expect(models["claude-sonnet-4-5"]).toBeDefined()
			expect(models["claude-sonnet-4-5"].maxTokens).toBe(8192)
			expect(models["claude-sonnet-4-5"].contextWindow).toBe(200000)
			expect(models["claude-sonnet-4-5"].supportsImages).toBe(true)
		})

		it("should throw error on HTTP failure", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				text: async () => "Invalid API key",
			})

			await expect(getFirmwareModels("invalid-key")).rejects.toThrow("HTTP 401")
		})

		it("should throw error on unexpected response format", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ unexpected: "format" }),
			})

			await expect(getFirmwareModels("test-key")).rejects.toThrow("Unexpected response format")
		})

		it("should handle timeout", async () => {
			mockFetch.mockImplementationOnce(
				() =>
					new Promise((_, reject) => {
						const error = new Error("Aborted")
						error.name = "AbortError"
						setTimeout(() => reject(error), 100)
					}),
			)

			await expect(getFirmwareModels("test-key")).rejects.toThrow("timed out")
		})
	})

	describe("getFirmwareQuota", () => {
		let getFirmwareQuota: typeof import("../fetchers/firmware").getFirmwareQuota

		beforeEach(async () => {
			vi.resetModules()
			const module = await import("../fetchers/firmware")
			getFirmwareQuota = module.getFirmwareQuota
		})

		it("should fetch and parse quota correctly", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					used: 0.5217,
					reset: "2026-01-25T11:02:14.242Z",
				}),
			})

			const quota = await getFirmwareQuota("test-key")

			expect(mockFetch).toHaveBeenCalledWith(
				"https://app.firmware.ai/api/v1/quota",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-key",
					}),
				}),
			)

			expect(quota.used).toBe(0.5217)
			expect(quota.reset).toBe("2026-01-25T11:02:14.242Z")
		})

		it("should handle missing fields with defaults", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			})

			const quota = await getFirmwareQuota("test-key")

			expect(quota.used).toBe(0)
			expect(quota.reset).toBeDefined()
		})

		it("should throw error on HTTP failure", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 403,
				statusText: "Forbidden",
			})

			await expect(getFirmwareQuota("test-key")).rejects.toThrow("HTTP 403")
		})
	})
})
