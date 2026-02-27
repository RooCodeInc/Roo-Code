// npx vitest run src/api/providers/__tests__/avian.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type AvianModelId, avianDefaultModelId, avianModels } from "@roo-code/types"

import { AvianHandler } from "../avian"

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

describe("AvianHandler", () => {
	let handler: AvianHandler

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
		handler = new AvianHandler({ avianApiKey: "test-key" })
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should use the correct Avian base URL", () => {
		new AvianHandler({ avianApiKey: "test-avian-api-key" })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://api.avian.io/v1" }))
	})

	it("should use the provided API key", () => {
		const avianApiKey = "test-avian-api-key"
		new AvianHandler({ avianApiKey })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: avianApiKey }))
	})

	it("should throw error when API key is not provided", () => {
		expect(() => new AvianHandler({})).toThrow("API key is required")
	})

	it("should return default model when no model is specified", () => {
		const model = handler.getModel()
		expect(model.id).toBe(avianDefaultModelId)
		expect(model.info).toEqual(expect.objectContaining(avianModels[avianDefaultModelId]))
	})

	it("should return specified model when valid model is provided", () => {
		const testModelId: AvianModelId = "moonshotai/kimi-k2.5"
		const handlerWithModel = new AvianHandler({
			apiModelId: testModelId,
			avianApiKey: "test-avian-api-key",
		})
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(expect.objectContaining(avianModels[testModelId]))
	})

	it("should return DeepSeek V3.2 model with correct configuration", () => {
		const testModelId: AvianModelId = "deepseek/deepseek-v3.2"
		const handlerWithModel = new AvianHandler({
			apiModelId: testModelId,
			avianApiKey: "test-avian-api-key",
		})
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(
			expect.objectContaining({
				maxTokens: 65536,
				contextWindow: 163840,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0.26,
				outputPrice: 0.38,
				description: expect.stringContaining("DeepSeek V3.2"),
			}),
		)
	})

	it("should return Kimi K2.5 model with correct configuration", () => {
		const testModelId: AvianModelId = "moonshotai/kimi-k2.5"
		const handlerWithModel = new AvianHandler({
			apiModelId: testModelId,
			avianApiKey: "test-avian-api-key",
		})
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(
			expect.objectContaining({
				maxTokens: 8192,
				contextWindow: 131072,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0.45,
				outputPrice: 2.2,
				description: expect.stringContaining("Kimi K2.5"),
			}),
		)
	})

	it("should return GLM-5 model with correct configuration", () => {
		const testModelId: AvianModelId = "z-ai/glm-5"
		const handlerWithModel = new AvianHandler({
			apiModelId: testModelId,
			avianApiKey: "test-avian-api-key",
		})
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(
			expect.objectContaining({
				maxTokens: 16384,
				contextWindow: 131072,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0.3,
				outputPrice: 2.55,
				description: expect.stringContaining("GLM-5"),
			}),
		)
	})

	it("should return MiniMax M2.5 model with correct configuration", () => {
		const testModelId: AvianModelId = "minimax/minimax-m2.5"
		const handlerWithModel = new AvianHandler({
			apiModelId: testModelId,
			avianApiKey: "test-avian-api-key",
		})
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(
			expect.objectContaining({
				maxTokens: 1048576,
				contextWindow: 1048576,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0.3,
				outputPrice: 1.1,
				description: expect.stringContaining("MiniMax M2.5"),
			}),
		)
	})

	it("completePrompt method should return text from Avian API", async () => {
		const expectedResponse = "This is a test response from Avian"
		mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: expectedResponse } }] })
		const result = await handler.completePrompt("test prompt")
		expect(result).toBe(expectedResponse)
	})

	it("should handle errors in completePrompt", async () => {
		const errorMessage = "Avian API error"
		mockCreate.mockRejectedValueOnce(new Error(errorMessage))
		await expect(handler.completePrompt("test prompt")).rejects.toThrow(`Avian completion error: ${errorMessage}`)
	})

	it("createMessage should yield text content from stream", async () => {
		const testContent = "This is test content from Avian stream"

		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: { choices: [{ delta: { content: testContent } }] },
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}
		})

		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual({ type: "text", text: testContent })
	})

	it("createMessage should yield usage data from stream", async () => {
		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: { choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 20 } },
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}
		})

		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toMatchObject({ type: "usage", inputTokens: 10, outputTokens: 20 })
	})

	it("createMessage should pass correct parameters to Avian client", async () => {
		const modelId: AvianModelId = "deepseek/deepseek-v3.2"
		const modelInfo = avianModels[modelId]
		const handlerWithModel = new AvianHandler({
			apiModelId: modelId,
			avianApiKey: "test-avian-api-key",
		})

		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					async next() {
						return { done: true }
					},
				}),
			}
		})

		const systemPrompt = "Test system prompt for Avian"
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Test message for Avian" }]

		const messageGenerator = handlerWithModel.createMessage(systemPrompt, messages)
		await messageGenerator.next()

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: modelId,
				temperature: 0,
				messages: expect.arrayContaining([{ role: "system", content: systemPrompt }]),
				stream: true,
				stream_options: { include_usage: true },
			}),
			undefined,
		)
	})

	it("should handle empty response in completePrompt", async () => {
		mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] })
		const result = await handler.completePrompt("test prompt")
		expect(result).toBe("")
	})

	it("should handle missing choices in completePrompt", async () => {
		mockCreate.mockResolvedValueOnce({ choices: [] })
		const result = await handler.completePrompt("test prompt")
		expect(result).toBe("")
	})

	it("createMessage should handle stream with multiple chunks", async () => {
		mockCreate.mockImplementationOnce(async () => ({
			[Symbol.asyncIterator]: async function* () {
				yield {
					choices: [
						{
							delta: { content: "Hello" },
							index: 0,
						},
					],
					usage: null,
				}
				yield {
					choices: [
						{
							delta: { content: " world" },
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
						prompt_tokens: 5,
						completion_tokens: 10,
						total_tokens: 15,
					},
				}
			},
		}))

		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hi" }]

		const stream = handler.createMessage(systemPrompt, messages)
		const chunks = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		expect(chunks[0]).toEqual({ type: "text", text: "Hello" })
		expect(chunks[1]).toEqual({ type: "text", text: " world" })
		expect(chunks[2]).toMatchObject({ type: "usage", inputTokens: 5, outputTokens: 10 })
	})
})
