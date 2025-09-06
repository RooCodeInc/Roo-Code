// npx vitest run api/providers/__tests__/base-openai-compatible-provider.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { BaseOpenAiCompatibleProvider } from "../base-openai-compatible-provider"
import type { ModelInfo } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../../shared/api"

// Create mock functions
const mockCreate = vi.fn()

// Mock OpenAI module
vi.mock("openai", () => ({
	default: vi.fn(() => ({
		chat: {
			completions: {
				create: mockCreate,
			},
		},
	})),
}))

// Create a test implementation of BaseOpenAiCompatibleProvider
class TestProvider extends BaseOpenAiCompatibleProvider<"test-model"> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "TestProvider",
			baseURL: "https://test.api.com/v1",
			apiKey: options.apiKey || "test-key",
			defaultProviderModelId: "test-model",
			providerModels: {
				"test-model": {
					maxTokens: 4096,
					contextWindow: 8192,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: 0,
					outputPrice: 0,
					description: "Test model",
				} as ModelInfo,
			},
			defaultTemperature: 0.7,
		})
	}
}

describe("BaseOpenAiCompatibleProvider", () => {
	let provider: TestProvider

	beforeEach(() => {
		vi.clearAllMocks()
		// Set up default mock implementation
		mockCreate.mockImplementation(async () => ({
			[Symbol.asyncIterator]: async function* () {
				yield {
					choices: [
						{
							delta: { content: "Test response" },
							index: 0,
						},
					],
					usage: null,
				}
				yield {
					choices: [
						{
							delta: {},
							index: 0,
						},
					],
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
						total_tokens: 15,
					},
				}
			},
		}))
		provider = new TestProvider({ apiKey: "test-key" })
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("<think> tag handling", () => {
		it("should parse <think> tags and convert to reasoning chunks", async () => {
			// Override the mock for this specific test
			mockCreate.mockImplementationOnce(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [
							{
								delta: { content: "<think>I need to analyze this..." },
								index: 0,
							},
						],
						usage: null,
					}
					yield {
						choices: [
							{
								delta: { content: "</think>The answer is 42" },
								index: 0,
							},
						],
						usage: null,
					}
					yield {
						choices: [
							{
								delta: {},
								index: 0,
							},
						],
						usage: { prompt_tokens: 10, completion_tokens: 20 },
					}
				},
			}))

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "What is the meaning of life?" },
			]

			const stream = provider.createMessage(systemPrompt, messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "reasoning", text: "I need to analyze this..." },
				{ type: "text", text: "The answer is 42" },
				{ type: "usage", inputTokens: 10, outputTokens: 20 },
			])
		})

		it("should handle nested <think> tags correctly", async () => {
			mockCreate.mockImplementationOnce(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [
							{
								delta: {
									content:
										"<think>Outer thought <think>Inner thought</think> back to outer</think>Final answer",
								},
								index: 0,
							},
						],
						usage: null,
					}
					yield {
						choices: [
							{
								delta: {},
								index: 0,
							},
						],
						usage: { prompt_tokens: 10, completion_tokens: 15 },
					}
				},
			}))

			const stream = provider.createMessage("System", [{ role: "user", content: "Test" }])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "reasoning", text: "Outer thought <think>Inner thought</think> back to outer" },
				{ type: "text", text: "Final answer" },
				{ type: "usage", inputTokens: 10, outputTokens: 15 },
			])
		})

		it("should handle partial <think> tags across chunks", async () => {
			mockCreate.mockImplementationOnce(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [
							{
								delta: { content: "Start " },
								index: 0,
							},
						],
						usage: null,
					}
					yield {
						choices: [
							{
								delta: { content: "<think>Thinking" },
								index: 0,
							},
						],
						usage: null,
					}
					yield {
						choices: [
							{
								delta: { content: " process</think>" },
								index: 0,
							},
						],
						usage: null,
					}
					yield {
						choices: [
							{
								delta: { content: " Result" },
								index: 0,
							},
						],
						usage: null,
					}
					yield {
						choices: [
							{
								delta: {},
								index: 0,
							},
						],
						usage: { prompt_tokens: 5, completion_tokens: 10 },
					}
				},
			}))

			const stream = provider.createMessage("System", [{ role: "user", content: "Test" }])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "text", text: "Start " },
				{ type: "reasoning", text: "Thinking" },
				{ type: "reasoning", text: " process" },
				{ type: "text", text: " Result" },
				{ type: "usage", inputTokens: 5, outputTokens: 10 },
			])
		})

		it("should handle content without <think> tags normally", async () => {
			mockCreate.mockImplementationOnce(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [
							{
								delta: { content: "This is a normal response without any thinking tags" },
								index: 0,
							},
						],
						usage: null,
					}
					yield {
						choices: [
							{
								delta: {},
								index: 0,
							},
						],
						usage: { prompt_tokens: 8, completion_tokens: 12 },
					}
				},
			}))

			const stream = provider.createMessage("System", [{ role: "user", content: "Test" }])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "text", text: "This is a normal response without any thinking tags" },
				{ type: "usage", inputTokens: 8, outputTokens: 12 },
			])
		})

		it("should handle multiple <think> blocks in the same response", async () => {
			mockCreate.mockImplementationOnce(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [
							{
								delta: {
									content:
										"First part <think>First thought</think> middle part <think>Second thought</think> final part",
								},
								index: 0,
							},
						],
						usage: null,
					}
					yield {
						choices: [
							{
								delta: {},
								index: 0,
							},
						],
						usage: { prompt_tokens: 10, completion_tokens: 20 },
					}
				},
			}))

			const stream = provider.createMessage("System", [{ role: "user", content: "Test" }])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "text", text: "First part " },
				{ type: "reasoning", text: "First thought" },
				{ type: "text", text: " middle part " },
				{ type: "reasoning", text: "Second thought" },
				{ type: "text", text: " final part" },
				{ type: "usage", inputTokens: 10, outputTokens: 20 },
			])
		})

		it("should handle empty <think> tags", async () => {
			mockCreate.mockImplementationOnce(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [
							{
								delta: { content: "Before <think></think> After" },
								index: 0,
							},
						],
						usage: null,
					}
					yield {
						choices: [
							{
								delta: {},
								index: 0,
							},
						],
						usage: { prompt_tokens: 5, completion_tokens: 5 },
					}
				},
			}))

			const stream = provider.createMessage("System", [{ role: "user", content: "Test" }])
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "text", text: "Before  After" },
				{ type: "usage", inputTokens: 5, outputTokens: 5 },
			])
		})
	})

	describe("existing functionality", () => {
		it("should create message stream with correct parameters", async () => {
			const systemPrompt = "Test system prompt"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Test message" }]

			const stream = provider.createMessage(systemPrompt, messages)
			await stream.next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "test-model",
					max_tokens: 4096,
					messages: expect.arrayContaining([{ role: "system", content: systemPrompt }]),
					stream: true,
					stream_options: { include_usage: true },
				}),
				undefined,
			)
		})

		it("should handle completePrompt correctly", async () => {
			const expectedResponse = "This is a test response"
			mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: expectedResponse } }] })

			const result = await provider.completePrompt("test prompt")

			expect(result).toBe(expectedResponse)
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "test-model",
					messages: [{ role: "user", content: "test prompt" }],
				}),
			)
		})

		it("should handle errors in completePrompt", async () => {
			const errorMessage = "API error"
			mockCreate.mockRejectedValueOnce(new Error(errorMessage))

			await expect(provider.completePrompt("test prompt")).rejects.toThrow(
				`TestProvider completion error: ${errorMessage}`,
			)
		})

		it("should yield usage data from stream", async () => {
			mockCreate.mockImplementationOnce(() => {
				return {
					[Symbol.asyncIterator]: () => ({
						next: vi
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									choices: [{ delta: {} }],
									usage: { prompt_tokens: 15, completion_tokens: 25 },
								},
							})
							.mockResolvedValueOnce({ done: true }),
					}),
				}
			})

			const stream = provider.createMessage("system prompt", [])
			const firstChunk = await stream.next()

			expect(firstChunk.done).toBe(false)
			expect(firstChunk.value).toEqual({ type: "usage", inputTokens: 15, outputTokens: 25 })
		})
	})
})
