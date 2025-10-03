import { describe, it, expect, vi, beforeEach } from "vitest"
import { Anthropic } from "@anthropic-ai/sdk"

import { AnthropicHandler } from "../anthropic"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "@roo-code/types"

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => ({
	Anthropic: vi.fn().mockImplementation(() => ({
		messages: {
			create: vi.fn(),
			countTokens: vi.fn(),
		},
	})),
}))

describe("AnthropicHandler - Custom Models", () => {
	let handler: AnthropicHandler
	let mockClient: any

	beforeEach(() => {
		vi.clearAllMocks()
		mockClient = {
			messages: {
				create: vi.fn().mockResolvedValue({
					content: [{ type: "text", text: "Test response" }],
				}),
				countTokens: vi.fn().mockResolvedValue({ input_tokens: 100 }),
			},
		}
		;(Anthropic as any).mockImplementation(() => mockClient)
	})

	describe("getModel", () => {
		it("should use predefined model when no custom base URL is set", () => {
			handler = new AnthropicHandler({
				apiKey: "test-key",
				apiModelId: "claude-3-opus-20240229",
			} as any)

			const model = handler.getModel()

			expect(model.id).toBe("claude-3-opus-20240229")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(4096) // Predefined model's max tokens
		})

		it("should fallback to default model when invalid model is provided without custom base URL", () => {
			handler = new AnthropicHandler({
				apiKey: "test-key",
				apiModelId: "custom-model-xyz",
			} as any)

			const model = handler.getModel()

			expect(model.id).toBe("claude-sonnet-4-20250514") // Default model
			expect(model.info).toBeDefined()
		})

		it("should allow custom model when custom base URL is set", () => {
			handler = new AnthropicHandler({
				apiKey: "test-key",
				apiModelId: "glm-4.6-cc-max",
				anthropicBaseUrl: "https://api.z.ai/api/anthropic",
			} as any)

			const model = handler.getModel()

			expect(model.id).toBe("glm-4.6-cc-max")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(ANTHROPIC_DEFAULT_MAX_TOKENS) // Default for custom models
			expect(model.info.contextWindow).toBe(200_000) // Default context window
			expect(model.info.supportsImages).toBe(false) // Conservative default
			expect(model.info.supportsPromptCache).toBe(false) // Conservative default
		})

		it("should still use predefined model info when using known model with custom base URL", () => {
			handler = new AnthropicHandler({
				apiKey: "test-key",
				apiModelId: "claude-3-opus-20240229",
				anthropicBaseUrl: "https://api.z.ai/api/anthropic",
			} as any)

			const model = handler.getModel()

			expect(model.id).toBe("claude-3-opus-20240229")
			expect(model.info.maxTokens).toBe(4096) // Should use predefined model's settings
			expect(model.info.supportsImages).toBe(true) // From predefined model
			expect(model.info.supportsPromptCache).toBe(true) // From predefined model
		})

		it("should handle custom models with special characters", () => {
			handler = new AnthropicHandler({
				apiKey: "test-key",
				apiModelId: "glm-4.5v",
				anthropicBaseUrl: "https://api.z.ai/api/anthropic",
			} as any)

			const model = handler.getModel()

			expect(model.id).toBe("glm-4.5v")
			expect(model.info).toBeDefined()
		})

		it("should use auth token when anthropicUseAuthToken is true", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-token",
				apiModelId: "custom-model",
				anthropicBaseUrl: "https://api.z.ai/api/anthropic",
				anthropicUseAuthToken: true,
			} as any)

			// Verify the Anthropic client was created with authToken instead of apiKey
			expect(Anthropic).toHaveBeenCalledWith({
				baseURL: "https://api.z.ai/api/anthropic",
				authToken: "test-token",
			})
		})
	})

	describe("completePrompt with custom models", () => {
		it("should use custom model ID when making API calls", async () => {
			handler = new AnthropicHandler({
				apiKey: "test-key",
				apiModelId: "glm-4.6-cc-max",
				anthropicBaseUrl: "https://api.z.ai/api/anthropic",
			} as any)

			await handler.completePrompt("Test prompt")

			expect(mockClient.messages.create).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "glm-4.6-cc-max",
					messages: [{ role: "user", content: "Test prompt" }],
				}),
			)
		})
	})

	describe("countTokens with custom models", () => {
		it("should use custom model ID for token counting", async () => {
			handler = new AnthropicHandler({
				apiKey: "test-key",
				apiModelId: "glm-4.6-cc-max",
				anthropicBaseUrl: "https://api.z.ai/api/anthropic",
			} as any)

			const content = [{ type: "text" as const, text: "Test content" }]
			await handler.countTokens(content)

			expect(mockClient.messages.countTokens).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "glm-4.6-cc-max",
					messages: [{ role: "user", content }],
				}),
			)
		})
	})
})
