import { describe, it, expect, vi, beforeEach } from "vitest"
import { OpenAiHandler } from "../openai"
import { BaseOpenAiCompatibleProvider } from "../base-openai-compatible-provider"

describe("GLM Empty Stream Handling", () => {
	describe("OpenAiHandler", () => {
		it("should provide fallback response for GLM models with empty streams", async () => {
			const mockClient = {
				chat: {
					completions: {
						create: vi.fn().mockImplementation(async function* () {
							// Simulate empty stream - only usage, no content
							yield {
								choices: [{ delta: {} }],
								usage: {
									prompt_tokens: 100,
									completion_tokens: 0,
								},
							}
						}),
					},
				},
			}

			const handler = new OpenAiHandler({
				openAiApiKey: "test-key",
				openAiModelId: "glm-4.6",
				openAiStreamingEnabled: true,
			})

			// Replace the client with our mock
			;(handler as any).client = mockClient

			const chunks = []
			const stream = handler.createMessage("You are a helpful assistant", [{ role: "user", content: "Hello" }])

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have a fallback text response
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toContain("trouble generating a response")

			// Should still have usage metrics
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
		})

		it("should not provide fallback for non-GLM models with empty streams", async () => {
			const mockClient = {
				chat: {
					completions: {
						create: vi.fn().mockImplementation(async function* () {
							// Simulate empty stream - only usage, no content
							yield {
								choices: [{ delta: {} }],
								usage: {
									prompt_tokens: 100,
									completion_tokens: 0,
								},
							}
						}),
					},
				},
			}

			const handler = new OpenAiHandler({
				openAiApiKey: "test-key",
				openAiModelId: "gpt-4",
				openAiStreamingEnabled: true,
			})

			// Replace the client with our mock
			;(handler as any).client = mockClient

			const chunks = []
			const stream = handler.createMessage("You are a helpful assistant", [{ role: "user", content: "Hello" }])

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should NOT have a fallback text response for non-GLM models
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(0)

			// Should still have usage metrics
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
		})
	})

	describe("BaseOpenAiCompatibleProvider", () => {
		class TestProvider extends BaseOpenAiCompatibleProvider<"glm-4.6" | "other-model"> {
			constructor(modelId: "glm-4.6" | "other-model") {
				super({
					providerName: "Test",
					baseURL: "https://test.com",
					apiKey: "test-key",
					defaultProviderModelId: modelId,
					providerModels: {
						"glm-4.6": {
							maxTokens: 4096,
							contextWindow: 8192,
							supportsPromptCache: false,
							inputPrice: 0,
							outputPrice: 0,
						},
						"other-model": {
							maxTokens: 4096,
							contextWindow: 8192,
							supportsPromptCache: false,
							inputPrice: 0,
							outputPrice: 0,
						},
					},
					apiModelId: modelId,
				})
			}
		}

		it("should provide fallback response for GLM models with empty streams", async () => {
			const provider = new TestProvider("glm-4.6")

			// Mock the client
			const mockClient = {
				chat: {
					completions: {
						create: vi.fn().mockImplementation(async function* () {
							// Simulate empty stream
							yield {
								choices: [{ delta: {} }],
								usage: {
									prompt_tokens: 100,
									completion_tokens: 0,
								},
							}
						}),
					},
				},
			}
			;(provider as any).client = mockClient

			const chunks = []
			const stream = provider.createMessage("You are a helpful assistant", [{ role: "user", content: "Hello" }])

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have a fallback text response
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toContain("trouble generating a response")
		})

		it("should not provide fallback for non-GLM models", async () => {
			const provider = new TestProvider("other-model")

			// Mock the client
			const mockClient = {
				chat: {
					completions: {
						create: vi.fn().mockImplementation(async function* () {
							// Simulate empty stream
							yield {
								choices: [{ delta: {} }],
								usage: {
									prompt_tokens: 100,
									completion_tokens: 0,
								},
							}
						}),
					},
				},
			}
			;(provider as any).client = mockClient

			const chunks = []
			const stream = provider.createMessage("You are a helpful assistant", [{ role: "user", content: "Hello" }])

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should NOT have a fallback text response
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(0)
		})
	})
})
