import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"

import { LiteLLMHandler } from "../lite-llm"
import { ApiHandlerOptions } from "../../../shared/api"
import { litellmDefaultModelId, litellmDefaultModelInfo } from "@roo-code/types"

// Mock vscode first to avoid import errors
vi.mock("vscode", () => ({}))

// Mock OpenAI
const mockCreate = vi.fn()

vi.mock("openai", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate,
				},
			},
		})),
	}
})

// Mock model fetching
vi.mock("../fetchers/modelCache", () => ({
	getModels: vi.fn().mockImplementation(() => {
		return Promise.resolve({
			[litellmDefaultModelId]: litellmDefaultModelInfo,
			"gpt-5": { ...litellmDefaultModelInfo, maxTokens: 8192 },
			gpt5: { ...litellmDefaultModelInfo, maxTokens: 8192 },
			"GPT-5": { ...litellmDefaultModelInfo, maxTokens: 8192 },
			"gpt-5-turbo": { ...litellmDefaultModelInfo, maxTokens: 8192 },
			"gpt5-preview": { ...litellmDefaultModelInfo, maxTokens: 8192 },
			"gpt-5o": { ...litellmDefaultModelInfo, maxTokens: 8192 },
			"gpt-5.1": { ...litellmDefaultModelInfo, maxTokens: 8192 },
			"gpt-5-mini": { ...litellmDefaultModelInfo, maxTokens: 8192 },
			"gpt-4": { ...litellmDefaultModelInfo, maxTokens: 8192 },
			"claude-3-opus": { ...litellmDefaultModelInfo, maxTokens: 8192 },
			"llama-3": { ...litellmDefaultModelInfo, maxTokens: 8192 },
			"gpt-4-turbo": { ...litellmDefaultModelInfo, maxTokens: 8192 },
		})
	}),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

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
		handler = new LiteLLMHandler(mockOptions)
	})

	describe("prompt caching", () => {
		it("should add cache control headers when litellmUsePromptCache is enabled", async () => {
			const optionsWithCache: ApiHandlerOptions = {
				...mockOptions,
				litellmUsePromptCache: true,
			}
			handler = new LiteLLMHandler(optionsWithCache)

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
				{ role: "user", content: "How are you?" },
			]

			// Mock the stream response
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { content: "I'm doing well!" } }],
						usage: {
							prompt_tokens: 100,
							completion_tokens: 50,
							cache_creation_input_tokens: 20,
							cache_read_input_tokens: 30,
						},
					}
				},
			}

			mockCreate.mockReturnValue({
				withResponse: vi.fn().mockResolvedValue({ data: mockStream }),
			})

			const generator = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Verify that create was called with cache control headers
			const createCall = mockCreate.mock.calls[0][0]

			// Check system message has cache control in the proper format
			expect(createCall.messages[0]).toMatchObject({
				role: "system",
				content: [
					{
						type: "text",
						text: systemPrompt,
						cache_control: { type: "ephemeral" },
					},
				],
			})

			// Check that the last two user messages have cache control
			const userMessageIndices = createCall.messages
				.map((msg: any, idx: number) => (msg.role === "user" ? idx : -1))
				.filter((idx: number) => idx !== -1)

			const lastUserIdx = userMessageIndices[userMessageIndices.length - 1]
			const secondLastUserIdx = userMessageIndices[userMessageIndices.length - 2]

			// Check last user message has proper structure with cache control
			expect(createCall.messages[lastUserIdx]).toMatchObject({
				role: "user",
				content: [
					{
						type: "text",
						text: "How are you?",
						cache_control: { type: "ephemeral" },
					},
				],
			})

			// Check second last user message (first user message in this case)
			if (secondLastUserIdx !== -1) {
				expect(createCall.messages[secondLastUserIdx]).toMatchObject({
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

			// Verify usage includes cache tokens
			const usageChunk = results.find((chunk) => chunk.type === "usage")
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
			const optionsWithGPT5: ApiHandlerOptions = {
				...mockOptions,
				litellmModelId: "gpt-5",
			}
			handler = new LiteLLMHandler(optionsWithGPT5)

			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			// Mock the stream response
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { content: "Hello!" } }],
						usage: {
							prompt_tokens: 10,
							completion_tokens: 5,
						},
					}
				},
			}

			mockCreate.mockReturnValue({
				withResponse: vi.fn().mockResolvedValue({ data: mockStream }),
			})

			const generator = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Verify that create was called with max_completion_tokens instead of max_tokens
			const createCall = mockCreate.mock.calls[0][0]

			// Should have max_completion_tokens, not max_tokens
			expect(createCall.max_completion_tokens).toBeDefined()
			expect(createCall.max_tokens).toBeUndefined()
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

				const optionsWithGPT5: ApiHandlerOptions = {
					...mockOptions,
					litellmModelId: modelId,
				}
				handler = new LiteLLMHandler(optionsWithGPT5)

				const systemPrompt = "You are a helpful assistant"
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Test" }]

				// Mock the stream response
				const mockStream = {
					async *[Symbol.asyncIterator]() {
						yield {
							choices: [{ delta: { content: "Response" } }],
							usage: {
								prompt_tokens: 10,
								completion_tokens: 5,
							},
						}
					},
				}

				mockCreate.mockReturnValue({
					withResponse: vi.fn().mockResolvedValue({ data: mockStream }),
				})

				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Consume the generator
				}

				// Verify that create was called with max_completion_tokens for this model variation
				const createCall = mockCreate.mock.calls[0][0]

				expect(createCall.max_completion_tokens).toBeDefined()
				expect(createCall.max_tokens).toBeUndefined()
			}
		})

		it("should still use max_tokens for non-GPT-5 models", async () => {
			const nonGPT5Models = ["gpt-4", "claude-3-opus", "llama-3", "gpt-4-turbo"]

			for (const modelId of nonGPT5Models) {
				vi.clearAllMocks()

				const options: ApiHandlerOptions = {
					...mockOptions,
					litellmModelId: modelId,
				}
				handler = new LiteLLMHandler(options)

				const systemPrompt = "You are a helpful assistant"
				const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Test" }]

				// Mock the stream response
				const mockStream = {
					async *[Symbol.asyncIterator]() {
						yield {
							choices: [{ delta: { content: "Response" } }],
							usage: {
								prompt_tokens: 10,
								completion_tokens: 5,
							},
						}
					},
				}

				mockCreate.mockReturnValue({
					withResponse: vi.fn().mockResolvedValue({ data: mockStream }),
				})

				const generator = handler.createMessage(systemPrompt, messages)
				for await (const chunk of generator) {
					// Consume the generator
				}

				// Verify that create was called with max_tokens for non-GPT-5 models
				const createCall = mockCreate.mock.calls[0][0]

				expect(createCall.max_tokens).toBeDefined()
				expect(createCall.max_completion_tokens).toBeUndefined()
			}
		})

		it("should use max_completion_tokens in completePrompt for GPT-5 models", async () => {
			const optionsWithGPT5: ApiHandlerOptions = {
				...mockOptions,
				litellmModelId: "gpt-5",
			}
			handler = new LiteLLMHandler(optionsWithGPT5)

			mockCreate.mockResolvedValue({
				choices: [{ message: { content: "Test response" } }],
			})

			await handler.completePrompt("Test prompt")

			// Verify that create was called with max_completion_tokens
			const createCall = mockCreate.mock.calls[0][0]

			expect(createCall.max_completion_tokens).toBeDefined()
			expect(createCall.max_tokens).toBeUndefined()
		})

		it("should not set any max token fields when maxTokens is undefined (GPT-5 streaming)", async () => {
			const optionsWithGPT5: ApiHandlerOptions = {
				...mockOptions,
				litellmModelId: "gpt-5",
			}
			handler = new LiteLLMHandler(optionsWithGPT5)

			// Force fetchModel to return undefined maxTokens
			vi.spyOn(handler as any, "fetchModel").mockResolvedValue({
				id: "gpt-5",
				info: { ...litellmDefaultModelInfo, maxTokens: undefined },
			})

			// Mock the stream response
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { content: "Hello!" } }],
						usage: {
							prompt_tokens: 10,
							completion_tokens: 5,
						},
					}
				},
			}

			mockCreate.mockReturnValue({
				withResponse: vi.fn().mockResolvedValue({ data: mockStream }),
			})

			const generator = handler.createMessage("You are a helpful assistant", [
				{ role: "user", content: "Hello" } as unknown as Anthropic.Messages.MessageParam,
			])
			for await (const _chunk of generator) {
				// consume
			}

			// Should not include either token field
			const createCall = mockCreate.mock.calls[0][0]
			expect(createCall.max_tokens).toBeUndefined()
			expect(createCall.max_completion_tokens).toBeUndefined()
		})

		it("should not set any max token fields when maxTokens is undefined (GPT-5 completePrompt)", async () => {
			const optionsWithGPT5: ApiHandlerOptions = {
				...mockOptions,
				litellmModelId: "gpt-5",
			}
			handler = new LiteLLMHandler(optionsWithGPT5)

			// Force fetchModel to return undefined maxTokens
			vi.spyOn(handler as any, "fetchModel").mockResolvedValue({
				id: "gpt-5",
				info: { ...litellmDefaultModelInfo, maxTokens: undefined },
			})

			mockCreate.mockResolvedValue({
				choices: [{ message: { content: "Ok" } }],
			})

			await handler.completePrompt("Test prompt")

			const createCall = mockCreate.mock.calls[0][0]
			expect(createCall.max_tokens).toBeUndefined()
			expect(createCall.max_completion_tokens).toBeUndefined()
		})
	})

	describe("thinking/reasoning data handling", () => {
		beforeEach(() => {
			// Ensure handler is properly initialized for each test
			vi.clearAllMocks()
			handler = new LiteLLMHandler(mockOptions)
		})

		it("should handle reasoning field in delta", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Solve this problem" }]

			// Mock the stream response with reasoning content
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { reasoning: "Let me think about this..." } }],
					}
					yield {
						choices: [{ delta: { content: "The answer is 42" } }],
					}
					yield {
						usage: {
							prompt_tokens: 10,
							completion_tokens: 5,
						},
					}
				},
			}

			mockCreate.mockReturnValue({
				withResponse: vi.fn().mockResolvedValue({ data: mockStream }),
			})

			const generator = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Verify reasoning chunk was yielded
			expect(results[0]).toEqual({
				type: "reasoning",
				text: "Let me think about this...",
			})
			expect(results[1]).toEqual({
				type: "text",
				text: "The answer is 42",
			})
		})

		it("should handle thinking field in delta", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Solve this problem" }]

			// Mock the stream response with thinking content
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { thinking: "Processing the request..." } }],
					}
					yield {
						choices: [{ delta: { content: "Here's the solution" } }],
					}
					yield {
						usage: {
							prompt_tokens: 10,
							completion_tokens: 5,
						},
					}
				},
			}

			mockCreate.mockReturnValue({
				withResponse: vi.fn().mockResolvedValue({ data: mockStream }),
			})

			const generator = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Verify thinking chunk was yielded as reasoning
			expect(results[0]).toEqual({
				type: "reasoning",
				text: "Processing the request...",
			})
			expect(results[1]).toEqual({
				type: "text",
				text: "Here's the solution",
			})
		})

		it("should handle reasoning_content field in delta", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Solve this problem" }]

			// Mock the stream response with reasoning_content
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { reasoning_content: "Analyzing the problem..." } }],
					}
					yield {
						choices: [{ delta: { content: "Solution found" } }],
					}
					yield {
						usage: {
							prompt_tokens: 10,
							completion_tokens: 5,
						},
					}
				},
			}

			mockCreate.mockReturnValue({
				withResponse: vi.fn().mockResolvedValue({ data: mockStream }),
			})

			const generator = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Verify reasoning_content chunk was yielded as reasoning
			expect(results[0]).toEqual({
				type: "reasoning",
				text: "Analyzing the problem...",
			})
			expect(results[1]).toEqual({
				type: "text",
				text: "Solution found",
			})
		})

		it("should handle mixed reasoning and text content", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Complex question" }]

			// Mock the stream response with mixed content
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { reasoning: "First, let me understand..." } }],
					}
					yield {
						choices: [{ delta: { content: "Based on my analysis" } }],
					}
					yield {
						choices: [{ delta: { thinking: "Considering alternatives..." } }],
					}
					yield {
						choices: [{ delta: { content: ", the answer is clear." } }],
					}
					yield {
						usage: {
							prompt_tokens: 15,
							completion_tokens: 10,
						},
					}
				},
			}

			mockCreate.mockReturnValue({
				withResponse: vi.fn().mockResolvedValue({ data: mockStream }),
			})

			const generator = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Verify all chunks were yielded in correct order
			expect(results[0]).toEqual({
				type: "reasoning",
				text: "First, let me understand...",
			})
			expect(results[1]).toEqual({
				type: "text",
				text: "Based on my analysis",
			})
			expect(results[2]).toEqual({
				type: "reasoning",
				text: "Considering alternatives...",
			})
			expect(results[3]).toEqual({
				type: "text",
				text: ", the answer is clear.",
			})
		})

		it("should ignore non-string reasoning fields", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Test" }]

			// Mock the stream response with invalid reasoning types
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { reasoning: null } }],
					}
					yield {
						choices: [{ delta: { thinking: 123 } }],
					}
					yield {
						choices: [{ delta: { reasoning_content: { nested: "object" } } }],
					}
					yield {
						choices: [{ delta: { content: "Valid response" } }],
					}
					yield {
						usage: {
							prompt_tokens: 5,
							completion_tokens: 3,
						},
					}
				},
			}

			mockCreate.mockReturnValue({
				withResponse: vi.fn().mockResolvedValue({ data: mockStream }),
			})

			const generator = handler.createMessage(systemPrompt, messages)
			const results = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Should only have the valid text content
			const contentChunks = results.filter((r) => r.type === "text" || r.type === "reasoning")
			expect(contentChunks).toHaveLength(1)
			expect(contentChunks[0]).toEqual({
				type: "text",
				text: "Valid response",
			})
		})
	})
})
