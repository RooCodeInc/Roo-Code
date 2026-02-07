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

vi.mock("@ai-sdk/azure", () => ({
	createAzure: vi.fn(() => {
		// Return a function that returns a mock language model
		return vi.fn(() => ({
			modelId: "gpt-4o",
			provider: "azure",
		}))
	}),
}))

import { createAzure } from "@ai-sdk/azure"
import type { Anthropic } from "@anthropic-ai/sdk"

import { azureDefaultModelInfo, azureModels, type ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { AzureHandler } from "../azure"

describe("AzureHandler", () => {
	let handler: AzureHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			azureApiKey: "test-api-key",
			azureBaseUrl: "https://test-resource.openai.azure.com/openai",
			azureDeploymentName: "gpt-4o",
			azureApiVersion: "2024-08-01-preview",
		}
		handler = new AzureHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(AzureHandler)
			expect(handler.getModel().id).toBe(mockOptions.azureDeploymentName)
		})

		it("should use apiModelId if azureDeploymentName is not provided", () => {
			const handlerWithModelId = new AzureHandler({
				...mockOptions,
				azureDeploymentName: undefined,
				apiModelId: "gpt-35-turbo",
			})
			expect(handlerWithModelId.getModel().id).toBe("gpt-35-turbo")
		})

		it("should use empty string if neither azureDeploymentName nor apiModelId is provided", () => {
			const handlerWithoutModel = new AzureHandler({
				...mockOptions,
				azureDeploymentName: undefined,
				apiModelId: undefined,
			})
			expect(handlerWithoutModel.getModel().id).toBe("")
		})

		it("should use default API version if not provided", () => {
			const handlerWithoutVersion = new AzureHandler({
				...mockOptions,
				azureApiVersion: undefined,
			})
			expect(handlerWithoutVersion).toBeInstanceOf(AzureHandler)
		})
	})

	describe("getModel", () => {
		it("should return model info with deployment name as ID", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.azureDeploymentName)
			expect(model.info).toBeDefined()
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
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
			// Mock the fullStream async generator
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			// Mock usage and providerMetadata promises
			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
			})

			const mockProviderMetadata = Promise.resolve({
				azure: {
					promptCacheHitTokens: 2,
					promptCacheMissTokens: 8,
				},
			})

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

		it("should include usage information", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
			})

			const mockProviderMetadata = Promise.resolve({
				azure: {
					promptCacheHitTokens: 2,
					promptCacheMissTokens: 8,
				},
			})

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
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(5)
		})

		it("should include cache metrics in usage information from providerMetadata", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
			})

			// Azure provides cache metrics via providerMetadata
			const mockProviderMetadata = Promise.resolve({
				azure: {
					promptCacheHitTokens: 2,
					promptCacheMissTokens: 8,
				},
			})

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
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0].cacheWriteTokens).toBe(8) // promptCacheMissTokens
			expect(usageChunks[0].cacheReadTokens).toBe(2) // promptCacheHitTokens
		})

		it("should handle tool calls via tool-input-start/delta/end events", async () => {
			async function* mockFullStream() {
				yield { type: "tool-input-start", id: "tool-1", toolName: "test_tool" }
				yield { type: "tool-input-delta", id: "tool-1", delta: '{"arg":' }
				yield { type: "tool-input-delta", id: "tool-1", delta: '"value"}' }
				yield { type: "tool-input-end", id: "tool-1" }
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

			const toolStartChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
			expect(toolStartChunks).toHaveLength(1)
			expect(toolStartChunks[0].id).toBe("tool-1")
			expect(toolStartChunks[0].name).toBe("test_tool")

			const toolDeltaChunks = chunks.filter((chunk) => chunk.type === "tool_call_delta")
			expect(toolDeltaChunks).toHaveLength(2)

			const toolEndChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")
			expect(toolEndChunks).toHaveLength(1)
		})

		it("should handle errors from AI SDK", async () => {
			const mockError = new Error("API Error")
			;(mockError as any).name = "AI_APICallError"
			;(mockError as any).status = 500

			async function* mockFullStream(): AsyncGenerator<any> {
				yield { type: "text-delta", text: "" }
				throw mockError
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			await expect(async () => {
				const chunks: any[] = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}
			}).rejects.toThrow("Azure OpenAI")
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

		it("should use configured temperature", async () => {
			const handlerWithTemp = new AzureHandler({
				...mockOptions,
				modelTemperature: 0.7,
			})

			mockGenerateText.mockResolvedValue({
				text: "Test completion",
			})

			await handlerWithTemp.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.7,
				}),
			)
		})
	})

	describe("tools", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Use a tool" }],
			},
		]

		it("should pass tools to streamText", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Using tool" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: {
							type: "object",
							properties: {
								arg: { type: "string" },
							},
							required: ["arg"],
						},
					},
				},
			]

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools,
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Object),
				}),
			)
		})
	})

	describe("createAzure constructor args", () => {
		it("should pass correct configuration to createAzure", () => {
			const handler = new AzureHandler({
				azureApiKey: "test-key",
				azureBaseUrl: "https://myresource.openai.azure.com/openai",
				azureApiVersion: "2025-04-01-preview",
				azureDeploymentName: "my-deployment",
				apiModelId: "gpt-4o",
			})
			// Force model creation which triggers provider usage
			handler.getModel()
			expect(createAzure).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://myresource.openai.azure.com/openai",
					apiKey: "test-key",
					apiVersion: "2025-04-01-preview",
					useDeploymentBasedUrls: true,
				}),
			)
		})
	})

	describe("getModel - model lookup", () => {
		it("should use apiModelId for capability lookup when different from deploymentName", () => {
			const handler = new AzureHandler({
				azureDeploymentName: "my-custom-deployment",
				apiModelId: "gpt-4o",
				azureBaseUrl: "https://x.openai.azure.com/openai",
			})
			const model = handler.getModel()
			// Model ID used for API calls should be deployment name
			expect(model.id).toBe("my-custom-deployment")
			// Model info should come from gpt-4o lookup
			expect(model.info.contextWindow).toBe(128_000) // gpt-4o's context window
			expect(model.info.maxTokens).toBe(16_384) // gpt-4o's maxTokens
		})

		it("should fall back to deployment name for capability lookup when apiModelId not in catalog", () => {
			const handler = new AzureHandler({
				azureDeploymentName: "gpt-4o",
				apiModelId: "some-unknown-model",
				azureBaseUrl: "https://x.openai.azure.com/openai",
			})
			const model = handler.getModel()
			// Should fall back to looking up "gpt-4o" (the deployment name) in the catalog
			expect(model.info.contextWindow).toBe(128_000)
			expect(model.info.maxTokens).toBe(16_384)
		})

		it("should fall back to azureDefaultModelInfo when both IDs are unrecognized", () => {
			const handler = new AzureHandler({
				azureDeploymentName: "totally-custom-name",
				apiModelId: "also-not-in-catalog",
				azureBaseUrl: "https://x.openai.azure.com/openai",
			})
			const model = handler.getModel()
			// Should use default model info (gpt-5.2)
			expect(model.info).toBeDefined()
			expect(model.info.contextWindow).toBe(azureDefaultModelInfo.contextWindow)
			expect(model.info.maxTokens).toBe(azureDefaultModelInfo.maxTokens)
		})
	})

	describe("processUsageMetrics", () => {
		class TestAzureHandler extends AzureHandler {
			public testProcessUsageMetrics(usage: any, providerMetadata?: any) {
				return this.processUsageMetrics(usage, providerMetadata)
			}
		}

		it("should correctly process usage metrics including cache information from providerMetadata", () => {
			const testHandler = new TestAzureHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
			}

			// Azure provides cache metrics via providerMetadata
			const providerMetadata = {
				azure: {
					promptCacheHitTokens: 20,
					promptCacheMissTokens: 80,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage, providerMetadata)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(80) // promptCacheMissTokens
			expect(result.cacheReadTokens).toBe(20) // promptCacheHitTokens
		})

		it("should handle usage with details.cachedInputTokens when providerMetadata is not available", () => {
			const testHandler = new TestAzureHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: {
					cachedInputTokens: 25,
					reasoningTokens: 30,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheReadTokens).toBe(25) // from details.cachedInputTokens
			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.reasoningTokens).toBe(30)
		})

		it("should handle missing cache metrics gracefully", () => {
			const testHandler = new TestAzureHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				// No details or providerMetadata
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})
	})

	describe("getMaxOutputTokens", () => {
		class TestAzureHandler extends AzureHandler {
			public testGetMaxOutputTokens() {
				return this.getMaxOutputTokens()
			}
		}

		it("should return modelMaxTokens from options when set and > 0", () => {
			const customMaxTokens = 5000
			const testHandler = new TestAzureHandler({
				...mockOptions,
				modelMaxTokens: customMaxTokens,
			})

			const result = testHandler.testGetMaxOutputTokens()
			expect(result).toBe(customMaxTokens)
		})

		it("should fall back to info.maxTokens when modelMaxTokens not set", () => {
			const testHandler = new TestAzureHandler(mockOptions)
			const result = testHandler.testGetMaxOutputTokens()

			// Default handler uses gpt-4o deployment which has maxTokens of 16_384
			expect(result).toBe((azureModels as Record<string, ModelInfo>)["gpt-4o"].maxTokens)
		})

		it("should fall back to info.maxTokens when modelMaxTokens is 0", () => {
			const testHandler = new TestAzureHandler({
				...mockOptions,
				modelMaxTokens: 0,
			})

			const result = testHandler.testGetMaxOutputTokens()

			// 0 is falsy so || falls through to info.maxTokens (gpt-4o = 16_384)
			expect(result).toBe((azureModels as Record<string, ModelInfo>)["gpt-4o"].maxTokens)
		})
	})

	describe("reasoning events", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Hello!" }],
			},
		]

		it("should handle reasoning content in stream", async () => {
			// Azure models like o3, o4-mini, gpt-5 can emit reasoning events
			async function* mockFullStream() {
				yield { type: "reasoning", text: "Let me think about this..." }
				yield { type: "reasoning", text: " I'll analyze step by step." }
				yield { type: "text-delta", text: "Here is the answer." }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 20,
				outputTokens: 10,
				details: {
					reasoningTokens: 15,
				},
			})

			const mockProviderMetadata = Promise.resolve({
				azure: {
					promptCacheHitTokens: 5,
					promptCacheMissTokens: 15,
				},
			})

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

			// Should have reasoning chunks
			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			expect(reasoningChunks).toHaveLength(2)
			expect(reasoningChunks[0].text).toBe("Let me think about this...")
			expect(reasoningChunks[1].text).toBe(" I'll analyze step by step.")

			// Should also have text chunks
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Here is the answer.")
		})

		it("should include reasoning tokens in usage metrics", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning", text: "Thinking..." }
				yield { type: "text-delta", text: "Answer" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 20,
				outputTokens: 10,
				details: {
					reasoningTokens: 25,
				},
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
			expect(usageChunks[0].reasoningTokens).toBe(25)
			expect(usageChunks[0].inputTokens).toBe(20)
			expect(usageChunks[0].outputTokens).toBe(10)
		})
	})

	describe("tool-call event handling", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Use a tool" }],
			},
		]

		it("should ignore tool-call events to prevent duplicate tools in UI", async () => {
			// tool-call events are intentionally ignored because tool-input-start/delta/end
			// already provide complete tool call information. Emitting tool-call would cause
			// duplicate tools in the UI for AI SDK providers.
			async function* mockFullStream() {
				yield {
					type: "tool-call",
					toolCallId: "tool-call-1",
					toolName: "read_file",
					input: { path: "test.ts" },
				}
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

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools: [
					{
						type: "function" as const,
						function: {
							name: "read_file",
							description: "Read a file",
							parameters: {
								type: "object",
								properties: { path: { type: "string" } },
								required: ["path"],
							},
						},
					},
				],
			})

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// tool-call events are ignored, so no tool_call chunks should be emitted
			const toolCallChunks = chunks.filter((c) => c.type === "tool_call")
			expect(toolCallChunks).toHaveLength(0)

			// Also verify no tool_call_start from tool-call events (only tool-input-start produces these)
			const toolCallStartChunks = chunks.filter((c) => c.type === "tool_call_start")
			expect(toolCallStartChunks).toHaveLength(0)
		})
	})

	describe("completePrompt error handling", () => {
		it("should propagate errors from completePrompt without handleAiSdkError wrapping", async () => {
			// completePrompt does NOT wrap errors with handleAiSdkError unlike createMessage
			const rawError = new Error("API request failed")
			mockGenerateText.mockRejectedValue(rawError)

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("API request failed")
			// Verify it's the same raw error (not wrapped by handleAiSdkError)
			await expect(handler.completePrompt("Test prompt")).rejects.toBe(rawError)
		})
	})

	describe("provider metadata key verification", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text" as const, text: "Hello!" }],
			},
		]

		it("should handle missing azure provider metadata key gracefully", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			const mockUsage = Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
			})

			// providerMetadata uses wrong key ("openai" instead of "azure")
			const mockProviderMetadata = Promise.resolve({
				openai: {
					promptCacheHitTokens: 2,
					promptCacheMissTokens: 8,
				},
			})

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

			// Should not crash — cache tokens should be undefined when azure key is missing
			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(5)
			expect(usageChunks[0].cacheReadTokens).toBeUndefined()
			expect(usageChunks[0].cacheWriteTokens).toBeUndefined()
		})
	})
})
