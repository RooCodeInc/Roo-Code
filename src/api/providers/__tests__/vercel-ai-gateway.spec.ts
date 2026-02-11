// npx vitest run src/api/providers/__tests__/vercel-ai-gateway.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText, mockCreateGateway } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateGateway: vi.fn(),
}))

vi.mock("vscode", () => ({}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
		createGateway: mockCreateGateway,
	}
})

vi.mock("delay", () => ({ default: vi.fn(() => Promise.resolve()) }))

vi.mock("../fetchers/modelCache", () => ({
	getModels: vi.fn().mockImplementation(() => {
		return Promise.resolve({
			"anthropic/claude-sonnet-4": {
				maxTokens: 64000,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: "Claude Sonnet 4",
			},
			"anthropic/claude-3.5-haiku": {
				maxTokens: 32000,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 1,
				outputPrice: 5,
				cacheWritesPrice: 1.25,
				cacheReadsPrice: 0.1,
				description: "Claude 3.5 Haiku",
			},
			"openai/gpt-4o": {
				maxTokens: 16000,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 2.5,
				outputPrice: 10,
				cacheWritesPrice: 3.125,
				cacheReadsPrice: 0.25,
				description: "GPT-4o",
			},
		})
	}),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import { VercelAiGatewayHandler } from "../vercel-ai-gateway"
import type { ApiHandlerOptions } from "../../../shared/api"
import { vercelAiGatewayDefaultModelId, VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE } from "@roo-code/types"

// Set up the createGateway mock to return a function that creates mock language models
const mockGatewayProvider = vi.fn((modelId: string) => ({
	modelId,
	provider: "gateway",
}))

mockCreateGateway.mockReturnValue(mockGatewayProvider)

describe("VercelAiGatewayHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		vercelAiGatewayApiKey: "test-key",
		vercelAiGatewayModelId: "anthropic/claude-sonnet-4",
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockCreateGateway.mockReturnValue(mockGatewayProvider)
	})

	it("initializes with correct options", () => {
		const handler = new VercelAiGatewayHandler(mockOptions)
		expect(handler).toBeInstanceOf(VercelAiGatewayHandler)

		expect(mockCreateGateway).toHaveBeenCalledWith({
			apiKey: mockOptions.vercelAiGatewayApiKey,
			headers: expect.objectContaining({
				"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
				"X-Title": "Roo Code",
				"User-Agent": expect.stringContaining("RooCode/"),
			}),
		})
	})

	it("reports as AI SDK provider", () => {
		const handler = new VercelAiGatewayHandler(mockOptions)
		expect(handler.isAiSdkProvider()).toBe(true)
	})

	describe("fetchModel", () => {
		it("returns correct model info when options are provided", async () => {
			const handler = new VercelAiGatewayHandler(mockOptions)
			const result = await handler.fetchModel()

			expect(result.id).toBe(mockOptions.vercelAiGatewayModelId)
			expect(result.info.maxTokens).toBe(64000)
			expect(result.info.contextWindow).toBe(200000)
			expect(result.info.supportsImages).toBe(true)
			expect(result.info.supportsPromptCache).toBe(true)
		})

		it("returns default model info when options are not provided", async () => {
			const handler = new VercelAiGatewayHandler({})
			const result = await handler.fetchModel()
			expect(result.id).toBe(vercelAiGatewayDefaultModelId)
			expect(result.info.supportsPromptCache).toBe(true)
		})

		it("uses vercel ai gateway default model when no model specified", async () => {
			const handler = new VercelAiGatewayHandler({ vercelAiGatewayApiKey: "test-key" })
			const result = await handler.fetchModel()
			expect(result.id).toBe("anthropic/claude-sonnet-4")
		})
	})

	describe("createMessage", () => {
		function createMockStreamResult(options?: {
			usage?: { inputTokens: number; outputTokens: number; details?: Record<string, unknown> }
			providerMetadata?: Record<string, Record<string, unknown>>
			fullStream?: AsyncGenerator<any>
		}) {
			const defaultUsage = {
				inputTokens: 10,
				outputTokens: 5,
			}

			async function* defaultFullStream() {
				yield { type: "text-delta", text: "Test response" }
			}

			return {
				fullStream: options?.fullStream ?? defaultFullStream(),
				usage: Promise.resolve(options?.usage ?? defaultUsage),
				providerMetadata: Promise.resolve(options?.providerMetadata ?? {}),
			}
		}

		it("streams text content correctly", async () => {
			mockStreamText.mockReturnValue(
				createMockStreamResult({
					usage: { inputTokens: 10, outputTokens: 5 },
					providerMetadata: {
						gateway: {
							cache_creation_input_tokens: 2,
							cached_tokens: 3,
							cost: 0.005,
						},
					},
				}),
			)

			const handler = new VercelAiGatewayHandler(mockOptions)
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(2)
			expect(chunks[0]).toEqual({
				type: "text",
				text: "Test response",
			})
			expect(chunks[1]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheWriteTokens: 2,
				cacheReadTokens: 3,
				totalCost: 0.005,
			})
		})

		it("uses correct temperature from options", async () => {
			const customTemp = 0.5
			mockStreamText.mockReturnValue(createMockStreamResult())

			const handler = new VercelAiGatewayHandler({
				...mockOptions,
				modelTemperature: customTemp,
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			await handler.createMessage(systemPrompt, messages).next()

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: customTemp,
				}),
			)
		})

		it("uses default temperature when none provided", async () => {
			mockStreamText.mockReturnValue(createMockStreamResult())

			const handler = new VercelAiGatewayHandler(mockOptions)

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			await handler.createMessage(systemPrompt, messages).next()

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE,
				}),
			)
		})

		it("sets correct maxOutputTokens", async () => {
			mockStreamText.mockReturnValue(createMockStreamResult())

			const handler = new VercelAiGatewayHandler(mockOptions)

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			await handler.createMessage(systemPrompt, messages).next()

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					maxOutputTokens: 64000,
				}),
			)
		})

		it("handles usage info correctly with all Vercel AI Gateway specific fields", async () => {
			mockStreamText.mockReturnValue(
				createMockStreamResult({
					usage: { inputTokens: 10, outputTokens: 5 },
					providerMetadata: {
						gateway: {
							cache_creation_input_tokens: 2,
							cached_tokens: 3,
							cost: 0.005,
						},
					},
				}),
			)

			const handler = new VercelAiGatewayHandler(mockOptions)
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((chunk) => chunk.type === "usage")
			expect(usageChunk).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheWriteTokens: 2,
				cacheReadTokens: 3,
				totalCost: 0.005,
			})
		})

		describe("native tool calling", () => {
			const testTools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: {
							type: "object",
							properties: {
								arg1: { type: "string" },
							},
							required: ["arg1"],
						},
					},
				},
			]

			it("should include tools when provided", async () => {
				mockStreamText.mockReturnValue(createMockStreamResult())

				const handler = new VercelAiGatewayHandler(mockOptions)

				const messageGenerator = handler.createMessage("test prompt", [], {
					taskId: "test-task-id",
					tools: testTools,
				})
				await messageGenerator.next()

				expect(mockStreamText).toHaveBeenCalledWith(
					expect.objectContaining({
						tools: expect.objectContaining({
							test_tool: expect.any(Object),
						}),
					}),
				)
			})

			it("should include toolChoice when provided", async () => {
				mockStreamText.mockReturnValue(createMockStreamResult())

				const handler = new VercelAiGatewayHandler(mockOptions)

				const messageGenerator = handler.createMessage("test prompt", [], {
					taskId: "test-task-id",
					tools: testTools,
					tool_choice: "auto",
				})
				await messageGenerator.next()

				expect(mockStreamText).toHaveBeenCalledWith(
					expect.objectContaining({
						toolChoice: "auto",
					}),
				)
			})

			it("should yield tool call events when streaming tool calls", async () => {
				async function* toolCallStream() {
					yield {
						type: "tool-input-start",
						id: "call_123",
						toolName: "test_tool",
					}
					yield {
						type: "tool-input-delta",
						id: "call_123",
						delta: '{"arg1":',
					}
					yield {
						type: "tool-input-delta",
						id: "call_123",
						delta: '"value"}',
					}
					yield {
						type: "tool-input-end",
						id: "call_123",
					}
				}

				mockStreamText.mockReturnValue(
					createMockStreamResult({
						fullStream: toolCallStream(),
						usage: { inputTokens: 10, outputTokens: 5 },
					}),
				)

				const handler = new VercelAiGatewayHandler(mockOptions)

				const stream = handler.createMessage("test prompt", [], {
					taskId: "test-task-id",
					tools: testTools,
				})

				const chunks = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}

				const toolStartChunks = chunks.filter((chunk) => chunk.type === "tool_call_start")
				expect(toolStartChunks).toHaveLength(1)
				expect(toolStartChunks[0]).toEqual({
					type: "tool_call_start",
					id: "call_123",
					name: "test_tool",
				})

				const toolDeltaChunks = chunks.filter((chunk) => chunk.type === "tool_call_delta")
				expect(toolDeltaChunks).toHaveLength(2)
				expect(toolDeltaChunks[0]).toEqual({
					type: "tool_call_delta",
					id: "call_123",
					delta: '{"arg1":',
				})
				expect(toolDeltaChunks[1]).toEqual({
					type: "tool_call_delta",
					id: "call_123",
					delta: '"value"}',
				})

				const toolEndChunks = chunks.filter((chunk) => chunk.type === "tool_call_end")
				expect(toolEndChunks).toHaveLength(1)
				expect(toolEndChunks[0]).toEqual({
					type: "tool_call_end",
					id: "call_123",
				})
			})

			it("should pass system prompt to streamText", async () => {
				mockStreamText.mockReturnValue(createMockStreamResult())

				const handler = new VercelAiGatewayHandler(mockOptions)

				const messageGenerator = handler.createMessage("test prompt", [], {
					taskId: "test-task-id",
				})
				await messageGenerator.next()

				expect(mockStreamText).toHaveBeenCalledWith(
					expect.objectContaining({
						system: "test prompt",
					}),
				)
			})
		})
	})

	describe("completePrompt", () => {
		it("completes prompt correctly", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test completion response",
			})

			const handler = new VercelAiGatewayHandler(mockOptions)
			const prompt = "Complete this: Hello"

			const result = await handler.completePrompt(prompt)

			expect(result).toBe("Test completion response")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt,
					temperature: VERCEL_AI_GATEWAY_DEFAULT_TEMPERATURE,
					maxOutputTokens: 64000,
				}),
			)
		})

		it("uses custom temperature for completion", async () => {
			const customTemp = 0.8
			mockGenerateText.mockResolvedValue({
				text: "Test completion response",
			})

			const handler = new VercelAiGatewayHandler({
				...mockOptions,
				modelTemperature: customTemp,
			})

			await handler.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: customTemp,
				}),
			)
		})

		it("handles completion errors correctly", async () => {
			const handler = new VercelAiGatewayHandler(mockOptions)
			const errorMessage = "API error"

			mockGenerateText.mockRejectedValue(new Error(errorMessage))

			await expect(handler.completePrompt("Test")).rejects.toThrow("Vercel AI Gateway")
		})

		it("returns empty string when generateText returns empty text", async () => {
			const handler = new VercelAiGatewayHandler(mockOptions)

			mockGenerateText.mockResolvedValue({
				text: "",
			})

			const result = await handler.completePrompt("Test")
			expect(result).toBe("")
		})
	})

	describe("temperature support", () => {
		it("applies temperature for supported models", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test response",
			})

			const handler = new VercelAiGatewayHandler({
				...mockOptions,
				vercelAiGatewayModelId: "anthropic/claude-sonnet-4",
				modelTemperature: 0.9,
			})

			await handler.completePrompt("Test")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.9,
				}),
			)
		})
	})
})
