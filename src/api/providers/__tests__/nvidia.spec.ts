// npx vitest run src/api/providers/__tests__/nvidia.spec.ts

import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"

import { type NvidiaModelId, nvidiaDefaultModelId, nvidiaModels } from "@roo-code/types"

import { NvidiaHandler } from "../nvidia"

vitest.mock("openai", () => {
	const createMock = vitest.fn()
	return {
		default: vitest.fn(() => ({ chat: { completions: { create: createMock } } })),
	}
})

describe("NvidiaHandler", () => {
	let handler: NvidiaHandler
	let mockCreate: any

	beforeEach(() => {
		vitest.clearAllMocks()
		mockCreate = (OpenAI as unknown as any)().chat.completions.create
		handler = new NvidiaHandler({ nvidiaApiKey: "test-nvidia-api-key" })
	})

	describe("Constructor", () => {
		it("should use the correct NVIDIA NIM base URL", () => {
			new NvidiaHandler({ nvidiaApiKey: "test-api-key" })
			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({ baseURL: "https://integrate.api.nvidia.com/v1" }),
			)
		})

		it("should use custom base URL when provided", () => {
			const customUrl = "https://custom.nvidia.endpoint/v1"
			new NvidiaHandler({ nvidiaApiKey: "test-api-key", nvidiaBaseUrl: customUrl })
			expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: customUrl }))
		})

		it("should use the provided API key", () => {
			const nvidiaApiKey = "test-nvidia-api-key"
			new NvidiaHandler({ nvidiaApiKey })
			expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: nvidiaApiKey }))
		})
	})

	describe("getModel", () => {
		it("should return default model when no model is specified", () => {
			const model = handler.getModel()
			expect(model.id).toBe(nvidiaDefaultModelId)
			expect(model.info).toEqual(nvidiaModels[nvidiaDefaultModelId])
		})

		it("should return specified model when valid model is provided", () => {
			const testModelId: NvidiaModelId = "deepseek-ai/deepseek-r1"
			const handlerWithModel = new NvidiaHandler({
				apiModelId: testModelId,
				nvidiaApiKey: "test-api-key",
			})
			const model = handlerWithModel.getModel()
			expect(model.id).toBe(testModelId)
			expect(model.info).toEqual(nvidiaModels[testModelId])
		})
	})

	describe("createMessage with reasoning", () => {
		it("should inject chat_template_kwargs when reasoning is enabled for reasoning-capable model", async () => {
			const handlerWithReasoning = new NvidiaHandler({
				nvidiaApiKey: "test-api-key",
				apiModelId: "deepseek-ai/deepseek-r1",
				enableReasoningEffort: true,
			})

			mockCreate.mockImplementationOnce(() => ({
				[Symbol.asyncIterator]: () => ({
					next: vitest.fn().mockResolvedValueOnce({ done: true }),
				}),
			}))

			const stream = handlerWithReasoning.createMessage("system prompt", [])
			await stream.next()

			// Verify chat_template_kwargs was injected
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					chat_template_kwargs: { enable_thinking: true, clear_thinking: false },
				}),
				undefined,
			)
		})

		it("should NOT inject chat_template_kwargs when reasoning is disabled", async () => {
			const handlerWithoutReasoning = new NvidiaHandler({
				nvidiaApiKey: "test-api-key",
				apiModelId: "deepseek-ai/deepseek-r1",
				enableReasoningEffort: false,
			})

			mockCreate.mockImplementationOnce(() => ({
				[Symbol.asyncIterator]: () => ({
					next: vitest.fn().mockResolvedValueOnce({ done: true }),
				}),
			}))

			const stream = handlerWithoutReasoning.createMessage("system prompt", [])
			await stream.next()

			// Verify chat_template_kwargs was NOT injected
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.chat_template_kwargs).toBeUndefined()
		})

		it("should NOT inject chat_template_kwargs for non-reasoning models even if enabled", async () => {
			const handlerWithNonReasoning = new NvidiaHandler({
				nvidiaApiKey: "test-api-key",
				apiModelId: "meta/llama-3.3-70b-instruct",
				enableReasoningEffort: true, // Even if enabled
			})

			mockCreate.mockImplementationOnce(() => ({
				[Symbol.asyncIterator]: () => ({
					next: vitest.fn().mockResolvedValueOnce({ done: true }),
				}),
			}))

			const stream = handlerWithNonReasoning.createMessage("system prompt", [])
			await stream.next()

			// Verify chat_template_kwargs was NOT injected (model doesn't support)
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.chat_template_kwargs).toBeUndefined()
		})
	})

	describe("createMessage yields content", () => {
		it("should yield text content from stream", async () => {
			const testContent = "This is test content from NVIDIA stream"

			mockCreate.mockImplementationOnce(() => ({
				[Symbol.asyncIterator]: () => ({
					next: vitest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: { choices: [{ delta: { content: testContent } }] },
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}))

			const stream = handler.createMessage("system prompt", [])
			const firstChunk = await stream.next()

			expect(firstChunk.done).toBe(false)
			expect(firstChunk.value).toEqual({ type: "text", text: testContent })
		})

		it("should yield reasoning_content from stream", async () => {
			const reasoningContent = "Chain of thought reasoning..."

			mockCreate.mockImplementationOnce(() => ({
				[Symbol.asyncIterator]: () => ({
					next: vitest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: { choices: [{ delta: { reasoning_content: reasoningContent } }] },
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}))

			const stream = handler.createMessage("system prompt", [])
			const firstChunk = await stream.next()

			expect(firstChunk.done).toBe(false)
			expect(firstChunk.value).toEqual({ type: "reasoning", text: reasoningContent })
		})
	})

	describe("completePrompt", () => {
		it("should return text from NVIDIA API", async () => {
			const expectedResponse = "This is a test response from NVIDIA"
			mockCreate.mockResolvedValueOnce({
				choices: [{ message: { content: expectedResponse } }],
			})

			const result = await handler.completePrompt("test prompt")
			expect(result).toBe(expectedResponse)
		})

		it("should inject chat_template_kwargs for reasoning models when enabled", async () => {
			const handlerWithReasoning = new NvidiaHandler({
				nvidiaApiKey: "test-api-key",
				apiModelId: "deepseek-ai/deepseek-r1",
				enableReasoningEffort: true,
			})

			mockCreate.mockResolvedValueOnce({
				choices: [{ message: { content: "response" } }],
			})

			await handlerWithReasoning.completePrompt("test")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					chat_template_kwargs: { enable_thinking: true, clear_thinking: false },
				}),
			)
		})

		it("should handle errors", async () => {
			const errorMessage = "NVIDIA API error"
			mockCreate.mockRejectedValueOnce(new Error(errorMessage))

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				`NVIDIA completion error: ${errorMessage}`,
			)
		})
	})
})
