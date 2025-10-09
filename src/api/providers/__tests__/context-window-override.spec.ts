import { describe, it, expect, beforeEach } from "vitest"
import { AnthropicHandler } from "../anthropic"
import { OpenRouterHandler } from "../openrouter"
import { OpenAiHandler } from "../openai"
import { GeminiHandler } from "../gemini"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("Context Window Override", () => {
	describe("AnthropicHandler", () => {
		it("should apply modelContextWindow override", () => {
			const options: ApiHandlerOptions = {
				apiKey: "test-key",
				apiModelId: "claude-3-5-sonnet-20241022",
				modelContextWindow: 50000, // Custom context window
			}

			const handler = new AnthropicHandler(options)
			const model = handler.getModel()

			expect(model.info.contextWindow).toBe(50000)
		})

		it("should use default context window when no override is provided", () => {
			const options: ApiHandlerOptions = {
				apiKey: "test-key",
				apiModelId: "claude-3-5-sonnet-20241022",
			}

			const handler = new AnthropicHandler(options)
			const model = handler.getModel()

			// Should use the default context window for this model
			expect(model.info.contextWindow).toBe(200000)
		})
	})

	describe("OpenRouterHandler", () => {
		it("should apply modelContextWindow override", async () => {
			const options: ApiHandlerOptions = {
				openRouterApiKey: "test-key",
				openRouterModelId: "anthropic/claude-3.5-sonnet",
				modelContextWindow: 75000, // Custom context window
			}

			const handler = new OpenRouterHandler(options)
			// Mock the models to avoid actual API calls
			;(handler as any).models = {
				"anthropic/claude-3.5-sonnet": {
					contextWindow: 200000,
					maxTokens: 8192,
					supportsPromptCache: true,
					supportsImages: true,
				},
			}

			const model = handler.getModel()
			expect(model.info.contextWindow).toBe(75000)
		})
	})

	describe("OpenAiHandler", () => {
		it("should apply modelContextWindow override to custom model info", () => {
			const options: ApiHandlerOptions = {
				openAiApiKey: "test-key",
				openAiModelId: "gpt-4",
				openAiCustomModelInfo: {
					contextWindow: 128000,
					maxTokens: 4096,
					supportsPromptCache: false,
					supportsImages: true,
				},
				modelContextWindow: 60000, // Custom context window
			}

			const handler = new OpenAiHandler(options)
			const model = handler.getModel()

			expect(model.info.contextWindow).toBe(60000)
		})
	})

	describe("GeminiHandler", () => {
		it("should apply modelContextWindow override", () => {
			const options: ApiHandlerOptions = {
				geminiApiKey: "test-key",
				apiModelId: "gemini-1.5-pro-latest",
				modelContextWindow: 100000, // Custom context window
			}

			const handler = new GeminiHandler(options)
			const model = handler.getModel()

			expect(model.info.contextWindow).toBe(100000)
		})
	})

	describe("Edge cases", () => {
		it("should not apply override when modelContextWindow is 0", () => {
			const options: ApiHandlerOptions = {
				apiKey: "test-key",
				apiModelId: "claude-3-5-sonnet-20241022",
				modelContextWindow: 0, // Zero should not override
			}

			const handler = new AnthropicHandler(options)
			const model = handler.getModel()

			// Should use the default context window
			expect(model.info.contextWindow).toBe(200000)
		})

		it("should not apply override when modelContextWindow is negative", () => {
			const options: ApiHandlerOptions = {
				apiKey: "test-key",
				apiModelId: "claude-3-5-sonnet-20241022",
				modelContextWindow: -1000, // Negative should not override
			}

			const handler = new AnthropicHandler(options)
			const model = handler.getModel()

			// Should use the default context window
			expect(model.info.contextWindow).toBe(200000)
		})
	})
})
