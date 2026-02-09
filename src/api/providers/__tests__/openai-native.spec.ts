// npx vitest run api/providers/__tests__/openai-native.spec.ts

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

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: vi.fn(() => {
		const provider = vi.fn(() => ({
			modelId: "gpt-4.1",
			provider: "openai",
		}))
		// Add .responses() method that returns the same mock model
		;(provider as any).responses = vi.fn(() => ({
			modelId: "gpt-4.1",
			provider: "openai.responses",
		}))
		return provider
	}),
}))

import type { Anthropic } from "@anthropic-ai/sdk"

import { openAiNativeDefaultModelId, openAiNativeModels } from "@roo-code/types"

import { OpenAiNativeHandler } from "../openai-native"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("OpenAiNativeHandler", () => {
	let handler: OpenAiNativeHandler
	let mockOptions: ApiHandlerOptions
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

		it("should default enableResponsesReasoningSummary to true", () => {
			const opts: ApiHandlerOptions = {
				apiModelId: "gpt-4.1",
				openAiNativeApiKey: "test-key",
			}
			const h = new OpenAiNativeHandler(opts)
			expect(h).toBeInstanceOf(OpenAiNativeHandler)
			// enableResponsesReasoningSummary should have been set to true in constructor
			expect(opts.enableResponsesReasoningSummary).toBe(true)
		})

		it("should preserve explicit enableResponsesReasoningSummary=false", () => {
			const opts: ApiHandlerOptions = {
				apiModelId: "gpt-4.1",
				openAiNativeApiKey: "test-key",
				enableResponsesReasoningSummary: false,
			}
			new OpenAiNativeHandler(opts)
			expect(opts.enableResponsesReasoningSummary).toBe(false)
		})
	})

	describe("getModel", () => {
		it("should return model info for gpt-4.1", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe("gpt-4.1")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(32768)
			expect(modelInfo.info.contextWindow).toBe(1047576)
		})

		it("should handle undefined model ID and return default", () => {
			const handlerWithoutModel = new OpenAiNativeHandler({
				openAiNativeApiKey: "test-api-key",
			})
			const modelInfo = handlerWithoutModel.getModel()
			expect(modelInfo.id).toBe(openAiNativeDefaultModelId)
			expect(modelInfo.info).toBeDefined()
		})

		it("should fall back to default model for invalid model ID", () => {
			const handlerWithInvalidModel = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "invalid-model",
			})
			const model = handlerWithInvalidModel.getModel()
			expect(model.id).toBe(openAiNativeDefaultModelId)
		})

		it("should strip o3-mini suffix from model ID", () => {
			const handlerO3 = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "o3-mini-high",
			})
			const model = handlerO3.getModel()
			expect(model.id).toBe("o3-mini")
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("maxTokens")
		})
	})

	describe("createMessage", () => {
		it("should handle streaming responses", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
				yield { type: "text-delta", text: " response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 2 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Test")
			expect(textChunks[1].text).toBe(" response")
		})

		it("should include usage information", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 20 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(20)
		})

		it("should handle cached tokens in usage details", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 50,
					details: {
						cachedInputTokens: 30,
						reasoningTokens: 10,
					},
				}),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(100)
			expect(usageChunks[0].outputTokens).toBe(50)
			expect(usageChunks[0].cacheReadTokens).toBe(30)
			expect(usageChunks[0].reasoningTokens).toBe(10)
		})

		it("should handle reasoning stream parts", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning-delta", text: "thinking..." }
				yield { type: "text-delta", text: "answer" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("thinking...")

			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("answer")
		})

		it("should handle tool calls in stream", async () => {
			async function* mockFullStream() {
				yield { type: "tool-input-start", id: "call_1", toolName: "test_tool" }
				yield { type: "tool-input-delta", id: "call_1", delta: '{"arg":"val"}' }
				yield { type: "tool-input-end", id: "call_1" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.some((c) => c.type === "tool_call_start")).toBe(true)
			expect(chunks.some((c) => c.type === "tool_call_delta")).toBe(true)
			expect(chunks.some((c) => c.type === "tool_call_end")).toBe(true)
		})

		it("should handle API errors", async () => {
			const error = new Error("API Error")
			;(error as any).name = "AI_APICallError"
			;(error as any).status = 500

			// Suppress unhandled rejection warnings for dangling promises
			const rejectedUsage = Promise.reject(error)
			const rejectedMeta = Promise.reject(error)
			const rejectedContent = Promise.reject(error)
			rejectedUsage.catch(() => {})
			rejectedMeta.catch(() => {})
			rejectedContent.catch(() => {})

			async function* errorStream() {
				yield { type: "text-delta", text: "" }
				throw error
			}

			mockStreamText.mockReturnValue({
				fullStream: errorStream(),
				usage: rejectedUsage,
				providerMetadata: rejectedMeta,
				content: rejectedContent,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			await expect(async () => {
				for await (const _chunk of stream) {
					// drain
				}
			}).rejects.toThrow("OpenAI Native")
		})

		it("should pass system prompt to streamText", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: expect.objectContaining({
						openai: expect.objectContaining({
							instructions: systemPrompt,
						}),
					}),
				}),
			)
		})

		it("should pass temperature when model supports it", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			// gpt-4.1 supports temperature
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: expect.any(Number),
				}),
			)
		})

		it("should use user-specified temperature", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const handlerWithTemp = new OpenAiNativeHandler({
				...mockOptions,
				modelTemperature: 0.7,
			})

			const stream = handlerWithTemp.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.7,
				}),
			)
		})

		it("should pass store: false in provider options", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: expect.objectContaining({
						openai: expect.objectContaining({
							store: false,
						}),
					}),
				}),
			)
		})

		it("should capture responseId from provider metadata", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({
					openai: {
						responseId: "resp_test123",
						serviceTier: "default",
					},
				}),
				content: Promise.resolve([]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			expect(handler.getResponseId()).toBe("resp_test123")
		})

		it("should capture encrypted content from reasoning parts", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning-delta", text: "thinking" }
				yield { type: "text-delta", text: "answer" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({
					openai: { responseId: "resp_test" },
				}),
				content: Promise.resolve([
					{
						type: "reasoning",
						text: "thinking",
						providerMetadata: {
							openai: {
								reasoningEncryptedContent: "encrypted_payload",
								itemId: "item_123",
							},
						},
					},
					{
						type: "text",
						text: "answer",
					},
				]),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const encrypted = handler.getEncryptedContent()
			expect(encrypted).toBeDefined()
			expect(encrypted!.encrypted_content).toBe("encrypted_payload")
			expect(encrypted!.id).toBe("item_123")
		})

		it("should reset state between requests", async () => {
			// First request with metadata
			async function* mockFullStream1() {
				yield { type: "text-delta", text: "first" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream1(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({
					openai: { responseId: "resp_1" },
				}),
				content: Promise.resolve([]),
			})

			let stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}
			expect(handler.getResponseId()).toBe("resp_1")

			// Second request should reset state
			async function* mockFullStream2() {
				yield { type: "text-delta", text: "second" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream2(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			// Should be reset since second request had no responseId
			expect(handler.getResponseId()).toBeUndefined()
			expect(handler.getEncryptedContent()).toBeUndefined()
		})
	})

	describe("GPT-5 models", () => {
		it("should pass reasoning effort in provider options for GPT-5", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: expect.objectContaining({
						openai: expect.objectContaining({
							reasoningEffort: expect.any(String),
							reasoningSummary: "auto",
							include: ["reasoning.encrypted_content"],
						}),
					}),
				}),
			)
		})

		it("should pass verbosity in provider options for models that support it", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				verbosity: "low",
			})

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: expect.objectContaining({
						openai: expect.objectContaining({
							textVerbosity: "low",
						}),
					}),
				}),
			)
		})

		it("should support xhigh reasoning effort for GPT-5.1 Codex Max", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const codexHandler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1-codex-max",
				reasoningEffort: "xhigh",
			})

			const stream = codexHandler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: expect.objectContaining({
						openai: expect.objectContaining({
							reasoningEffort: "xhigh",
						}),
					}),
				}),
			)
		})

		it("should omit reasoning when selection is 'disable'", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "No reasoning" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const h = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				reasoningEffort: "disable" as any,
			})

			const stream = h.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions.openai.reasoningEffort).toBeUndefined()
			expect(callArgs.providerOptions.openai.include).toBeUndefined()
			expect(callArgs.providerOptions.openai.reasoningSummary).toBeUndefined()
		})

		it("should not pass temperature for models that don't support it", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			// GPT-5 models have supportsTemperature: false
			const gpt51Info = openAiNativeModels["gpt-5.1"]
			if (gpt51Info.supportsTemperature === false) {
				expect(callArgs.temperature).toBeUndefined()
			}
		})

		it("should not include verbosity for non-GPT-5 models", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			// gpt-4.1 does not support verbosity
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions.openai.textVerbosity).toBeUndefined()
		})

		it("should handle GPT-5 models with multiple stream chunks", async () => {
			async function* mockFullStream() {
				yield { type: "reasoning-delta", text: "reasoning step 1" }
				yield { type: "reasoning-delta", text: " step 2" }
				yield { type: "text-delta", text: "Hello" }
				yield { type: "text-delta", text: " world" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 50,
					details: { reasoningTokens: 20 },
				}),
				providerMetadata: Promise.resolve({
					openai: { responseId: "resp_gpt5_test" },
				}),
				content: Promise.resolve([]),
			})

			const gpt5Handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			const stream = gpt5Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const reasoning = chunks.filter((c) => c.type === "reasoning")
			expect(reasoning).toHaveLength(2)

			const text = chunks.filter((c) => c.type === "text")
			expect(text).toHaveLength(2)

			const usage = chunks.filter((c) => c.type === "usage")
			expect(usage).toHaveLength(1)
			expect(usage[0].reasoningTokens).toBe(20)
		})
	})

	describe("service tier", () => {
		it("should pass service tier in provider options when supported", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const tierHandler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				openAiNativeServiceTier: "flex",
			})

			const stream = tierHandler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			// Tier should be passed when model supports it
			const model = tierHandler.getModel()
			const allowedTiers = new Set(model.info.tiers?.map((t) => t.name).filter(Boolean) || [])
			if (allowedTiers.has("flex")) {
				expect(callArgs.providerOptions.openai.serviceTier).toBe("flex")
			}
		})

		it("should capture service tier from provider metadata", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Test" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({
					openai: {
						responseId: "resp_123",
						serviceTier: "flex",
					},
				}),
				content: Promise.resolve([]),
			})

			const tierHandler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
				openAiNativeServiceTier: "flex",
			})

			const stream = tierHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Usage should include totalCost (calculated with tier pricing)
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(typeof usageChunks[0].totalCost).toBe("number")
		})
	})

	describe("prompt cache retention", () => {
		it("should pass promptCacheRetention for models that support it", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			const h = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5.1",
			})

			const stream = h.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			const modelInfo = openAiNativeModels["gpt-5.1"]
			if (modelInfo.supportsPromptCache && modelInfo.promptCacheRetention === "24h") {
				expect(callArgs.providerOptions.openai.promptCacheRetention).toBe("24h")
			}
		})

		it("should not pass promptCacheRetention for models without support", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
				content: Promise.resolve([]),
			})

			// gpt-4.1 doesn't have promptCacheRetention: "24h"
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.providerOptions.openai.promptCacheRetention).toBeUndefined()
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt using generateText", async () => {
			mockGenerateText.mockResolvedValue({
				text: "This is the completion response",
				usage: { inputTokens: 10, outputTokens: 5 },
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("This is the completion response")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
					providerOptions: expect.objectContaining({
						openai: expect.objectContaining({
							store: false,
						}),
					}),
				}),
			)
		})

		it("should handle errors in completePrompt", async () => {
			mockGenerateText.mockRejectedValue(new Error("API Error"))

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("OpenAI Native")
		})

		it("should return empty string when no text in response", async () => {
			mockGenerateText.mockResolvedValue({
				text: "",
				usage: { inputTokens: 10, outputTokens: 0 },
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("getEncryptedContent", () => {
		it("should return undefined when no encrypted content has been captured", () => {
			expect(handler.getEncryptedContent()).toBeUndefined()
		})
	})

	describe("getResponseId", () => {
		it("should return undefined when no response ID has been captured", () => {
			expect(handler.getResponseId()).toBeUndefined()
		})
	})
})
