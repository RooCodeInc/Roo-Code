import type { RooMessage } from "../../../core/task-persistence/rooMessage"
import { describe, it, expect, beforeEach } from "vitest"

import type { Anthropic } from "@anthropic-ai/sdk"

import { minimaxDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"
import type { ApiStream, ApiStreamChunk } from "../../transform/stream"
import { MiniMaxHandler } from "../minimax"

const {
	mockStreamText,
	mockGenerateText,
	mockCreateAnthropic,
	mockModel,
	mockMergeEnvironmentDetailsForMiniMax,
	mockHandleAiSdkError,
} = vi.hoisted(() => {
	const mockModel = vi.fn().mockReturnValue("mock-model-instance")
	return {
		mockStreamText: vi.fn(),
		mockGenerateText: vi.fn(),
		mockCreateAnthropic: vi.fn().mockReturnValue(mockModel),
		mockModel,
		mockMergeEnvironmentDetailsForMiniMax: vi.fn((messages: RooMessage[]) => messages),
		mockHandleAiSdkError: vi.fn((error: unknown, providerName: string) => {
			const message = error instanceof Error ? error.message : String(error)
			return new Error(`${providerName}: ${message}`)
		}),
	}
})

vi.mock("ai", () => ({
	streamText: mockStreamText,
	generateText: mockGenerateText,
}))

vi.mock("@ai-sdk/anthropic", () => ({
	createAnthropic: mockCreateAnthropic,
}))

vi.mock("../../transform/minimax-format", () => ({
	mergeEnvironmentDetailsForMiniMax: mockMergeEnvironmentDetailsForMiniMax,
}))

vi.mock("../../transform/ai-sdk", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../transform/ai-sdk")>()
	return {
		...actual,
		handleAiSdkError: mockHandleAiSdkError,
	}
})

type HandlerOptions = Omit<Partial<ApiHandlerOptions>, "minimaxBaseUrl"> & {
	minimaxBaseUrl?: string
}

function createHandler(options: HandlerOptions = {}) {
	return new MiniMaxHandler({
		minimaxApiKey: "test-api-key",
		...options,
	} as ApiHandlerOptions)
}

function createMockStream(
	chunks: Array<Record<string, unknown>>,
	usage: { inputTokens?: number; outputTokens?: number } = { inputTokens: 10, outputTokens: 5 },
	providerMetadata: Record<string, Record<string, unknown>> = {
		anthropic: {
			cacheReadInputTokens: 0,
			cacheCreationInputTokens: 0,
		},
	},
) {
	const stream = (async function* () {
		for (const chunk of chunks) {
			yield chunk
		}
	})()

	return {
		fullStream: stream,
		usage: Promise.resolve(usage),
		providerMetadata: Promise.resolve(providerMetadata),
		response: Promise.resolve({ headers: new Headers() }),
	}
}

async function collectChunks(stream: ApiStream): Promise<ApiStreamChunk[]> {
	const chunks: ApiStreamChunk[] = []
	for await (const chunk of stream) {
		chunks.push(chunk)
	}
	return chunks
}

describe("MiniMaxHandler", () => {
	const systemPrompt = "You are a helpful assistant."
	const messages: RooMessage[] = [
		{
			role: "user",
			content: [{ type: "text", text: "Hello" }],
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()
		mockCreateAnthropic.mockReturnValue(mockModel)
		mockMergeEnvironmentDetailsForMiniMax.mockImplementation((inputMessages: RooMessage[]) => inputMessages)
		mockHandleAiSdkError.mockImplementation((error: unknown, providerName: string) => {
			const message = error instanceof Error ? error.message : String(error)
			return new Error(`${providerName}: ${message}`)
		})
	})

	describe("constructor", () => {
		it("uses default base URL when no baseUrl is provided", () => {
			createHandler()
			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.minimax.io/anthropic/v1",
				}),
			)
		})

		it("converts /v1 base URL to /anthropic/v1", () => {
			createHandler({
				minimaxBaseUrl: "https://api.minimax.io/v1",
			})

			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.minimax.io/anthropic/v1",
				}),
			)
		})

		it("appends /v1 for base URL already ending with /anthropic", () => {
			createHandler({
				minimaxBaseUrl: "https://api.minimax.io/anthropic",
			})

			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.minimax.io/anthropic/v1",
				}),
			)
		})

		it("appends /anthropic/v1 when base URL has no suffix", () => {
			createHandler({
				minimaxBaseUrl: "https://api.minimax.io/custom",
			})

			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.minimax.io/custom/anthropic/v1",
				}),
			)
		})

		it("supports the China endpoint", () => {
			createHandler({
				minimaxBaseUrl: "https://api.minimaxi.com/anthropic",
			})

			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.minimaxi.com/anthropic/v1",
				}),
			)
		})

		it("treats empty baseUrl as falsy and falls back to default", () => {
			createHandler({
				minimaxBaseUrl: "",
			})

			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.minimax.io/anthropic/v1",
				}),
			)
		})

		it("passes API key through to createAnthropic", () => {
			createHandler({
				minimaxApiKey: "minimax-key-123",
			})

			expect(mockCreateAnthropic).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "minimax-key-123",
				}),
			)
		})
	})

	describe("getModel", () => {
		it("returns default model when no model ID is specified", () => {
			const handler = createHandler()
			const model = handler.getModel()
			expect(model.id).toBe("MiniMax-M2")
			expect(model.temperature).toBe(1)
		})

		it("returns specified model when valid model ID is provided", () => {
			const handler = createHandler({
				apiModelId: "MiniMax-M2-Stable",
			})
			const model = handler.getModel()
			expect(model.id).toBe("MiniMax-M2-Stable")
		})

		it("falls back to default model when unknown model ID is provided", () => {
			const handler = createHandler({
				apiModelId: "unknown-model",
			})
			const model = handler.getModel()
			expect(model.id).toBe(minimaxDefaultModelId)
		})
	})

	describe("createMessage", () => {
		it("streams text chunks and calls streamText with expected params", async () => {
			mockStreamText.mockReturnValue(
				createMockStream([
					{ type: "text-delta", text: "Hello" },
					{ type: "text-delta", text: " world" },
				]),
			)

			const handler = createHandler()
			const chunks = await collectChunks(handler.createMessage(systemPrompt, messages))

			expect(mockModel).toHaveBeenCalledWith("MiniMax-M2")
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "mock-model-instance",
					system: systemPrompt,
					temperature: 1,
					messages: expect.any(Array),
				}),
			)

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0]).toEqual({ type: "text", text: "Hello" })
			expect(textChunks[1]).toEqual({ type: "text", text: " world" })
		})

		it("streams reasoning chunks", async () => {
			mockStreamText.mockReturnValue(
				createMockStream([
					{ type: "reasoning", text: "thinking..." },
					{ type: "reasoning", text: " step 2" },
				]),
			)

			const handler = createHandler()
			const chunks = await collectChunks(handler.createMessage(systemPrompt, messages))

			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			expect(reasoningChunks).toHaveLength(2)
			expect(reasoningChunks[0]).toEqual({ type: "reasoning", text: "thinking..." })
			expect(reasoningChunks[1]).toEqual({ type: "reasoning", text: " step 2" })
		})

		it("streams tool call chunks", async () => {
			mockStreamText.mockReturnValue(
				createMockStream([
					{ type: "tool-input-start", id: "call_1", toolName: "read_file" },
					{ type: "tool-input-delta", id: "call_1", delta: '{"path":"a.ts"}' },
					{ type: "tool-input-end", id: "call_1" },
				]),
			)

			const handler = createHandler()
			const chunks = await collectChunks(handler.createMessage(systemPrompt, messages))

			expect(chunks).toContainEqual({
				type: "tool_call_start",
				id: "call_1",
				name: "read_file",
			})
			expect(chunks).toContainEqual({
				type: "tool_call_delta",
				id: "call_1",
				delta: '{"path":"a.ts"}',
			})
			expect(chunks).toContainEqual({
				type: "tool_call_end",
				id: "call_1",
			})
		})

		it("yields usage chunk with token and cost information", async () => {
			mockStreamText.mockReturnValue(
				createMockStream(
					[{ type: "text-delta", text: "Done" }],
					{ inputTokens: 10, outputTokens: 5 },
					{
						anthropic: {
							cacheCreationInputTokens: 3,
							cacheReadInputTokens: 2,
						},
					},
				),
			)

			const handler = createHandler()
			const chunks = await collectChunks(handler.createMessage(systemPrompt, messages))
			const usageChunk = chunks.find((chunk) => chunk.type === "usage")

			expect(usageChunk).toMatchObject({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheWriteTokens: 3,
				cacheReadTokens: 2,
			})
			expect(typeof usageChunk?.totalCost).toBe("number")
		})

		it("calls mergeEnvironmentDetailsForMiniMax before conversion", async () => {
			const mergedMessages: RooMessage[] = [
				{
					role: "user",
					content: [{ type: "text", text: "Merged message" }],
				},
			]
			mockMergeEnvironmentDetailsForMiniMax.mockReturnValueOnce(mergedMessages)
			mockStreamText.mockReturnValue(createMockStream([{ type: "text-delta", text: "OK" }]))

			const handler = createHandler()
			await collectChunks(handler.createMessage(systemPrompt, messages))

			expect(mockMergeEnvironmentDetailsForMiniMax).toHaveBeenCalledWith(messages)
			const callArgs = mockStreamText.mock.calls[0]?.[0]
			// Cache control is now applied centrally in Task.ts, not per-provider
			expect(callArgs.messages).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						role: "user",
						content: [{ type: "text", text: "Merged message" }],
					}),
				]),
			)
		})

		it("handles errors via handleAiSdkError", async () => {
			mockStreamText.mockImplementation(() => {
				throw new Error("API Error")
			})

			const handler = createHandler()
			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				await collectChunks(stream)
			}).rejects.toThrow("MiniMax: API Error")
			expect(mockHandleAiSdkError).toHaveBeenCalledWith(expect.any(Error), "MiniMax")
		})
	})

	describe("completePrompt", () => {
		it("calls generateText with model and prompt and returns text", async () => {
			mockGenerateText.mockResolvedValue({ text: "response" })

			const handler = createHandler()
			const result = await handler.completePrompt("test prompt")

			expect(result).toBe("response")
			expect(mockModel).toHaveBeenCalledWith("MiniMax-M2")
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "mock-model-instance",
					prompt: "test prompt",
				}),
			)
		})
	})

	describe("isAiSdkProvider", () => {
		it("returns true", () => {
			const handler = createHandler()
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})
})
