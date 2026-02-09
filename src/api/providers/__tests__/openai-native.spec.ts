// npx vitest run api/providers/__tests__/openai-native.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText, mockCreateOpenAI, mockCaptureException } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateOpenAI: vi.fn(),
	mockCaptureException: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: mockCreateOpenAI.mockImplementation(() => ({
		responses: vi.fn(() => ({
			modelId: "gpt-4.1",
			provider: "openai.responses",
		})),
	})),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: (...args: unknown[]) => mockCaptureException(...args),
		},
	},
}))

import type { NeutralMessageParam } from "../../../core/task-persistence/apiMessages"
import { ApiProviderError, openAiNativeModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { OpenAiNativeHandler } from "../openai-native"

// Helper: create a standard mock fullStream generator
function createMockFullStream(
	parts: Array<{
		type: string
		text?: string
		id?: string
		toolName?: string
		delta?: string
	}>,
) {
	return async function* () {
		for (const part of parts) {
			yield part
		}
	}
}

// Helper: create default mock return value for streamText
function mockStreamTextReturn(
	parts: Array<{
		type: string
		text?: string
		id?: string
		toolName?: string
		delta?: string
	}>,
	usage = { inputTokens: 10, outputTokens: 5 },
	providerMetadata: Record<string, any> = {},
	response: any = { messages: [] },
) {
	mockStreamText.mockReturnValue({
		fullStream: createMockFullStream(parts)(),
		usage: Promise.resolve(usage),
		providerMetadata: Promise.resolve(providerMetadata),
		response: Promise.resolve(response),
	})
}

describe("OpenAiNativeHandler", () => {
	let handler: OpenAiNativeHandler
	let mockOptions: ApiHandlerOptions
	const systemPrompt = "You are a helpful assistant."
	const messages: NeutralMessageParam[] = [
		{
			role: "user",
			content: "Hello!",
		},
	]

	beforeEach(() => {
		mockOptions = {
			apiModelId: "gpt-4.1",
			openAiNativeApiKey: "test-api-key",
		}
		handler = new OpenAiNativeHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(OpenAiNativeHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should initialize with empty API key", () => {
			const handlerWithoutKey = new OpenAiNativeHandler({
				apiModelId: "gpt-4.1",
				openAiNativeApiKey: "",
			})
			expect(handlerWithoutKey).toBeInstanceOf(OpenAiNativeHandler)
		})

		it("should pass undefined baseURL when openAiNativeBaseUrl is empty string", async () => {
			const handlerWithEmptyBase = new OpenAiNativeHandler({
				apiModelId: "gpt-4.1",
				openAiNativeApiKey: "test-key",
				openAiNativeBaseUrl: "",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handlerWithEmptyBase.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockCreateOpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: undefined }))
		})

		it("should pass custom baseURL when openAiNativeBaseUrl is a valid URL", async () => {
			const handlerWithCustomBase = new OpenAiNativeHandler({
				apiModelId: "gpt-4.1",
				openAiNativeApiKey: "test-key",
				openAiNativeBaseUrl: "https://custom-openai.example.com/v1",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handlerWithCustomBase.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockCreateOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({ baseURL: "https://custom-openai.example.com/v1" }),
			)
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("createMessage", () => {
		it("should handle streaming responses", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "Test response" }])

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
			mockStreamTextReturn([{ type: "text-delta", text: "Test response" }], { inputTokens: 10, outputTokens: 5 })

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((chunk) => chunk.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.inputTokens).toBe(10)
			expect(usageChunk?.outputTokens).toBe(5)
		})

		it("should handle tool calls via AI SDK stream parts", async () => {
			mockStreamTextReturn([
				{ type: "tool-input-start", id: "call_1", toolName: "test_tool" },
				{ type: "tool-input-delta", id: "call_1", delta: '{"arg":' },
				{ type: "tool-input-delta", id: "call_1", delta: '"value"}' },
				{ type: "tool-input-end", id: "call_1" },
			])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const toolCallStart = chunks.filter((c) => c.type === "tool_call_start")
			expect(toolCallStart).toHaveLength(1)
			expect(toolCallStart[0].id).toBe("call_1")
			expect(toolCallStart[0].name).toBe("test_tool")

			const toolCallDeltas = chunks.filter((c) => c.type === "tool_call_delta")
			expect(toolCallDeltas).toHaveLength(2)

			const toolCallEnd = chunks.filter((c) => c.type === "tool_call_end")
			expect(toolCallEnd).toHaveLength(1)
		})

		it("should pass system prompt to streamText", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.system).toBe(systemPrompt)
		})

		it("should pass temperature 0 as default for models that support temperature", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalled()
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.temperature).toBe(0)
		})

		it("should use provider.responses() for the language model", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			// Verify createOpenAI was called and .responses() was used
			expect(mockCreateOpenAI).toHaveBeenCalled()
			const provider = mockCreateOpenAI.mock.results[0].value
			expect(provider.responses).toHaveBeenCalledWith("gpt-4.1")
		})

		it("should set store: false in providerOptions", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.store).toBe(false)
		})

		it("should set parallelToolCalls in providerOptions", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				parallelToolCalls: false,
			})
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.parallelToolCalls).toBe(false)
		})

		it("should include session tracking headers via createOpenAI", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages, { taskId: "task-123" })
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(mockCreateOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "test-api-key",
					headers: expect.objectContaining({
						originator: "roo-code",
						session_id: "task-123",
						"User-Agent": expect.stringContaining("roo-code/"),
					}),
				}),
			)
		})

		it("should handle reasoning stream parts", async () => {
			mockStreamTextReturn([
				{ type: "reasoning", text: "Thinking about it..." },
				{ type: "text-delta", text: "The answer is..." },
			])

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Thinking about it...")

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("The answer is...")
		})

		it("should handle API errors in stream", async () => {
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta", text: "" }
					throw new Error("API Error")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should throw
				}
			}).rejects.toThrow("OpenAI Native: API Error")
		})

		it("should handle rate limiting", async () => {
			const rateLimitError = new Error("Rate limit exceeded")
			;(rateLimitError as any).status = 429

			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta", text: "" }
					throw rateLimitError
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should throw
				}
			}).rejects.toThrow("Rate limit exceeded")
		})
	})

	describe("GPT-5 models", () => {
		it("should handle GPT-5.1 model", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "Hello world" }])

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Hello world")

			// Verify correct model is passed
			const provider = mockCreateOpenAI.mock.results[0].value
			expect(provider.responses).toHaveBeenCalledWith("gpt-5.1")
		})

		it("should not send temperature for GPT-5 models", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.temperature).toBeUndefined()
		})

		it("should set default textVerbosity 'medium' for GPT-5 models that support verbosity", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.textVerbosity).toBe("medium")
		})

		it("should support custom verbosity for GPT-5", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				verbosity: "low",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.textVerbosity).toBe("low")
		})

		it("should support high verbosity for GPT-5", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				verbosity: "high",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.textVerbosity).toBe("high")
		})

		it("should set default reasoning effort from model info for GPT-5.1", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			// gpt-5.1 has reasoningEffort: "medium" in model info
			expect(callArgs.providerOptions?.openai?.reasoningEffort).toBe("medium")
			expect(callArgs.providerOptions?.openai?.include).toEqual(["reasoning.encrypted_content"])
			expect(callArgs.providerOptions?.openai?.reasoningSummary).toBe("auto")
		})

		it("should support minimal reasoning effort for GPT-5", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5",
				reasoningEffort: "minimal" as any,
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.reasoningEffort).toBe("minimal")
		})

		it("should support low reasoning effort for GPT-5", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				reasoningEffort: "low",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.reasoningEffort).toBe("low")
			expect(callArgs.providerOptions?.openai?.reasoningSummary).toBe("auto")
		})

		it("should support xhigh reasoning effort for GPT-5.1 Codex Max", async () => {
			const codexMaxHandler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1-codex-max",
				reasoningEffort: "xhigh",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = codexMaxHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.reasoningEffort).toBe("xhigh")
		})

		it("should omit reasoning when selection is 'disable'", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				reasoningEffort: "disable" as any,
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.reasoningEffort).toBeUndefined()
			expect(callArgs.providerOptions?.openai?.include).toBeUndefined()
			expect(callArgs.providerOptions?.openai?.reasoningSummary).toBeUndefined()
		})

		it("should support both verbosity and reasoning effort together for GPT-5", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				verbosity: "high",
				reasoningEffort: "low",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.textVerbosity).toBe("high")
			expect(callArgs.providerOptions?.openai?.reasoningEffort).toBe("low")
			expect(callArgs.providerOptions?.openai?.reasoningSummary).toBe("auto")
		})

		it("should handle GPT-5 Mini model", async () => {
			const gpt5MiniHandler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5-mini-2025-08-07",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "Response" }])

			const stream = gpt5MiniHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const provider = mockCreateOpenAI.mock.results[0].value
			expect(provider.responses).toHaveBeenCalledWith("gpt-5-mini-2025-08-07")
		})

		it("should handle GPT-5 Nano model", async () => {
			const gpt5NanoHandler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5-nano-2025-08-07",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "Nano response" }])

			const stream = gpt5NanoHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const provider = mockCreateOpenAI.mock.results[0].value
			expect(provider.responses).toHaveBeenCalledWith("gpt-5-nano-2025-08-07")
		})

		it("should include usage information with cost for GPT-5", async () => {
			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }], { inputTokens: 100, outputTokens: 20 })

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 20,
				totalCost: expect.any(Number),
			})

			// Verify cost calculation (GPT-5.1 pricing: input $1.25/M, output $10/M)
			const expectedInputCost = (100 / 1_000_000) * 1.25
			const expectedOutputCost = (20 / 1_000_000) * 10.0
			const expectedTotalCost = expectedInputCost + expectedOutputCost
			expect(usageChunks[0].totalCost).toBeCloseTo(expectedTotalCost, 10)
		})
	})

	describe("Verbosity gating for non-GPT-5 models", () => {
		it("should omit textVerbosity for gpt-4.1", async () => {
			const gpt41Handler = new OpenAiNativeHandler({
				apiModelId: "gpt-4.1",
				openAiNativeApiKey: "test-api-key",
				verbosity: "high",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt41Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.textVerbosity).toBeUndefined()
		})

		it("should omit textVerbosity for gpt-4o", async () => {
			const gpt4oHandler = new OpenAiNativeHandler({
				apiModelId: "gpt-4o",
				openAiNativeApiKey: "test-api-key",
				verbosity: "low",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt4oHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.textVerbosity).toBeUndefined()
		})
	})

	describe("completePrompt", () => {
		it("should handle non-streaming completion", async () => {
			mockGenerateText.mockResolvedValue({ text: "This is the completion response" })

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("This is the completion response")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
				}),
			)
		})

		it("should handle SDK errors in completePrompt", async () => {
			mockGenerateText.mockRejectedValue(new Error("API Error"))

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				"OpenAI Native completion error: API Error",
			)
		})

		it("should return empty string when no text in response", async () => {
			mockGenerateText.mockResolvedValue({ text: "" })

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should pass providerOptions including store: false to generateText", async () => {
			mockGenerateText.mockResolvedValue({ text: "response" })

			await handler.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: expect.objectContaining({
						openai: expect.objectContaining({
							store: false,
						}),
					}),
				}),
			)
		})

		it("should use provider.responses() for language model in completePrompt", async () => {
			mockGenerateText.mockResolvedValue({ text: "response" })

			await handler.completePrompt("Test prompt")

			expect(mockCreateOpenAI).toHaveBeenCalled()
			const provider = mockCreateOpenAI.mock.results[0].value
			expect(provider.responses).toHaveBeenCalledWith("gpt-4.1")
		})
	})

	describe("getModel", () => {
		it("should return model info", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe(mockOptions.apiModelId)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(32768)
			expect(modelInfo.info.contextWindow).toBe(1047576)
		})

		it("should handle undefined model ID", () => {
			const handlerWithoutModel = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-api-key",
			})
			const modelInfo = handlerWithoutModel.getModel()
			expect(modelInfo.id).toBe("gpt-5.1-codex-max") // Default model
			expect(modelInfo.info).toBeDefined()
		})

		it("should use 0 as the default temperature", () => {
			const model = handler.getModel()
			expect(model.temperature).toBe(0)
		})

		it("should respect user-provided temperature", () => {
			const handlerWithTemp = new OpenAiNativeHandler({
				...mockOptions,
				modelTemperature: 0.7,
			})
			const model = handlerWithTemp.getModel()
			expect(model.temperature).toBe(0.7)
		})

		it("should strip o3-mini suffix from model id", () => {
			const o3Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "o3-mini-high",
			})
			const model = o3Handler.getModel()
			expect(model.id).toBe("o3-mini")
		})
	})

	describe("error telemetry", () => {
		const errorMessages: NeutralMessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
		]
		const errorSystemPrompt = "You are a helpful assistant"

		beforeEach(() => {
			mockCaptureException.mockClear()
		})

		it("should capture telemetry on createMessage error", async () => {
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta", text: "" }
					throw new Error("Stream error occurred")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = handler.createMessage(errorSystemPrompt, errorMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should throw
				}
			}).rejects.toThrow()

			// Verify telemetry was captured
			expect(mockCaptureException).toHaveBeenCalledTimes(1)
			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Stream error occurred",
					provider: "OpenAI Native",
					modelId: "gpt-4.1",
					operation: "createMessage",
				}),
			)

			// Verify it's an ApiProviderError
			const capturedError = mockCaptureException.mock.calls[0][0]
			expect(capturedError).toBeInstanceOf(ApiProviderError)
		})

		it("should capture telemetry on completePrompt error", async () => {
			mockGenerateText.mockRejectedValue(new Error("API Error"))

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow()

			// Verify telemetry was captured
			expect(mockCaptureException).toHaveBeenCalledTimes(1)
			expect(mockCaptureException).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "API Error",
					provider: "OpenAI Native",
					modelId: "gpt-4.1",
					operation: "completePrompt",
				}),
			)

			// Verify it's an ApiProviderError
			const capturedError = mockCaptureException.mock.calls[0][0]
			expect(capturedError).toBeInstanceOf(ApiProviderError)
		})

		it("should still throw the error after capturing telemetry", async () => {
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta", text: "" }
					throw new Error("Server Error")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = handler.createMessage(errorSystemPrompt, errorMessages)

			// Verify the error is still thrown
			await expect(async () => {
				for await (const _chunk of stream) {
					// Should throw
				}
			}).rejects.toThrow()

			// Telemetry should have been captured before the error was thrown
			expect(mockCaptureException).toHaveBeenCalled()
		})
	})

	describe("Codex Mini Model", () => {
		it("should handle codex-mini-latest streaming response", async () => {
			const codexHandler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-api-key",
				apiModelId: "codex-mini-latest",
			})

			mockStreamTextReturn(
				[
					{ type: "text-delta", text: "Hello" },
					{ type: "text-delta", text: " from" },
					{ type: "text-delta", text: " Codex" },
					{ type: "text-delta", text: " Mini!" },
				],
				{ inputTokens: 50, outputTokens: 10 },
			)

			const stream = codexHandler.createMessage("You are a helpful coding assistant.", [
				{ role: "user", content: "Write a hello world function" },
			])
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify text chunks
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(4)
			expect(textChunks.map((c) => c.text).join("")).toBe("Hello from Codex Mini!")

			// Verify usage data
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toMatchObject({
				type: "usage",
				inputTokens: 50,
				outputTokens: 10,
				totalCost: expect.any(Number),
			})

			// Verify cost is calculated correctly (Codex Mini: $1.5/M input, $6/M output)
			const expectedCost = (50 / 1_000_000) * 1.5 + (10 / 1_000_000) * 6
			expect(usageChunks[0].totalCost).toBeCloseTo(expectedCost, 10)
		})

		it("should handle codex-mini-latest non-streaming completion", async () => {
			const codexHandler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-api-key",
				apiModelId: "codex-mini-latest",
			})

			mockGenerateText.mockResolvedValue({ text: "def hello_world():\n    print('Hello, World!')" })

			const result = await codexHandler.completePrompt("Write a hello world function in Python")

			expect(result).toBe("def hello_world():\n    print('Hello, World!')")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Write a hello world function in Python",
				}),
			)

			// Verify the model is correct
			const provider = mockCreateOpenAI.mock.results[0].value
			expect(provider.responses).toHaveBeenCalledWith("codex-mini-latest")
		})

		it("should handle codex-mini-latest API errors", async () => {
			const codexHandler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-api-key",
				apiModelId: "codex-mini-latest",
			})

			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield { type: "text-delta", text: "" }
					throw new Error("Rate limit exceeded")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = codexHandler.createMessage("You are a helpful assistant.", [
				{ role: "user", content: "Hello" },
			])

			await expect(async () => {
				for await (const _chunk of stream) {
					// consume stream
				}
			}).rejects.toThrow("Rate limit exceeded")
		})

		it("should not set temperature for codex-mini-latest (supportsTemperature: false)", async () => {
			const codexHandler = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-api-key",
				apiModelId: "codex-mini-latest",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = codexHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.temperature).toBeUndefined()
		})
	})

	describe("getEncryptedContent", () => {
		it("should return undefined initially", () => {
			expect(handler.getEncryptedContent()).toBeUndefined()
		})

		it("should extract encrypted content from response messages", async () => {
			mockStreamText.mockReturnValue({
				fullStream: createMockFullStream([{ type: "text-delta", text: "response" }])(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				response: Promise.resolve({
					messages: [
						{
							content: [
								{
									type: "reasoning",
									providerMetadata: {
										openai: {
											reasoningEncryptedContent: "enc_abc123",
											itemId: "item_456",
										},
									},
								},
							],
						},
					],
				}),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const encrypted = handler.getEncryptedContent()
			expect(encrypted).toEqual({
				encrypted_content: "enc_abc123",
				id: "item_456",
			})
		})
	})

	describe("getResponseId", () => {
		it("should return undefined initially", () => {
			expect(handler.getResponseId()).toBeUndefined()
		})

		it("should extract response ID from provider metadata", async () => {
			mockStreamText.mockReturnValue({
				fullStream: createMockFullStream([{ type: "text-delta", text: "response" }])(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({
					openai: {
						responseId: "resp_test_123",
					},
				}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			expect(handler.getResponseId()).toBe("resp_test_123")
		})
	})

	describe("service tier pricing", () => {
		it("should extract service tier from provider metadata", async () => {
			const gpt4oHandler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-4o",
				openAiNativeServiceTier: "priority",
			})

			mockStreamText.mockReturnValue({
				fullStream: createMockFullStream([{ type: "text-delta", text: "response" }])(),
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
				providerMetadata: Promise.resolve({
					openai: {
						serviceTier: "priority",
					},
				}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = gpt4oHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			// Priority tier for gpt-4o: input $4.25/M, output $17/M
			const expectedCost = (100 / 1_000_000) * 4.25 + (50 / 1_000_000) * 17.0
			expect(usageChunk.totalCost).toBeCloseTo(expectedCost, 10)
		})

		it("should pass service tier in providerOptions when model supports it", async () => {
			const gpt4oHandler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-4o",
				openAiNativeServiceTier: "priority",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt4oHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.serviceTier).toBe("priority")
		})
	})

	describe("prompt cache retention", () => {
		it("should set promptCacheRetention for gpt-5.1 models", async () => {
			const gpt51Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = gpt51Handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.promptCacheRetention).toBe("24h")
		})

		it("should not set promptCacheRetention for models without it", async () => {
			// gpt-4.1 has supportsPromptCache but no promptCacheRetention
			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.promptCacheRetention).toBeUndefined()
		})

		it("should not set promptCacheRetention for codex-mini-latest", async () => {
			const codexHandler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			mockStreamTextReturn([{ type: "text-delta", text: "response" }])

			const stream = codexHandler.createMessage(systemPrompt, messages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions?.openai?.promptCacheRetention).toBeUndefined()
		})
	})

	describe("conversation formatting", () => {
		it("should convert messages for AI SDK and pass to streamText", async () => {
			mockStreamTextReturn([{ type: "text-delta", text: "Response" }])

			const multiMessages: NeutralMessageParam[] = [
				{ role: "user", content: "First question" },
				{ role: "assistant", content: "First answer" },
				{ role: "user", content: "Second question" },
			]

			const stream = handler.createMessage(systemPrompt, multiMessages)
			for await (const _chunk of stream) {
				// consume stream
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			// Messages are converted via convertToAiSdkMessages
			expect(callArgs.messages).toBeDefined()
			expect(Array.isArray(callArgs.messages)).toBe(true)
			expect(callArgs.messages.length).toBeGreaterThan(0)
		})
	})

	describe("usage with cache tokens", () => {
		it("should include cache read tokens from usage details", async () => {
			mockStreamText.mockReturnValue({
				fullStream: createMockFullStream([{ type: "text-delta", text: "response" }])(),
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 50,
					details: {
						cachedInputTokens: 30,
					},
				}),
				providerMetadata: Promise.resolve({}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.cacheReadTokens).toBe(30)
		})

		it("should include cache write tokens from provider metadata", async () => {
			mockStreamText.mockReturnValue({
				fullStream: createMockFullStream([{ type: "text-delta", text: "response" }])(),
				usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
				providerMetadata: Promise.resolve({
					openai: {
						cacheCreationInputTokens: 20,
					},
				}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.cacheWriteTokens).toBe(20)
		})

		it("should include reasoning tokens from usage details", async () => {
			mockStreamText.mockReturnValue({
				fullStream: createMockFullStream([{ type: "text-delta", text: "response" }])(),
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 150,
					details: {
						reasoningTokens: 50,
					},
				}),
				providerMetadata: Promise.resolve({}),
				response: Promise.resolve({ messages: [] }),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((c) => c.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk.reasoningTokens).toBe(50)
		})
	})
})
