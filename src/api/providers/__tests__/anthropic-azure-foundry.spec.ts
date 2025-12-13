// npx vitest run src/api/providers/__tests__/anthropic-azure-foundry.spec.ts

import { AnthropicHandler } from "../anthropic"
import { ApiHandlerOptions } from "../../../shared/api"

const mockCreate = vitest.fn()

vitest.mock("@anthropic-ai/sdk", () => {
	const mockAnthropicConstructor = vitest.fn().mockImplementation(() => ({
		messages: {
			create: mockCreate.mockImplementation(async (options) => {
				if (!options.stream) {
					return {
						id: "test-completion",
						content: [{ type: "text", text: "Test response" }],
						role: "assistant",
						model: options.model,
						usage: {
							input_tokens: 10,
							output_tokens: 5,
						},
					}
				}
				return {
					async *[Symbol.asyncIterator]() {
						yield {
							type: "message_start",
							message: {
								usage: {
									input_tokens: 100,
									output_tokens: 50,
								},
							},
						}
						yield {
							type: "content_block_start",
							index: 0,
							content_block: {
								type: "text",
								text: "Hello from Azure",
							},
						}
						yield {
							type: "content_block_delta",
							delta: {
								type: "text_delta",
								text: " Foundry",
							},
						}
					},
				}
			}),
		},
	}))

	return {
		Anthropic: mockAnthropicConstructor,
	}
})

// Import after mock
import { Anthropic } from "@anthropic-ai/sdk"

const mockAnthropicConstructor = vitest.mocked(Anthropic)

describe("AnthropicHandler - Azure Foundry Support", () => {
	let handler: AnthropicHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		vitest.clearAllMocks()
	})

	describe("Azure Foundry mode", () => {
		it("should use deployment name as model ID when Azure Foundry mode is enabled", () => {
			mockOptions = {
				apiKey: "test-api-key",
				apiModelId: "claude-opus-4-5-20251101",
				anthropicBaseUrl: "https://my-resource.services.ai.azure.com/anthropic",
				anthropicUseAzureFoundry: true,
				anthropicAzureDeploymentName: "claude-opus-4-5",
				anthropicUseAuthToken: true,
			}
			handler = new AnthropicHandler(mockOptions)

			const model = handler.getModel()
			expect(model.id).toBe("claude-opus-4-5")
			// Should still have the correct model info for capabilities
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(32000) // Raw model info value
			expect(model.info.contextWindow).toBe(200000)
		})

		it("should use authToken when Azure Foundry mode is enabled with custom base URL", () => {
			mockOptions = {
				apiKey: "test-azure-key",
				apiModelId: "claude-sonnet-4-5",
				anthropicBaseUrl: "https://my-resource.services.ai.azure.com/anthropic",
				anthropicUseAzureFoundry: true,
				anthropicAzureDeploymentName: "my-sonnet-deployment",
				anthropicUseAuthToken: true,
			}
			handler = new AnthropicHandler(mockOptions)

			expect(mockAnthropicConstructor).toHaveBeenCalledWith({
				baseURL: "https://my-resource.services.ai.azure.com/anthropic",
				authToken: "test-azure-key",
			})
		})

		it("should fall back to selected model when no deployment name is provided", () => {
			mockOptions = {
				apiKey: "test-api-key",
				apiModelId: "claude-opus-4-5-20251101",
				anthropicBaseUrl: "https://my-resource.services.ai.azure.com/anthropic",
				anthropicUseAzureFoundry: true,
				// No deployment name provided
				anthropicUseAuthToken: true,
			}
			handler = new AnthropicHandler(mockOptions)

			const model = handler.getModel()
			// Should use the original model ID
			expect(model.id).toBe("claude-opus-4-5-20251101")
		})

		it("should not use deployment name when Azure Foundry mode is disabled", () => {
			mockOptions = {
				apiKey: "test-api-key",
				apiModelId: "claude-opus-4-5-20251101",
				anthropicBaseUrl: "https://my-resource.services.ai.azure.com/anthropic",
				anthropicUseAzureFoundry: false,
				anthropicAzureDeploymentName: "claude-opus-4-5",
				anthropicUseAuthToken: true,
			}
			handler = new AnthropicHandler(mockOptions)

			const model = handler.getModel()
			// Should use the original model ID, not the deployment name
			expect(model.id).toBe("claude-opus-4-5-20251101")
		})

		it("should send correct model name in API requests with Azure Foundry", async () => {
			mockOptions = {
				apiKey: "test-azure-key",
				apiModelId: "claude-opus-4-5-20251101",
				anthropicBaseUrl: "https://my-resource.services.ai.azure.com/anthropic",
				anthropicUseAzureFoundry: true,
				anthropicAzureDeploymentName: "my-custom-deployment",
				anthropicUseAuthToken: true,
			}
			handler = new AnthropicHandler(mockOptions)

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello",
				},
			]

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify the API was called with the deployment name as the model
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.model).toBe("my-custom-deployment")

			// Verify we got the expected response
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Hello from Azure")
			expect(textChunks[1].text).toBe(" Foundry")
		})

		it("should work with different Claude models in Azure Foundry", () => {
			// Test with Claude Sonnet 4.5
			mockOptions = {
				apiKey: "test-api-key",
				apiModelId: "claude-sonnet-4-5",
				anthropicBaseUrl: "https://my-resource.services.ai.azure.com/anthropic",
				anthropicUseAzureFoundry: true,
				anthropicAzureDeploymentName: "sonnet-deployment",
				anthropicUseAuthToken: true,
			}
			handler = new AnthropicHandler(mockOptions)

			let model = handler.getModel()
			expect(model.id).toBe("sonnet-deployment")
			expect(model.info.maxTokens).toBe(64000) // Raw model info value for Sonnet 4.5

			// Test with Claude Haiku 4.5
			mockOptions = {
				apiKey: "test-api-key",
				apiModelId: "claude-haiku-4-5-20251001",
				anthropicBaseUrl: "https://my-resource.services.ai.azure.com/anthropic",
				anthropicUseAzureFoundry: true,
				anthropicAzureDeploymentName: "haiku-deployment",
				anthropicUseAuthToken: true,
			}
			handler = new AnthropicHandler(mockOptions)

			model = handler.getModel()
			expect(model.id).toBe("haiku-deployment")
			expect(model.info.maxTokens).toBe(64000) // Raw model info value for Haiku 4.5
		})

		it("should handle completePrompt with Azure Foundry deployment name", async () => {
			mockOptions = {
				apiKey: "test-azure-key",
				apiModelId: "claude-opus-4-5-20251101",
				anthropicBaseUrl: "https://my-resource.services.ai.azure.com/anthropic",
				anthropicUseAzureFoundry: true,
				anthropicAzureDeploymentName: "my-opus-deployment",
				anthropicUseAuthToken: true,
			}
			handler = new AnthropicHandler(mockOptions)

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Test response")
			expect(mockCreate).toHaveBeenCalledWith({
				model: "my-opus-deployment",
				messages: [{ role: "user", content: "Test prompt" }],
				max_tokens: 8192,
				temperature: 0,
				thinking: undefined,
				stream: false,
			})
		})
	})

	describe("Azure Foundry with 1M context", () => {
		it("should support 1M context beta with Azure Foundry for Claude Sonnet 4.5", () => {
			mockOptions = {
				apiKey: "test-api-key",
				apiModelId: "claude-sonnet-4-5",
				anthropicBaseUrl: "https://my-resource.services.ai.azure.com/anthropic",
				anthropicUseAzureFoundry: true,
				anthropicAzureDeploymentName: "sonnet-1m-deployment",
				anthropicBeta1MContext: true,
				anthropicUseAuthToken: true,
			}
			handler = new AnthropicHandler(mockOptions)

			const model = handler.getModel()
			expect(model.id).toBe("sonnet-1m-deployment")
			// Should have 1M context window
			expect(model.info.contextWindow).toBe(1000000)
			expect(model.info.inputPrice).toBe(6.0)
			expect(model.info.outputPrice).toBe(22.5)
		})
	})
})
