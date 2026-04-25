// npx vitest run src/api/providers/__tests__/abliteration.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { abliterationDefaultModelId, abliterationModels } from "@roo-code/types"

import { AbliterationHandler } from "../abliteration"

const mockCreate = vi.fn()

vi.mock("openai", () => ({
	default: vi.fn(() => ({
		chat: {
			completions: {
				create: mockCreate,
			},
		},
	})),
}))

describe("AbliterationHandler", () => {
	let handler: AbliterationHandler

	beforeEach(() => {
		vi.clearAllMocks()
		handler = new AbliterationHandler({ abliterationApiKey: "test-abliteration-api-key" })
	})

	it("should use the correct abliteration.ai base URL", () => {
		new AbliterationHandler({ abliterationApiKey: "test-abliteration-api-key" })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://api.abliteration.ai/v1" }))
	})

	it("should use the provided API key", () => {
		const abliterationApiKey = "test-abliteration-api-key"
		new AbliterationHandler({ abliterationApiKey })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: abliterationApiKey }))
	})

	it("should throw error when API key is not provided", () => {
		expect(() => new AbliterationHandler({})).toThrow("API key is required")
	})

	it("should return default model when no model is specified", () => {
		const model = handler.getModel()
		expect(model.id).toBe(abliterationDefaultModelId)
		expect(model.info).toEqual(abliterationModels[abliterationDefaultModelId])
	})

	it("should return specified model when valid model is provided", () => {
		const handlerWithModel = new AbliterationHandler({
			apiModelId: "abliterated-model",
			abliterationApiKey: "test-abliteration-api-key",
		})
		const model = handlerWithModel.getModel()
		expect(model.id).toBe("abliterated-model")
		expect(model.info).toEqual(abliterationModels["abliterated-model"])
	})

	it("completePrompt method should return text from abliteration.ai API", async () => {
		const expectedResponse = "This is a test response from abliteration.ai"
		mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: expectedResponse } }] })
		const result = await handler.completePrompt("test prompt")
		expect(result).toBe(expectedResponse)
	})

	it("createMessage should yield text content from stream", async () => {
		const testContent = "This is test content from abliteration.ai stream"

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

	it("createMessage should pass correct parameters to abliteration.ai client", async () => {
		const modelInfo = abliterationModels[abliterationDefaultModelId]
		const handlerWithModel = new AbliterationHandler({
			apiModelId: abliterationDefaultModelId,
			abliterationApiKey: "test-abliteration-api-key",
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

		const systemPrompt = "Test system prompt for abliteration.ai"
		const messages: Anthropic.Messages.MessageParam[] = [
			{ role: "user", content: "Test message for abliteration.ai" },
		]

		const messageGenerator = handlerWithModel.createMessage(systemPrompt, messages)
		await messageGenerator.next()

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: abliterationDefaultModelId,
				max_tokens: modelInfo.maxTokens,
				temperature: 0,
				messages: expect.arrayContaining([{ role: "system", content: systemPrompt }]),
				stream: true,
				stream_options: { include_usage: true },
			}),
			undefined,
		)
	})
})
