// npx vitest run src/api/providers/__tests__/venice.spec.ts

import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"

import { type VeniceModelId, veniceDefaultModelId, veniceModels } from "@roo-code/types"

import { VeniceHandler } from "../venice"

vitest.mock("openai", () => {
	const createMock = vitest.fn()
	return {
		default: vitest.fn(() => ({ chat: { completions: { create: createMock } } })),
	}
})

describe("VeniceHandler", () => {
	let handler: VeniceHandler
	let mockCreate: any

	beforeEach(() => {
		vitest.clearAllMocks()
		mockCreate = (OpenAI as unknown as any)().chat.completions.create
		handler = new VeniceHandler({ veniceApiKey: "test-venice-api-key" })
	})

	it("should use the correct Venice base URL", () => {
		new VeniceHandler({ veniceApiKey: "test-venice-api-key" })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://api.venice.ai/api/v1" }))
	})

	it("should use the provided API key", () => {
		const veniceApiKey = "test-venice-api-key"
		new VeniceHandler({ veniceApiKey })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: veniceApiKey }))
	})

	it("should return default model when no model is specified", () => {
		const model = handler.getModel()
		expect(model.id).toBe(veniceDefaultModelId)
		expect(model.info).toEqual(veniceModels[veniceDefaultModelId])
	})

	it("should return specified model when valid model is provided", () => {
		const testModelId: VeniceModelId = "deepseek-r1-671b"
		const handlerWithModel = new VeniceHandler({
			apiModelId: testModelId,
			veniceApiKey: "test-venice-api-key",
		})
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(veniceModels[testModelId])
	})

	it("completePrompt method should return text from Venice API", async () => {
		const expectedResponse = "This is a test response from Venice"
		mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: expectedResponse } }] })
		const result = await handler.completePrompt("test prompt")
		expect(result).toBe(expectedResponse)
	})

	it("should handle errors in completePrompt", async () => {
		const errorMessage = "Venice API error"
		mockCreate.mockRejectedValueOnce(new Error(errorMessage))
		await expect(handler.completePrompt("test prompt")).rejects.toThrow(`Venice completion error: ${errorMessage}`)
	})

	it("createMessage should yield text content from stream", async () => {
		const testContent = "This is test content from Venice stream"

		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					next: vitest
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
					next: vitest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: {
								choices: [{ delta: { content: "" } }],
								usage: { prompt_tokens: 10, completion_tokens: 5 },
							},
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}
		})

		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual(
			expect.objectContaining({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
			}),
		)
	})

	it("should pass the correct parameters to OpenAI API", async () => {
		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					next: vitest.fn().mockResolvedValueOnce({ done: true }),
				}),
			}
		})

		const systemPrompt = "You are a helpful assistant"
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

		const stream = handler.createMessage(systemPrompt, messages)

		// Consume the stream
		const results = []
		for await (const chunk of stream) {
			results.push(chunk)
		}

		const callArgs = mockCreate.mock.calls[0][0]
		expect(callArgs.model).toBe(veniceDefaultModelId)
		expect(callArgs.stream).toBe(true)
	})
})
