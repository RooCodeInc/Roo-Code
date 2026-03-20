// npx vitest api/providers/__tests__/xai.spec.ts

// Mock TelemetryService - must come before other imports
const mockCaptureException = vitest.hoisted(() => vitest.fn())
vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: mockCaptureException,
		},
	},
}))

const mockResponsesCreate = vitest.fn()

vitest.mock("openai", () => {
	const mockConstructor = vitest.fn()

	return {
		__esModule: true,
		default: mockConstructor.mockImplementation(() => ({
			responses: { create: mockResponsesCreate },
		})),
	}
})

import OpenAI from "openai"
import type { Anthropic } from "@anthropic-ai/sdk"

import { xaiDefaultModelId, xaiModels } from "@roo-code/types"

import { XAIHandler } from "../xai"

// Helper to create an async iterable from events
function mockStream(events: any[]) {
	return {
		[Symbol.asyncIterator]: () => {
			let index = 0
			return {
				async next() {
					if (index < events.length) {
						return { done: false, value: events[index++] }
					}
					return { done: true, value: undefined }
				},
			}
		},
	}
}

describe("XAIHandler", () => {
	let handler: XAIHandler

	beforeEach(() => {
		vi.clearAllMocks()
		mockResponsesCreate.mockClear()
		mockCaptureException.mockClear()
		handler = new XAIHandler({})
	})

	it("should use the correct X.AI base URL", () => {
		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://api.x.ai/v1",
			}),
		)
	})

	it("should use the provided API key", () => {
		vi.clearAllMocks()
		const xaiApiKey = "test-api-key"
		new XAIHandler({ xaiApiKey })
		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: xaiApiKey,
			}),
		)
	})

	it("should return default model when no model is specified", () => {
		const model = handler.getModel()
		expect(model.id).toBe(xaiDefaultModelId)
		expect(model.info).toEqual(xaiModels[xaiDefaultModelId])
	})

	it("should return specified model when valid model is provided", () => {
		const testModelId = "grok-3"
		const handlerWithModel = new XAIHandler({ apiModelId: testModelId })
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(xaiModels[testModelId])
	})

	it("should use Responses API (client.responses.create)", async () => {
		mockResponsesCreate.mockResolvedValueOnce(mockStream([]))

		const stream = handler.createMessage("test prompt", [])
		await stream.next()

		expect(mockResponsesCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: xaiDefaultModelId,
				instructions: "test prompt",
				stream: true,
				store: false,
				include: ["reasoning.encrypted_content"],
			}),
		)
	})

	it("createMessage should yield text content from stream", async () => {
		const testContent = "This is test content"

		mockResponsesCreate.mockResolvedValueOnce(
			mockStream([{ type: "response.output_text.delta", delta: testContent }]),
		)

		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual({
			type: "text",
			text: testContent,
		})
	})

	it("createMessage should yield reasoning content from stream", async () => {
		const testReasoning = "Test reasoning content"

		mockResponsesCreate.mockResolvedValueOnce(
			mockStream([{ type: "response.reasoning_text.delta", delta: testReasoning }]),
		)

		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual({
			type: "reasoning",
			text: testReasoning,
		})
	})

	it("createMessage should yield usage data from response.completed", async () => {
		mockResponsesCreate.mockResolvedValueOnce(
			mockStream([
				{
					type: "response.completed",
					response: {
						usage: {
							input_tokens: 10,
							output_tokens: 20,
							input_tokens_details: { cached_tokens: 5 },
							output_tokens_details: { reasoning_tokens: 8 },
						},
					},
				},
			]),
		)

		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual(
			expect.objectContaining({
				type: "usage",
				inputTokens: 10,
				outputTokens: 20,
				cacheReadTokens: 5,
				reasoningTokens: 8,
			}),
		)
	})

	it("createMessage should yield tool_call from output_item.done", async () => {
		mockResponsesCreate.mockResolvedValueOnce(
			mockStream([
				{
					type: "response.output_item.done",
					item: {
						type: "function_call",
						call_id: "call_123",
						name: "test_tool",
						arguments: '{"arg1":"value"}',
					},
				},
			]),
		)

		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual({
			type: "tool_call",
			id: "call_123",
			name: "test_tool",
			arguments: '{"arg1":"value"}',
		})
	})

	it("should include tools in Responses API format", async () => {
		const testTools = [
			{
				type: "function" as const,
				function: {
					name: "test_tool",
					description: "A test tool",
					parameters: { type: "object", properties: { arg1: { type: "string" } }, required: ["arg1"] },
				},
			},
		]

		mockResponsesCreate.mockResolvedValueOnce(mockStream([]))

		const stream = handler.createMessage("test prompt", [], {
			taskId: "test-task-id",
			tools: testTools,
		})
		await stream.next()

		expect(mockResponsesCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: [
					expect.objectContaining({
						type: "function",
						name: "test_tool",
						description: "A test tool",
						strict: true,
					}),
				],
				tool_choice: "auto",
				parallel_tool_calls: true,
			}),
		)
	})

	it("completePrompt should return text from Responses API", async () => {
		const expectedResponse = "This is a test response"
		mockResponsesCreate.mockResolvedValueOnce({
			output: [
				{
					type: "message",
					content: [{ type: "output_text", text: expectedResponse }],
				},
			],
		})

		const result = await handler.completePrompt("test prompt")
		expect(result).toBe(expectedResponse)
	})

	it("should handle errors in completePrompt", async () => {
		const errorMessage = "API error"
		mockResponsesCreate.mockRejectedValueOnce(new Error(errorMessage))

		await expect(handler.completePrompt("test prompt")).rejects.toThrow(`xAI completion error: ${errorMessage}`)
	})

	it("should handle errors in createMessage", async () => {
		const errorMessage = "Stream error"
		mockResponsesCreate.mockRejectedValueOnce(new Error(errorMessage))

		const stream = handler.createMessage("test prompt", [])
		await expect(stream.next()).rejects.toThrow(`xAI completion error: ${errorMessage}`)
	})
})
