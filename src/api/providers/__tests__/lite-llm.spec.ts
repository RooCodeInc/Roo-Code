// npx vitest run api/providers/__tests__/lite-llm.spec.ts

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

const mockLanguageModel = vi.fn()

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: vi.fn(() => {
		const provider = Object.assign(
			vi.fn(() => ({ modelId: "test-model", provider: "litellm" })),
			{
				languageModel: mockLanguageModel.mockImplementation((id: string, _config?: unknown) => ({
					modelId: id,
					provider: "litellm",
				})),
			},
		)
		return provider
	}),
}))

// Mock vscode to avoid import errors
vi.mock("vscode", () => ({}))

const mockGetModels = vi.fn()
const mockGetModelsFromCache = vi.fn()

vi.mock("../fetchers/modelCache", () => ({
	getModels: (...args: unknown[]) => mockGetModels(...args),
	getModelsFromCache: (...args: unknown[]) => mockGetModelsFromCache(...args),
}))

import type { RooMessageParam } from "../../../core/task-persistence/apiMessages"
import { litellmDefaultModelId, litellmDefaultModelInfo } from "@roo-code/types"

import { ApiHandlerOptions } from "../../../shared/api"

import { LiteLLMHandler } from "../lite-llm"

const testModelInfo = { ...litellmDefaultModelInfo, maxTokens: 8192 }

const allModels: Record<string, typeof litellmDefaultModelInfo> = {
	[litellmDefaultModelId]: litellmDefaultModelInfo,
	"gpt-5": testModelInfo,
	gpt5: testModelInfo,
	"GPT-5": testModelInfo,
	"gpt-5-turbo": testModelInfo,
	"gpt5-preview": testModelInfo,
	"gpt-5o": testModelInfo,
	"gpt-5.1": testModelInfo,
	"gpt-5-mini": testModelInfo,
	"gpt-4": testModelInfo,
	"claude-3-opus": testModelInfo,
	"llama-3": testModelInfo,
	"gpt-4-turbo": testModelInfo,
	"gemini-3-pro": testModelInfo,
	"gemini-3-flash": testModelInfo,
	"gemini-2.5-pro": testModelInfo,
	"google/gemini-3-pro": testModelInfo,
	"vertex_ai/gemini-3-pro": testModelInfo,
	"bedrock/anthropic.claude-3-sonnet": testModelInfo,
}

/** Helper to get the transformRequestBody from the last mockLanguageModel call. */
function getTransformRequestBody(): (body: Record<string, unknown>) => Record<string, unknown> {
	const lastCall = mockLanguageModel.mock.calls[mockLanguageModel.mock.calls.length - 1]
	return lastCall[1]?.transformRequestBody
}

/** Helper to create a minimal async fullStream mock. */
function mockFullStreamWith(text = "Response") {
	async function* mockFullStream() {
		yield { type: "text-delta" as const, text }
	}
	mockStreamText.mockReturnValue({
		fullStream: mockFullStream(),
		usage: Promise.resolve({
			inputTokens: 100,
			outputTokens: 50,
			raw: {},
		}),
	})
}

/** Helper to drain a createMessage generator and return chunks. */
async function drainStream(
	handler: LiteLLMHandler,
	systemPrompt: string,
	messages: RooMessageParam[],
	metadata?: Record<string, unknown>,
) {
	const chunks: unknown[] = []
	for await (const chunk of handler.createMessage(systemPrompt, messages, metadata as any)) {
		chunks.push(chunk)
	}
	return chunks
}

describe("LiteLLMHandler", () => {
	let handler: LiteLLMHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		vi.clearAllMocks()
		mockOptions = {
			litellmApiKey: "test-key",
			litellmBaseUrl: "http://localhost:4000",
			litellmModelId: litellmDefaultModelId,
		}
		mockGetModelsFromCache.mockReturnValue(undefined)
		mockGetModels.mockResolvedValue(allModels)
		handler = new LiteLLMHandler(mockOptions)
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(LiteLLMHandler)
		})

		it("should use default model ID if not provided", () => {
			const h = new LiteLLMHandler({ litellmApiKey: "key" })
			const model = h.getModel()
			expect(model.id).toBe(litellmDefaultModelId)
		})

		it("should use cache if available at construction time", () => {
			mockGetModelsFromCache.mockReturnValue({ "gpt-4": testModelInfo })
			const h = new LiteLLMHandler({ ...mockOptions, litellmModelId: "gpt-4" })
			const model = h.getModel()
			expect(model.id).toBe("gpt-4")
			expect(model.info).toMatchObject(testModelInfo)
		})
	})

	describe("fetchModel", () => {
		it("returns correct model info after fetching", async () => {
			const h = new LiteLLMHandler(mockOptions)
			const result = await h.fetchModel()

			expect(mockGetModels).toHaveBeenCalledWith(
				expect.objectContaining({
					provider: "litellm",
					apiKey: "test-key",
					baseUrl: "http://localhost:4000",
				}),
			)
			expect(result.id).toBe(litellmDefaultModelId)
			expect(result.info).toBeDefined()
		})
	})

	describe("getModel", () => {
		it("should return model with params", () => {
			mockGetModelsFromCache.mockReturnValue({ [litellmDefaultModelId]: testModelInfo })
			const h = new LiteLLMHandler(mockOptions)
			const model = h.getModel()

			expect(model.id).toBe(litellmDefaultModelId)
			expect(model.info).toBeDefined()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})
	})

	describe("createMessage", () => {
		it("should handle streaming responses", async () => {
			mockFullStreamWith("Test response")

			const chunks = await drainStream(handler, "You are a helpful assistant", [
				{ role: "user", content: "Hello" },
			])

			const textChunks = chunks.filter((c: any) => c.type === "text")
			expect(textChunks).toHaveLength(1)
			expect((textChunks[0] as any).text).toBe("Test response")
		})

		it("should call fetchModel before streaming", async () => {
			mockFullStreamWith()

			await drainStream(handler, "test", [{ role: "user", content: "hi" }])

			expect(mockGetModels).toHaveBeenCalledWith(expect.objectContaining({ provider: "litellm" }))
		})

		it("should include tools and toolChoice when provided", async () => {
			mockFullStreamWith()

			const mockTools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get weather",
						parameters: {
							type: "object",
							properties: { location: { type: "string" } },
							required: ["location"],
						},
					},
				},
			]

			await drainStream(handler, "test", [{ role: "user", content: "Hello" }], {
				tools: mockTools,
				tool_choice: "auto",
			})

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Object),
				}),
			)
		})

		it("should handle API errors", async () => {
			mockStreamText.mockReturnValue({
				fullStream: (async function* () {
					yield* [] // satisfy require-yield
					throw new Error("API Error")
				})(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			await expect(async () => {
				await drainStream(handler, "test", [{ role: "user", content: "hi" }])
			}).rejects.toThrow()
		})
	})

	describe("completePrompt", () => {
		it("should complete a prompt using generateText", async () => {
			mockGenerateText.mockResolvedValue({ text: "Test completion" })

			const result = await handler.completePrompt("Test prompt")

			expect(result).toBe("Test completion")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
				}),
			)
		})

		it("should call fetchModel before completing", async () => {
			mockGenerateText.mockResolvedValue({ text: "done" })

			await handler.completePrompt("test")

			expect(mockGetModels).toHaveBeenCalledWith(expect.objectContaining({ provider: "litellm" }))
		})
	})

	describe("prompt caching", () => {
		it("should apply cache_control via transformRequestBody when litellmUsePromptCache is enabled", async () => {
			const optionsWithCache: ApiHandlerOptions = {
				...mockOptions,
				litellmUsePromptCache: true,
			}
			// Return model info with supportsPromptCache
			mockGetModels.mockResolvedValue({
				[litellmDefaultModelId]: { ...litellmDefaultModelInfo, supportsPromptCache: true },
			})
			handler = new LiteLLMHandler(optionsWithCache)

			mockFullStreamWith()

			await drainStream(handler, "You are a helpful assistant", [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
				{ role: "user", content: "How are you?" },
			])

			const transformRequestBody = getTransformRequestBody()
			expect(transformRequestBody).toBeDefined()

			// Simulate the wire-format body that @ai-sdk/openai-compatible would produce
			const mockBody = {
				messages: [
					{ role: "system", content: "You are a helpful assistant" },
					{ role: "user", content: "Hello" },
					{ role: "assistant", content: "Hi there!" },
					{ role: "user", content: "How are you?" },
				],
				max_tokens: 8192,
			}

			const transformed = transformRequestBody(mockBody) as Record<string, unknown>

			// System message should have cache_control
			const msgs = transformed.messages as Record<string, unknown>[]
			expect(msgs[0]).toMatchObject({
				role: "system",
				content: [
					{
						type: "text",
						text: "You are a helpful assistant",
						cache_control: { type: "ephemeral" },
					},
				],
			})

			// Last two user messages should have cache_control
			const userMsgIndices = msgs.map((msg, idx) => (msg.role === "user" ? idx : -1)).filter((idx) => idx !== -1)

			const lastUserIdx = userMsgIndices[userMsgIndices.length - 1]
			const secondLastUserIdx = userMsgIndices[userMsgIndices.length - 2]

			expect(msgs[lastUserIdx]).toMatchObject({
				role: "user",
				content: [
					{
						type: "text",
						text: "How are you?",
						cache_control: { type: "ephemeral" },
					},
				],
			})

			if (secondLastUserIdx !== -1) {
				expect(msgs[secondLastUserIdx]).toMatchObject({
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello",
							cache_control: { type: "ephemeral" },
						},
					],
				})
			}
		})

		it("should yield usage with cache tokens from raw response", async () => {
			const optionsWithCache: ApiHandlerOptions = {
				...mockOptions,
				litellmUsePromptCache: true,
			}
			mockGetModels.mockResolvedValue({
				[litellmDefaultModelId]: { ...litellmDefaultModelInfo, supportsPromptCache: true },
			})
			handler = new LiteLLMHandler(optionsWithCache)

			async function* mockFullStream() {
				yield { type: "text-delta" as const, text: "Response" }
			}
			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({
					inputTokens: 100,
					outputTokens: 50,
					raw: {
						cache_creation_input_tokens: 20,
						prompt_tokens_details: { cached_tokens: 30 },
					},
				}),
			})

			const chunks = await drainStream(handler, "test", [{ role: "user", content: "Hello" }])

			const usageChunk = chunks.find((c: any) => c.type === "usage")
			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
				cacheWriteTokens: 20,
				cacheReadTokens: 30,
			})
		})
	})

	describe("GPT-5 model handling", () => {
		it("should use max_completion_tokens instead of max_tokens for GPT-5 models", async () => {
			handler = new LiteLLMHandler({ ...mockOptions, litellmModelId: "gpt-5" })

			mockFullStreamWith()

			await drainStream(handler, "You are a helpful assistant", [{ role: "user", content: "Hello" }])

			const transformRequestBody = getTransformRequestBody()
			const transformed = transformRequestBody({
				messages: [
					{ role: "system", content: "Test" },
					{ role: "user", content: "Hello" },
				],
				max_tokens: 8192,
			}) as Record<string, unknown>

			expect(transformed.max_completion_tokens).toBe(8192)
			expect(transformed.max_tokens).toBeUndefined()
		})

		it("should use max_completion_tokens for various GPT-5 model variations", async () => {
			const gpt5Variations = [
				"gpt-5",
				"gpt5",
				"GPT-5",
				"gpt-5-turbo",
				"gpt5-preview",
				"gpt-5o",
				"gpt-5.1",
				"gpt-5-mini",
			]

			for (const modelId of gpt5Variations) {
				vi.clearAllMocks()
				mockGetModelsFromCache.mockReturnValue(undefined)
				mockGetModels.mockResolvedValue(allModels)

				handler = new LiteLLMHandler({ ...mockOptions, litellmModelId: modelId })

				mockFullStreamWith()

				await drainStream(handler, "test", [{ role: "user", content: "Test" }])

				const transformRequestBody = getTransformRequestBody()
				const transformed = transformRequestBody({
					messages: [{ role: "user", content: "Test" }],
					max_tokens: 8192,
				}) as Record<string, unknown>

				expect(transformed.max_completion_tokens).toBe(8192)
				expect(transformed.max_tokens).toBeUndefined()
			}
		})

		it("should still use max_tokens for non-GPT-5 models", async () => {
			const nonGPT5Models = ["gpt-4", "claude-3-opus", "llama-3", "gpt-4-turbo"]

			for (const modelId of nonGPT5Models) {
				vi.clearAllMocks()
				mockGetModelsFromCache.mockReturnValue(undefined)
				mockGetModels.mockResolvedValue(allModels)

				handler = new LiteLLMHandler({ ...mockOptions, litellmModelId: modelId })

				mockFullStreamWith()

				await drainStream(handler, "test", [{ role: "user", content: "Test" }])

				const transformRequestBody = getTransformRequestBody()
				const transformed = transformRequestBody({
					messages: [{ role: "user", content: "Test" }],
					max_tokens: 8192,
				}) as Record<string, unknown>

				expect(transformed.max_tokens).toBe(8192)
				expect(transformed.max_completion_tokens).toBeUndefined()
			}
		})

		it("should not set max_completion_tokens when max_tokens is undefined (GPT-5)", async () => {
			handler = new LiteLLMHandler({ ...mockOptions, litellmModelId: "gpt-5" })

			mockFullStreamWith()

			await drainStream(handler, "test", [{ role: "user", content: "Hello" }])

			const transformRequestBody = getTransformRequestBody()
			const transformed = transformRequestBody({
				messages: [{ role: "user", content: "Test" }],
				// No max_tokens
			}) as Record<string, unknown>

			expect(transformed.max_tokens).toBeUndefined()
			expect(transformed.max_completion_tokens).toBeUndefined()
		})

		it("should use max_completion_tokens in completePrompt for GPT-5 models", async () => {
			handler = new LiteLLMHandler({ ...mockOptions, litellmModelId: "gpt-5" })

			mockGenerateText.mockResolvedValue({ text: "Test response" })

			await handler.completePrompt("Test prompt")

			const transformRequestBody = getTransformRequestBody()
			const transformed = transformRequestBody({
				messages: [{ role: "user", content: "Test prompt" }],
				max_tokens: 8192,
			}) as Record<string, unknown>

			expect(transformed.max_completion_tokens).toBe(8192)
			expect(transformed.max_tokens).toBeUndefined()
		})
	})

	describe("Gemini thought signature injection", () => {
		describe("isGeminiModel detection", () => {
			it("should detect Gemini 3 models", () => {
				const h = new LiteLLMHandler(mockOptions)
				const isGeminiModel = (h as any).isGeminiModel.bind(h)

				expect(isGeminiModel("gemini-3-pro")).toBe(true)
				expect(isGeminiModel("gemini-3-flash")).toBe(true)
				expect(isGeminiModel("gemini-3-pro-preview")).toBe(true)
			})

			it("should detect Gemini 2.5 models", () => {
				const h = new LiteLLMHandler(mockOptions)
				const isGeminiModel = (h as any).isGeminiModel.bind(h)

				expect(isGeminiModel("gemini-2.5-pro")).toBe(true)
				expect(isGeminiModel("gemini-2.5-flash")).toBe(true)
			})

			it("should detect Gemini models with spaces (LiteLLM model groups)", () => {
				const h = new LiteLLMHandler(mockOptions)
				const isGeminiModel = (h as any).isGeminiModel.bind(h)

				expect(isGeminiModel("Gemini 3 Pro")).toBe(true)
				expect(isGeminiModel("Gemini 3 Flash")).toBe(true)
				expect(isGeminiModel("gemini 3 pro")).toBe(true)
				expect(isGeminiModel("Gemini 2.5 Pro")).toBe(true)
				expect(isGeminiModel("gemini 2.5 flash")).toBe(true)
			})

			it("should detect provider-prefixed Gemini models", () => {
				const h = new LiteLLMHandler(mockOptions)
				const isGeminiModel = (h as any).isGeminiModel.bind(h)

				expect(isGeminiModel("google/gemini-3-pro")).toBe(true)
				expect(isGeminiModel("vertex_ai/gemini-3-pro")).toBe(true)
				expect(isGeminiModel("vertex/gemini-2.5-pro")).toBe(true)
				expect(isGeminiModel("google/gemini 3 pro")).toBe(true)
				expect(isGeminiModel("vertex_ai/gemini 2.5 pro")).toBe(true)
			})

			it("should not detect non-Gemini models", () => {
				const h = new LiteLLMHandler(mockOptions)
				const isGeminiModel = (h as any).isGeminiModel.bind(h)

				expect(isGeminiModel("gpt-4")).toBe(false)
				expect(isGeminiModel("claude-3-opus")).toBe(false)
				expect(isGeminiModel("gemini-1.5-pro")).toBe(false)
				expect(isGeminiModel("gemini-2.0-flash")).toBe(false)
			})
		})

		describe("injectThoughtSignatureForGemini", () => {
			const dummySignature = Buffer.from("skip_thought_signature_validator").toString("base64")

			it("should inject provider_specific_fields.thought_signature for assistant messages with tool_calls", () => {
				const h = new LiteLLMHandler(mockOptions)
				const injectThoughtSignature = (h as any).injectThoughtSignatureForGemini.bind(h)

				const messages = [
					{ role: "user", content: "Hello" },
					{
						role: "assistant",
						content: "",
						tool_calls: [
							{ id: "call_123", type: "function", function: { name: "test_tool", arguments: "{}" } },
						],
					},
					{ role: "tool", tool_call_id: "call_123", content: "result" },
				]

				const result = injectThoughtSignature(messages)

				expect(result[1].tool_calls[0].provider_specific_fields).toBeDefined()
				expect(result[1].tool_calls[0].provider_specific_fields.thought_signature).toBe(dummySignature)
			})

			it("should not inject if assistant message has no tool_calls", () => {
				const h = new LiteLLMHandler(mockOptions)
				const injectThoughtSignature = (h as any).injectThoughtSignatureForGemini.bind(h)

				const messages = [
					{ role: "user", content: "Hello" },
					{ role: "assistant", content: "Hi there!" },
				]

				const result = injectThoughtSignature(messages)

				expect(result[1].tool_calls).toBeUndefined()
			})

			it("should always overwrite existing thought_signature", () => {
				const h = new LiteLLMHandler(mockOptions)
				const injectThoughtSignature = (h as any).injectThoughtSignatureForGemini.bind(h)

				const existingSignature = "existing_signature_base64"

				const messages = [
					{ role: "user", content: "Hello" },
					{
						role: "assistant",
						content: "",
						tool_calls: [
							{
								id: "call_123",
								type: "function",
								function: { name: "test_tool", arguments: "{}" },
								provider_specific_fields: { thought_signature: existingSignature },
							},
						],
					},
				]

				const result = injectThoughtSignature(messages)

				expect(result[1].tool_calls[0].provider_specific_fields.thought_signature).toBe(dummySignature)
			})

			it("should inject signature into ALL tool calls for parallel calls", () => {
				const h = new LiteLLMHandler(mockOptions)
				const injectThoughtSignature = (h as any).injectThoughtSignatureForGemini.bind(h)

				const messages = [
					{ role: "user", content: "Hello" },
					{
						role: "assistant",
						content: "",
						tool_calls: [
							{ id: "call_first", type: "function", function: { name: "tool1", arguments: "{}" } },
							{ id: "call_second", type: "function", function: { name: "tool2", arguments: "{}" } },
							{ id: "call_third", type: "function", function: { name: "tool3", arguments: "{}" } },
						],
					},
				]

				const result = injectThoughtSignature(messages)

				expect(result[1].tool_calls[0].provider_specific_fields.thought_signature).toBe(dummySignature)
				expect(result[1].tool_calls[1].provider_specific_fields.thought_signature).toBe(dummySignature)
				expect(result[1].tool_calls[2].provider_specific_fields.thought_signature).toBe(dummySignature)
			})

			it("should preserve existing provider_specific_fields when adding thought_signature", () => {
				const h = new LiteLLMHandler(mockOptions)
				const injectThoughtSignature = (h as any).injectThoughtSignatureForGemini.bind(h)

				const messages = [
					{ role: "user", content: "Hello" },
					{
						role: "assistant",
						content: "",
						tool_calls: [
							{
								id: "call_123",
								type: "function",
								function: { name: "test_tool", arguments: "{}" },
								provider_specific_fields: { other_field: "value" },
							},
						],
					},
				]

				const result = injectThoughtSignature(messages)

				expect(result[1].tool_calls[0].provider_specific_fields.other_field).toBe("value")
				expect(result[1].tool_calls[0].provider_specific_fields.thought_signature).toBe(dummySignature)
			})
		})

		describe("createMessage integration with Gemini models", () => {
			const dummySignature = Buffer.from("skip_thought_signature_validator").toString("base64")

			it("should inject thought signatures for Gemini models via transformRequestBody", async () => {
				handler = new LiteLLMHandler({ ...mockOptions, litellmModelId: "gemini-3-pro" })

				mockFullStreamWith()

				await drainStream(handler, "You are a helpful assistant", [
					{ role: "user", content: "Hello" },
					{
						role: "assistant",
						content: [
							{ type: "text", text: "I'll help you with that." },
							{
								type: "tool-call",
								toolCallId: "toolu_123",
								toolName: "read_file",
								input: { path: "test.txt" },
							},
						],
					},
					{
						role: "user",
						content: [
							{
								type: "tool-result",
								toolCallId: "toolu_123",
								toolName: "",
								output: { type: "text" as const, value: "file contents" },
							},
						],
					},
					{ role: "user", content: "Thanks!" },
				])

				const transformRequestBody = getTransformRequestBody()

				// Simulate the wire-format body with tool calls
				const transformed = transformRequestBody({
					messages: [
						{ role: "system", content: "You are a helpful assistant" },
						{ role: "user", content: "Hello" },
						{
							role: "assistant",
							content: "I'll help you with that.",
							tool_calls: [
								{
									id: "toolu_123",
									type: "function",
									function: { name: "read_file", arguments: '{"path":"test.txt"}' },
								},
							],
						},
						{ role: "tool", tool_call_id: "toolu_123", content: "file contents" },
						{ role: "user", content: "Thanks!" },
					],
				}) as Record<string, unknown>

				const msgs = transformed.messages as Record<string, unknown>[]
				const assistantMsg = msgs.find(
					(msg) => msg.role === "assistant" && (msg.tool_calls as unknown[])?.length > 0,
				)

				expect(assistantMsg).toBeDefined()
				const toolCalls = assistantMsg!.tool_calls as Record<string, unknown>[]
				expect(toolCalls[0].provider_specific_fields).toBeDefined()
				expect((toolCalls[0].provider_specific_fields as Record<string, unknown>).thought_signature).toBe(
					dummySignature,
				)
			})

			it("should not inject thought signatures for non-Gemini models", async () => {
				handler = new LiteLLMHandler({ ...mockOptions, litellmModelId: "gpt-4" })

				mockFullStreamWith()

				await drainStream(handler, "test", [{ role: "user", content: "Hello" }])

				const transformRequestBody = getTransformRequestBody()

				const transformed = transformRequestBody({
					messages: [
						{ role: "user", content: "Hello" },
						{
							role: "assistant",
							content: "",
							tool_calls: [
								{
									id: "call_123",
									type: "function",
									function: { name: "test", arguments: "{}" },
								},
							],
						},
					],
				}) as Record<string, unknown>

				const msgs = transformed.messages as Record<string, unknown>[]
				const assistantMsg = msgs.find(
					(msg) => msg.role === "assistant" && (msg.tool_calls as unknown[])?.length > 0,
				)

				expect(assistantMsg).toBeDefined()
				const toolCalls = assistantMsg!.tool_calls as Record<string, unknown>[]
				expect(toolCalls[0].provider_specific_fields).toBeUndefined()
			})
		})
	})

	describe("tool ID normalization", () => {
		it("should truncate tool IDs longer than 64 characters via transformRequestBody", async () => {
			handler = new LiteLLMHandler({
				...mockOptions,
				litellmModelId: "bedrock/anthropic.claude-3-sonnet",
			})

			mockFullStreamWith()

			await drainStream(handler, "test", [{ role: "user", content: "Hello" }])

			const transformRequestBody = getTransformRequestBody()

			const longToolId = "toolu_" + "a".repeat(70)

			const transformed = transformRequestBody({
				messages: [
					{
						role: "assistant",
						content: "I'll help.",
						tool_calls: [
							{ id: longToolId, type: "function", function: { name: "read_file", arguments: "{}" } },
						],
					},
					{
						role: "tool",
						tool_call_id: longToolId,
						content: "file contents",
					},
				],
			}) as Record<string, unknown>

			const msgs = transformed.messages as Record<string, unknown>[]
			const assistantMsg = msgs.find((msg) => msg.role === "assistant")
			const toolMsg = msgs.find((msg) => msg.role === "tool")

			expect(assistantMsg).toBeDefined()
			const toolCalls = assistantMsg!.tool_calls as Record<string, unknown>[]
			expect((toolCalls[0].id as string).length).toBeLessThanOrEqual(64)

			expect(toolMsg).toBeDefined()
			expect((toolMsg!.tool_call_id as string).length).toBeLessThanOrEqual(64)
		})

		it("should not modify tool IDs that are already within 64 characters", async () => {
			handler = new LiteLLMHandler({
				...mockOptions,
				litellmModelId: "bedrock/anthropic.claude-3-sonnet",
			})

			mockFullStreamWith()

			await drainStream(handler, "test", [{ role: "user", content: "Hello" }])

			const transformRequestBody = getTransformRequestBody()

			const shortToolId = "toolu_01ABC123"

			const transformed = transformRequestBody({
				messages: [
					{
						role: "assistant",
						content: "I'll help.",
						tool_calls: [
							{ id: shortToolId, type: "function", function: { name: "read_file", arguments: "{}" } },
						],
					},
					{
						role: "tool",
						tool_call_id: shortToolId,
						content: "file contents",
					},
				],
			}) as Record<string, unknown>

			const msgs = transformed.messages as Record<string, unknown>[]
			const assistantMsg = msgs.find((msg) => msg.role === "assistant")
			const toolMsg = msgs.find((msg) => msg.role === "tool")

			const toolCalls = assistantMsg!.tool_calls as Record<string, unknown>[]
			expect(toolCalls[0].id).toBe(shortToolId)
			expect(toolMsg!.tool_call_id).toBe(shortToolId)
		})

		it("should maintain uniqueness with hash suffix when truncating", async () => {
			handler = new LiteLLMHandler({
				...mockOptions,
				litellmModelId: "bedrock/anthropic.claude-3-sonnet",
			})

			mockFullStreamWith()

			await drainStream(handler, "test", [{ role: "user", content: "Hello" }])

			const transformRequestBody = getTransformRequestBody()

			const longToolId1 = "toolu_" + "a".repeat(60) + "_suffix1"
			const longToolId2 = "toolu_" + "a".repeat(60) + "_suffix2"

			const transformed = transformRequestBody({
				messages: [
					{
						role: "assistant",
						content: "I'll help.",
						tool_calls: [
							{ id: longToolId1, type: "function", function: { name: "read_file", arguments: "{}" } },
							{ id: longToolId2, type: "function", function: { name: "read_file", arguments: "{}" } },
						],
					},
				],
			}) as Record<string, unknown>

			const msgs = transformed.messages as Record<string, unknown>[]
			const assistantMsg = msgs.find((msg) => msg.role === "assistant")
			const toolCalls = assistantMsg!.tool_calls as Record<string, unknown>[]

			expect(toolCalls).toHaveLength(2)

			const id1 = toolCalls[0].id as string
			const id2 = toolCalls[1].id as string

			expect(id1.length).toBeLessThanOrEqual(64)
			expect(id2.length).toBeLessThanOrEqual(64)
			expect(id1).not.toBe(id2)
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly process usage metrics including cache and cost", async () => {
			class TestLiteLLMHandler extends LiteLLMHandler {
				public testProcessUsageMetrics(usage: Record<string, unknown>) {
					return this.processUsageMetrics(usage as any)
				}
			}

			mockGetModelsFromCache.mockReturnValue({
				[litellmDefaultModelId]: litellmDefaultModelInfo,
			})
			const h = new TestLiteLLMHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: {},
				raw: {
					cache_creation_input_tokens: 20,
					prompt_tokens_details: { cached_tokens: 30 },
				},
			}

			const result = h.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(20)
			expect(result.cacheReadTokens).toBe(30)
			expect(result.totalCost).toEqual(expect.any(Number))
		})

		it("should handle prompt_cache_miss_tokens as cache write", async () => {
			class TestLiteLLMHandler extends LiteLLMHandler {
				public testProcessUsageMetrics(usage: Record<string, unknown>) {
					return this.processUsageMetrics(usage as any)
				}
			}

			mockGetModelsFromCache.mockReturnValue({
				[litellmDefaultModelId]: litellmDefaultModelInfo,
			})
			const h = new TestLiteLLMHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: {},
				raw: {
					prompt_cache_miss_tokens: 15,
					prompt_cache_hit_tokens: 25,
				},
			}

			const result = h.testProcessUsageMetrics(usage)

			expect(result.cacheWriteTokens).toBe(15)
			expect(result.cacheReadTokens).toBe(25)
		})

		it("should handle missing cache metrics gracefully", async () => {
			class TestLiteLLMHandler extends LiteLLMHandler {
				public testProcessUsageMetrics(usage: Record<string, unknown>) {
					return this.processUsageMetrics(usage as any)
				}
			}

			mockGetModelsFromCache.mockReturnValue({
				[litellmDefaultModelId]: litellmDefaultModelInfo,
			})
			const h = new TestLiteLLMHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: {},
				raw: {},
			}

			const result = h.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})

		it("should fall back to details.cachedInputTokens when raw is missing", async () => {
			class TestLiteLLMHandler extends LiteLLMHandler {
				public testProcessUsageMetrics(usage: Record<string, unknown>) {
					return this.processUsageMetrics(usage as any)
				}
			}

			mockGetModelsFromCache.mockReturnValue({
				[litellmDefaultModelId]: litellmDefaultModelInfo,
			})
			const h = new TestLiteLLMHandler(mockOptions)

			const usage = {
				inputTokens: 100,
				outputTokens: 50,
				details: { cachedInputTokens: 15 },
				raw: undefined,
			}

			const result = h.testProcessUsageMetrics(usage)

			expect(result.cacheReadTokens).toBe(15)
		})
	})
})
