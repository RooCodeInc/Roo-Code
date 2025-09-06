// npx vitest run api/providers/__tests__/cometapi.spec.ts

import { CometAPIHandler } from "../cometapi"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock the timeout config utility
vitest.mock("../utils/timeout-config", () => ({
	getApiRequestTimeout: vitest.fn(),
}))

import { getApiRequestTimeout } from "../utils/timeout-config"

// Mock the model cache
vitest.mock("../fetchers/modelCache", () => ({
	getModels: vitest.fn(),
}))

import { getModels } from "../fetchers/modelCache"

// Mock OpenAI
const mockOpenAIConstructor = vitest.fn()
const mockCreateCompletion = vitest.fn()
const mockCreateStream = vitest.fn()

vitest.mock("openai", () => {
	return {
		__esModule: true,
		default: vitest.fn().mockImplementation((config) => {
			mockOpenAIConstructor(config)
			return {
				chat: {
					completions: {
						create: vitest.fn().mockImplementation((options) => {
							if (options.stream) {
								return {
									withResponse: () => ({
										data: mockCreateStream(options),
									}),
								}
							}
							return mockCreateCompletion(options)
						}),
					},
				},
			}
		}),
	}
})

describe("CometAPIHandler", () => {
	beforeEach(() => {
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with default configuration", () => {
			;(getApiRequestTimeout as any).mockReturnValue(600000)

			const options: ApiHandlerOptions = {
				apiModelId: "gpt-5-turbo",
				cometApiModelId: "gpt-5-turbo",
				cometApiApiKey: "test-key",
			}

			new CometAPIHandler(options)

			expect(getApiRequestTimeout).toHaveBeenCalled()
			expect(mockOpenAIConstructor).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.cometapi.com/v1",
					apiKey: "test-key",
					timeout: 600000,
					defaultHeaders: expect.objectContaining({
						"X-CometAPI-Source": "roo-code",
						"X-CometAPI-Version": "2025-09-05",
					}),
				}),
			)
		})

		it("should use custom base URL when provided", () => {
			;(getApiRequestTimeout as any).mockReturnValue(600000)

			const options: ApiHandlerOptions = {
				apiModelId: "claude-4-opus",
				cometApiModelId: "claude-4-opus",
				cometApiApiKey: "test-key",
				cometApiBaseUrl: "https://custom.cometapi.com/v1",
			}

			new CometAPIHandler(options)

			expect(mockOpenAIConstructor).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://custom.cometapi.com/v1",
					apiKey: "test-key",
				}),
			)
		})

		it("should handle missing API key", () => {
			;(getApiRequestTimeout as any).mockReturnValue(600000)

			const options: ApiHandlerOptions = {
				apiModelId: "gpt-5-turbo",
				cometApiModelId: "gpt-5-turbo",
			}

			new CometAPIHandler(options)

			expect(mockOpenAIConstructor).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "not-provided",
				}),
			)
		})
	})

	describe("fetchModel", () => {
		it("should fetch models from API", async () => {
			const mockModels = {
				"gpt-5-turbo": {
					maxTokens: 128000,
					contextWindow: 128000,
					supportsImages: true,
					supportsPromptCache: true,
					inputPrice: 3.0,
					outputPrice: 15.0,
				},
			}

			;(getModels as any).mockResolvedValue(mockModels)
			;(getApiRequestTimeout as any).mockReturnValue(600000)

			const options: ApiHandlerOptions = {
				apiModelId: "gpt-5-turbo",
				cometApiModelId: "gpt-5-turbo",
				cometApiApiKey: "test-key",
			}

			const handler = new CometAPIHandler(options)
			const model = await handler.fetchModel()

			expect(getModels).toHaveBeenCalledWith({
				provider: "cometapi",
				apiKey: "test-key",
				baseUrl: "https://api.cometapi.com/v1",
			})

			expect(model).toMatchObject({
				id: "gpt-5-turbo",
				info: mockModels["gpt-5-turbo"],
			})
		})

		it("should handle model fetch errors gracefully", async () => {
			;(getModels as any).mockRejectedValue(new Error("Network error"))
			;(getApiRequestTimeout as any).mockReturnValue(600000)

			const options: ApiHandlerOptions = {
				apiModelId: "gpt-5-turbo",
				cometApiModelId: "gpt-5-turbo",
				cometApiApiKey: "test-key",
			}

			const handler = new CometAPIHandler(options)

			// Should not throw, error is handled by getModels which returns fallback models
			await expect(handler.fetchModel()).rejects.toThrow("Network error")
		})
	})

	describe("createMessage", () => {
		it("should create streaming message with proper options", async () => {
			const mockModels = {
				"gpt-5-turbo": {
					maxTokens: 128000,
					contextWindow: 128000,
					supportsImages: true,
					supportsPromptCache: true,
					inputPrice: 3.0,
					outputPrice: 15.0,
				},
			}

			;(getModels as any).mockResolvedValue(mockModels)
			;(getApiRequestTimeout as any).mockReturnValue(600000)

			const mockStream = (async function* () {
				yield {
					choices: [{ delta: { content: "Hello" } }],
				}
				yield {
					choices: [{ delta: { content: " world" } }],
				}
				yield {
					choices: [{ delta: {} }],
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
					},
				}
			})()

			mockCreateStream.mockReturnValue(mockStream)

			const options: ApiHandlerOptions = {
				apiModelId: "gpt-5-turbo",
				cometApiModelId: "gpt-5-turbo",
				cometApiApiKey: "test-key",
				modelTemperature: 0.7,
				includeMaxTokens: true,
				modelMaxTokens: 4096,
			}

			const handler = new CometAPIHandler(options)
			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Hello" }])

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "text", text: "Hello" },
				{ type: "text", text: " world" },
				expect.objectContaining({
					type: "usage",
					inputTokens: 10,
					outputTokens: 5,
				}),
			])

			expect(mockCreateStream).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gpt-5-turbo",
					stream: true,
					stream_options: { include_usage: true },
					temperature: 0.7,
					max_completion_tokens: 4096,
				}),
			)
		})

		it("should handle reasoning content in stream", async () => {
			const mockModels = {
				"o1-preview": {
					maxTokens: 128000,
					contextWindow: 128000,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: 15.0,
					outputPrice: 60.0,
				},
			}

			;(getModels as any).mockResolvedValue(mockModels)
			;(getApiRequestTimeout as any).mockReturnValue(600000)

			const mockStream = (async function* () {
				yield {
					choices: [{ delta: { reasoning_content: "Thinking..." } }],
				}
				yield {
					choices: [{ delta: { content: "Answer" } }],
				}
			})()

			mockCreateStream.mockReturnValue(mockStream)

			const options: ApiHandlerOptions = {
				apiModelId: "o1-preview",
				cometApiModelId: "o1-preview",
				cometApiApiKey: "test-key",
			}

			const handler = new CometAPIHandler(options)
			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Question" }])

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toContainEqual({ type: "reasoning", text: "Thinking..." })
			expect(chunks).toContainEqual({ type: "text", text: "Answer" })
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt with non-streaming request", async () => {
			const mockModels = {
				"gpt-5-turbo": {
					maxTokens: 128000,
					contextWindow: 128000,
					supportsImages: true,
					supportsPromptCache: true,
					inputPrice: 3.0,
					outputPrice: 15.0,
				},
			}

			;(getModels as any).mockResolvedValue(mockModels)
			;(getApiRequestTimeout as any).mockReturnValue(600000)

			mockCreateCompletion.mockResolvedValue({
				choices: [{ message: { content: "Response text" } }],
			})

			const options: ApiHandlerOptions = {
				apiModelId: "gpt-5-turbo",
				cometApiModelId: "gpt-5-turbo",
				cometApiApiKey: "test-key",
				modelTemperature: 0.5,
			}

			const handler = new CometAPIHandler(options)
			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Response text")
			expect(mockCreateCompletion).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gpt-5-turbo",
					messages: [{ role: "user", content: "Test prompt" }],
					temperature: 0.5,
				}),
			)
		})

		it("should handle empty response", async () => {
			const mockModels = {
				"gpt-5-turbo": {
					maxTokens: 128000,
					contextWindow: 128000,
					supportsImages: true,
					supportsPromptCache: true,
					inputPrice: 3.0,
					outputPrice: 15.0,
				},
			}

			;(getModels as any).mockResolvedValue(mockModels)
			;(getApiRequestTimeout as any).mockReturnValue(600000)

			mockCreateCompletion.mockResolvedValue({
				choices: [],
			})

			const options: ApiHandlerOptions = {
				apiModelId: "gpt-5-turbo",
				cometApiModelId: "gpt-5-turbo",
				cometApiApiKey: "test-key",
			}

			const handler = new CometAPIHandler(options)
			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("")
		})
	})

	describe("timeout configuration", () => {
		it("should use configured timeout value", () => {
			;(getApiRequestTimeout as any).mockReturnValue(1800000) // 30 minutes

			const options: ApiHandlerOptions = {
				apiModelId: "gpt-5-turbo",
				cometApiModelId: "gpt-5-turbo",
				cometApiApiKey: "test-key",
			}

			new CometAPIHandler(options)

			expect(mockOpenAIConstructor).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 1800000,
				}),
			)
		})

		it("should handle zero timeout (no timeout)", () => {
			;(getApiRequestTimeout as any).mockReturnValue(0)

			const options: ApiHandlerOptions = {
				apiModelId: "gpt-5-turbo",
				cometApiModelId: "gpt-5-turbo",
				cometApiApiKey: "test-key",
			}

			new CometAPIHandler(options)

			expect(mockOpenAIConstructor).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 0,
				}),
			)
		})
	})
})
