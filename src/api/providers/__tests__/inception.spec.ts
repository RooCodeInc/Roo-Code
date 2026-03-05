// Mocks must come first, before imports
const mockCreate = vi.fn()
vi.mock("openai", () => {
	return {
		__esModule: true,
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate.mockImplementation(async (options) => {
						if (!options.stream) {
							return {
								id: "test-completion",
								choices: [
									{
										message: { role: "assistant", content: "Test response", refusal: null },
										finish_reason: "stop",
										index: 0,
									},
								],
								usage: {
									prompt_tokens: 10,
									completion_tokens: 5,
									total_tokens: 15,
									cached_tokens: 2,
								},
							}
						}

						// Return async iterator for streaming
						return {
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
										cached_tokens: 2,
									},
								}
							},
						}
					}),
				},
			},
		})),
	}
})

import OpenAI from "openai"
import type { Anthropic } from "@anthropic-ai/sdk"

import { inceptionDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"
import { InceptionHandler } from "../inception"

describe("InceptionHandler", () => {
	let handler: InceptionHandler
	let options: ApiHandlerOptions

	beforeEach(() => {
		vi.clearAllMocks()
		options = {
			inceptionApiKey: "test-api-key",
			apiModelId: inceptionDefaultModelId,
		}
		handler = new InceptionHandler(options)
	})

	describe("constructor", () => {
		it("should initialize with default model", () => {
			const model = handler.getModel()
			expect(model.id).toBe(inceptionDefaultModelId)
		})

		it("should use custom base URL if provided", () => {
			const customOptions = {
				...options,
				inceptionBaseUrl: "https://custom.api.url/v1",
			}
			const customHandler = new InceptionHandler(customOptions)
			expect(customHandler).toBeDefined()
		})
	})

	describe("getModel", () => {
		it("should return model info for mercury-2", () => {
			const model = handler.getModel()
			expect(model.id).toBe("mercury-2")
			expect(model.info.maxTokens).toBe(10_000)
			expect(model.info.contextWindow).toBe(128_000)
		})

		it("should return model info for mercury-edit", () => {
			const editOptions = {
				...options,
				apiModelId: "mercury-edit",
			}
			const editHandler = new InceptionHandler(editOptions)
			const model = editHandler.getModel()
			expect(model.id).toBe("mercury-edit")
			expect(model.info.maxTokens).toBe(1_000)
			expect(model.info.contextWindow).toBe(32_000)
		})
	})

	describe("createMessage", () => {
		it("should create a message and yield text chunks", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: "Hello",
				},
			]

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: string[] = []

			for await (const chunk of stream) {
				if (chunk.type === "text") {
					chunks.push(chunk.text)
				}
			}

			expect(mockCreate).toHaveBeenCalled()
			expect(chunks.join("")).toContain("Test response")
		})

		it("should handle streaming messages", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: "Hello",
				},
			]

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: string[] = []

			for await (const chunk of stream) {
				if (chunk.type === "text") {
					chunks.push(chunk.text)
				}
			}

			expect(chunks).toContain("Test response")
		})
	})
})
