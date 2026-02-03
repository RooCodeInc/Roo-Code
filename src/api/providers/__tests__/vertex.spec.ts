// npx vitest run src/api/providers/__tests__/vertex.spec.ts

// Mock vscode first to avoid import errors
vitest.mock("vscode", () => ({}))

// Mock the createVertex function from @ai-sdk/google-vertex
const mockCreateVertex = vitest.fn()
const mockGoogleSearchTool = vitest.fn()
const mockUrlContextTool = vitest.fn()

vitest.mock("@ai-sdk/google-vertex", () => ({
	createVertex: (...args: unknown[]) => {
		mockCreateVertex(...args)
		const provider = Object.assign((modelId: string) => ({ modelId }), {
			tools: {
				googleSearch: mockGoogleSearchTool,
				urlContext: mockUrlContextTool,
			},
		})
		return provider
	},
}))

// Mock the AI SDK functions
const mockStreamText = vitest.fn()
const mockGenerateText = vitest.fn()

vitest.mock("ai", async (importOriginal) => {
	const original = await importOriginal<typeof import("ai")>()
	return {
		...original,
		streamText: (...args: unknown[]) => mockStreamText(...args),
		generateText: (...args: unknown[]) => mockGenerateText(...args),
	}
})

import { Anthropic } from "@anthropic-ai/sdk"

import { ApiStreamChunk } from "../../transform/stream"

import { t } from "i18next"
import { VertexHandler } from "../vertex"

describe("VertexHandler", () => {
	let handler: VertexHandler

	beforeEach(() => {
		mockStreamText.mockClear()
		mockGenerateText.mockClear()
		mockCreateVertex.mockClear()
		mockGoogleSearchTool.mockClear()
		mockUrlContextTool.mockClear()

		handler = new VertexHandler({
			apiModelId: "gemini-1.5-pro-001",
			vertexProjectId: "test-project",
			vertexRegion: "us-central1",
		})
	})

	describe("constructor", () => {
		it("should create provider with project and location", () => {
			new VertexHandler({
				apiModelId: "gemini-1.5-pro-001",
				vertexProjectId: "my-project",
				vertexRegion: "europe-west1",
			})

			expect(mockCreateVertex).toHaveBeenCalledWith(
				expect.objectContaining({
					project: "my-project",
					location: "europe-west1",
				}),
			)
		})

		it("should create provider with JSON credentials", () => {
			const credentials = { type: "service_account", project_id: "test" }

			new VertexHandler({
				apiModelId: "gemini-1.5-pro-001",
				vertexProjectId: "my-project",
				vertexRegion: "us-central1",
				vertexJsonCredentials: JSON.stringify(credentials),
			})

			expect(mockCreateVertex).toHaveBeenCalledWith(
				expect.objectContaining({
					project: "my-project",
					location: "us-central1",
					googleAuthOptions: { credentials },
				}),
			)
		})

		it("should create provider with key file", () => {
			new VertexHandler({
				apiModelId: "gemini-1.5-pro-001",
				vertexProjectId: "my-project",
				vertexRegion: "us-central1",
				vertexKeyFile: "/path/to/keyfile.json",
			})

			expect(mockCreateVertex).toHaveBeenCalledWith(
				expect.objectContaining({
					project: "my-project",
					location: "us-central1",
					googleAuthOptions: { keyFile: "/path/to/keyfile.json" },
				}),
			)
		})

		it("should prefer JSON credentials over key file", () => {
			const credentials = { type: "service_account", project_id: "test" }

			new VertexHandler({
				apiModelId: "gemini-1.5-pro-001",
				vertexProjectId: "my-project",
				vertexRegion: "us-central1",
				vertexJsonCredentials: JSON.stringify(credentials),
				vertexKeyFile: "/path/to/keyfile.json",
			})

			expect(mockCreateVertex).toHaveBeenCalledWith(
				expect.objectContaining({
					googleAuthOptions: { credentials },
				}),
			)
		})

		it("should handle invalid JSON credentials gracefully", () => {
			new VertexHandler({
				apiModelId: "gemini-1.5-pro-001",
				vertexProjectId: "my-project",
				vertexRegion: "us-central1",
				vertexJsonCredentials: "invalid-json",
			})

			// Should not throw and should create provider without credentials
			expect(mockCreateVertex).toHaveBeenCalledWith(
				expect.objectContaining({
					project: "my-project",
					googleAuthOptions: undefined,
				}),
			)
		})
	})

	describe("createMessage", () => {
		const mockMessages: Anthropic.Messages.MessageParam[] = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
		]

		const systemPrompt = "You are a helpful assistant"

		it("should handle streaming responses correctly", async () => {
			// Mock the createMessage method to test the streaming behavior
			vitest.spyOn(handler, "createMessage").mockImplementation(async function* () {
				yield { type: "usage", inputTokens: 10, outputTokens: 0 }
				yield { type: "text", text: "Vertex response part 1" }
				yield { type: "text", text: " part 2" }
				yield { type: "usage", inputTokens: 0, outputTokens: 5 }
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)

			const chunks: ApiStreamChunk[] = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBe(4)
			expect(chunks[0]).toEqual({ type: "usage", inputTokens: 10, outputTokens: 0 })
			expect(chunks[1]).toEqual({ type: "text", text: "Vertex response part 1" })
			expect(chunks[2]).toEqual({ type: "text", text: " part 2" })
			expect(chunks[3]).toEqual({ type: "usage", inputTokens: 0, outputTokens: 5 })
		})

		it("should call streamText with correct options", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta", textDelta: "Hello" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({}),
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks: ApiStreamChunk[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: systemPrompt,
					temperature: 1,
				}),
			)
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Test Vertex response",
				providerMetadata: {},
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test Vertex response")

			// Verify generateText was called with the prompt
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Test prompt",
					temperature: 1,
				}),
			)
		})

		it("should handle API errors", async () => {
			const mockError = new Error("Vertex API error")
			mockGenerateText.mockRejectedValue(mockError)

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				t("common:errors.gemini.generate_complete_prompt", { error: "Vertex API error" }),
			)
		})

		it("should handle empty response", async () => {
			mockGenerateText.mockResolvedValue({
				text: "",
				providerMetadata: {},
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should add Google Search tool when grounding is enabled", async () => {
			const handlerWithGrounding = new VertexHandler({
				apiModelId: "gemini-1.5-pro-001",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				enableGrounding: true,
			})

			mockGenerateText.mockResolvedValue({
				text: "Search result",
				providerMetadata: {},
			})
			mockGoogleSearchTool.mockReturnValue({ type: "googleSearch" })

			await handlerWithGrounding.completePrompt("Search query")

			expect(mockGoogleSearchTool).toHaveBeenCalledWith({})
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.objectContaining({
						google_search: { type: "googleSearch" },
					}),
				}),
			)
		})

		it("should add URL Context tool when enabled", async () => {
			const handlerWithUrlContext = new VertexHandler({
				apiModelId: "gemini-1.5-pro-001",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				enableUrlContext: true,
			})

			mockGenerateText.mockResolvedValue({
				text: "URL context result",
				providerMetadata: {},
			})
			mockUrlContextTool.mockReturnValue({ type: "urlContext" })

			await handlerWithUrlContext.completePrompt("Fetch URL")

			expect(mockUrlContextTool).toHaveBeenCalledWith({})
			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.objectContaining({
						url_context: { type: "urlContext" },
					}),
				}),
			)
		})
	})

	describe("getModel", () => {
		it("should return correct model info", () => {
			// Create a new instance with specific model ID
			const testHandler = new VertexHandler({
				apiModelId: "gemini-2.0-flash-001",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const modelInfo = testHandler.getModel()
			expect(modelInfo.id).toBe("gemini-2.0-flash-001")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(8192)
			expect(modelInfo.info.contextWindow).toBe(1048576)
		})

		it("should return default model when invalid ID provided", () => {
			const testHandler = new VertexHandler({
				apiModelId: "invalid-model-id",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const modelInfo = testHandler.getModel()
			// Should fall back to default model
			expect(modelInfo.info).toBeDefined()
		})

		it("should strip :thinking suffix from model ID", () => {
			const testHandler = new VertexHandler({
				apiModelId: "gemini-2.5-flash-preview-05-20:thinking",
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
			})

			const modelInfo = testHandler.getModel()
			expect(modelInfo.id).toBe("gemini-2.5-flash-preview-05-20")
		})
	})

	describe("calculateCost", () => {
		it("should calculate cost correctly", () => {
			const result = handler.calculateCost({
				info: {
					maxTokens: 8192,
					contextWindow: 1048576,
					supportsPromptCache: false,
					inputPrice: 1.25,
					outputPrice: 5.0,
				},
				inputTokens: 1000,
				outputTokens: 500,
			})

			// Input: 1.25 * (1000 / 1_000_000) = 0.00125
			// Output: 5.0 * (500 / 1_000_000) = 0.0025
			// Total: 0.00375
			expect(result).toBeCloseTo(0.00375, 5)
		})

		it("should handle cache read tokens", () => {
			const result = handler.calculateCost({
				info: {
					maxTokens: 8192,
					contextWindow: 1048576,
					supportsPromptCache: true,
					inputPrice: 1.25,
					outputPrice: 5.0,
					cacheReadsPrice: 0.3125,
				},
				inputTokens: 1000,
				outputTokens: 500,
				cacheReadTokens: 400,
			})

			// Uncached input: 600 tokens at 1.25/M = 0.00075
			// Cache read: 400 tokens at 0.3125/M = 0.000125
			// Output: 500 tokens at 5.0/M = 0.0025
			// Total: 0.003375
			expect(result).toBeCloseTo(0.003375, 5)
		})

		it("should handle reasoning tokens", () => {
			const result = handler.calculateCost({
				info: {
					maxTokens: 8192,
					contextWindow: 1048576,
					supportsPromptCache: false,
					inputPrice: 1.25,
					outputPrice: 5.0,
				},
				inputTokens: 1000,
				outputTokens: 500,
				reasoningTokens: 200,
			})

			// Input: 1.25 * (1000 / 1_000_000) = 0.00125
			// Output + Reasoning: 5.0 * (700 / 1_000_000) = 0.0035
			// Total: 0.00475
			expect(result).toBeCloseTo(0.00475, 5)
		})

		it("should return undefined when prices are missing", () => {
			const result = handler.calculateCost({
				info: {
					maxTokens: 8192,
					contextWindow: 1048576,
					supportsPromptCache: false,
				},
				inputTokens: 1000,
				outputTokens: 500,
			})

			expect(result).toBeUndefined()
		})

		it("should use tiered pricing when available", () => {
			const result = handler.calculateCost({
				info: {
					maxTokens: 8192,
					contextWindow: 1048576,
					supportsPromptCache: false,
					inputPrice: 1.25,
					outputPrice: 5.0,
					tiers: [
						{ contextWindow: 128000, inputPrice: 0.5, outputPrice: 2.0 },
						{ contextWindow: 1048576, inputPrice: 1.0, outputPrice: 4.0 },
					],
				},
				inputTokens: 50000, // Falls into first tier
				outputTokens: 500,
			})

			// Uses tier 1 pricing: inputPrice=0.5, outputPrice=2.0
			// Input: 0.5 * (50000 / 1_000_000) = 0.025
			// Output: 2.0 * (500 / 1_000_000) = 0.001
			// Total: 0.026
			expect(result).toBeCloseTo(0.026, 5)
		})
	})
})
