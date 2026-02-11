// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText, mockCreateAzure } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateAzure: vi.fn(() => {
		// Return a provider function that supports Responses API model creation
		const mockProvider = vi.fn(() => ({
			modelId: "gpt-4o",
			provider: "azure",
		}))
		;(mockProvider as any).responses = vi.fn(() => ({
			modelId: "gpt-4o",
			provider: "azure.responses",
		}))
		return mockProvider
	}),
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
	createAzure: mockCreateAzure,
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import type { ApiHandlerOptions } from "../../../shared/api"

import { AzureHandler } from "../azure"

describe("AzureHandler", () => {
	let handler: AzureHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		vi.clearAllMocks()
		mockOptions = {
			azureApiKey: "test-api-key",
			azureResourceName: "test-resource",
			azureDeploymentName: "gpt-4o",
			azureApiVersion: "2024-08-01-preview",
		}
		handler = new AzureHandler(mockOptions)
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

		it("should omit API version if not provided", () => {
			const handlerWithoutVersion = new AzureHandler({
				...mockOptions,
				azureApiVersion: undefined,
			})
			expect(handlerWithoutVersion).toBeInstanceOf(AzureHandler)
			expect(mockCreateAzure).toHaveBeenLastCalledWith(
				expect.not.objectContaining({ apiVersion: expect.anything() }),
			)
		})

		it("should normalize query-style API version input", () => {
			new AzureHandler({
				...mockOptions,
				azureApiVersion: " ?api-version=2024-10-21&foo=bar ",
			})

			expect(mockCreateAzure).toHaveBeenLastCalledWith(
				expect.objectContaining({
					apiVersion: "2024-10-21",
				}),
			)
		})

		it("should omit API version when configured value is blank", () => {
			new AzureHandler({
				...mockOptions,
				azureApiVersion: "   ",
			})

			expect(mockCreateAzure).toHaveBeenLastCalledWith(
				expect.not.objectContaining({ apiVersion: expect.anything() }),
			)
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

		it("should use the Responses API language model", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// exhaust stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const requestOptions = mockStreamText.mock.calls[0][0]
			expect((requestOptions.model as any).provider).toBe("azure.responses")
		})

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
			expect(usageChunks[0].cacheWriteTokens).toBeUndefined()
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
			}).rejects.toThrow("Azure AI Foundry")
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
})
