// npx vitest run src/api/providers/__tests__/vertex-gemini-urlcontext.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import { GeminiHandler } from "../gemini"
import { VertexHandler } from "../vertex"

describe("Vertex vs Gemini urlContext handling", () => {
	describe("GeminiHandler", () => {
		it("should include urlContext tool when enableUrlContext is true", async () => {
			const mockGenerateContentStream = vitest.fn()

			const handler = new GeminiHandler({
				geminiApiKey: "test-key",
				apiModelId: "gemini-1.5-flash",
				enableUrlContext: true,
			})

			// Replace the client with our mock
			handler["client"] = {
				models: {
					generateContentStream: mockGenerateContentStream,
				},
			} as any

			// Setup mock to return an async generator
			mockGenerateContentStream.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Test response" }
					yield { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
				},
			})

			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage("System prompt", messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify that generateContentStream was called with urlContext in tools
			expect(mockGenerateContentStream).toHaveBeenCalledWith(
				expect.objectContaining({
					config: expect.objectContaining({
						tools: expect.arrayContaining([{ urlContext: {} }]),
					}),
				}),
			)
		})

		it("should not include urlContext tool when enableUrlContext is false", async () => {
			const mockGenerateContentStream = vitest.fn()

			const handler = new GeminiHandler({
				geminiApiKey: "test-key",
				apiModelId: "gemini-1.5-flash",
				enableUrlContext: false,
			})

			// Replace the client with our mock
			handler["client"] = {
				models: {
					generateContentStream: mockGenerateContentStream,
				},
			} as any

			// Setup mock to return an async generator
			mockGenerateContentStream.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Test response" }
					yield { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
				},
			})

			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage("System prompt", messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify that generateContentStream was called without urlContext in tools
			expect(mockGenerateContentStream).toHaveBeenCalledWith(
				expect.objectContaining({
					config: expect.not.objectContaining({
						tools: expect.anything(),
					}),
				}),
			)
		})

		it("should include urlContext in completePrompt when enableUrlContext is true", async () => {
			const mockGenerateContent = vitest.fn()

			const handler = new GeminiHandler({
				geminiApiKey: "test-key",
				apiModelId: "gemini-1.5-flash",
				enableUrlContext: true,
			})

			// Replace the client with our mock
			handler["client"] = {
				models: {
					generateContent: mockGenerateContent,
				},
			} as any

			// Mock the response
			mockGenerateContent.mockResolvedValue({
				text: "Test response",
			})

			await handler.completePrompt("Test prompt")

			// Verify that generateContent was called with urlContext in tools
			expect(mockGenerateContent).toHaveBeenCalledWith(
				expect.objectContaining({
					config: expect.objectContaining({
						tools: expect.arrayContaining([{ urlContext: {} }]),
					}),
				}),
			)
		})
	})

	describe("VertexHandler", () => {
		it("should NOT include urlContext tool even when enableUrlContext is true", async () => {
			const mockGenerateContentStream = vitest.fn()

			const handler = new VertexHandler({
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				apiModelId: "gemini-1.5-pro-001",
				enableUrlContext: true, // This should be ignored for Vertex
			})

			// Replace the client with our mock
			handler["client"] = {
				models: {
					generateContentStream: mockGenerateContentStream,
				},
			} as any

			// Setup mock to return an async generator
			mockGenerateContentStream.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Test response" }
					yield { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
				},
			})

			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage("System prompt", messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify that generateContentStream was called WITHOUT urlContext in tools
			// even though enableUrlContext was true
			const callArgs = mockGenerateContentStream.mock.calls[0][0]
			if (callArgs.config.tools) {
				// If tools array exists, it should not contain urlContext
				expect(callArgs.config.tools).not.toContainEqual({ urlContext: {} })
			}
		})

		it("should NOT include urlContext in completePrompt even when enableUrlContext is true", async () => {
			const mockGenerateContent = vitest.fn()

			const handler = new VertexHandler({
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				apiModelId: "gemini-1.5-pro-001",
				enableUrlContext: true, // This should be ignored for Vertex
			})

			// Replace the client with our mock
			handler["client"] = {
				models: {
					generateContent: mockGenerateContent,
				},
			} as any

			// Mock the response
			mockGenerateContent.mockResolvedValue({
				text: "Test response",
			})

			await handler.completePrompt("Test prompt")

			// Verify that generateContent was called WITHOUT urlContext in tools
			const callArgs = mockGenerateContent.mock.calls[0][0]
			if (callArgs.config.tools) {
				// If tools array exists, it should not contain urlContext
				expect(callArgs.config.tools).not.toContainEqual({ urlContext: {} })
			}
		})

		it("should still include googleSearch tool when enableGrounding is true", async () => {
			const mockGenerateContentStream = vitest.fn()

			const handler = new VertexHandler({
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				apiModelId: "gemini-1.5-pro-001",
				enableUrlContext: true, // Should be ignored
				enableGrounding: true, // Should be respected
			})

			// Replace the client with our mock
			handler["client"] = {
				models: {
					generateContentStream: mockGenerateContentStream,
				},
			} as any

			// Setup mock to return an async generator
			mockGenerateContentStream.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Test response" }
					yield { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
				},
			})

			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage("System prompt", messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify that googleSearch is included but urlContext is not
			const callArgs = mockGenerateContentStream.mock.calls[0][0]
			expect(callArgs.config.tools).toContainEqual({ googleSearch: {} })
			expect(callArgs.config.tools).not.toContainEqual({ urlContext: {} })
		})
	})

	describe("Integration test - switching between providers", () => {
		it("should correctly handle urlContext based on provider type", async () => {
			const mockGenerateContentStream = vitest.fn()

			// Setup mock to return an async generator
			mockGenerateContentStream.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Test response" }
					yield { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
				},
			})

			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			// Test with Gemini handler
			const geminiHandler = new GeminiHandler({
				geminiApiKey: "test-key",
				apiModelId: "gemini-1.5-flash",
				enableUrlContext: true,
			})
			geminiHandler["client"] = {
				models: { generateContentStream: mockGenerateContentStream },
			} as any

			const geminiStream = geminiHandler.createMessage("System prompt", messages)
			for await (const chunk of geminiStream) {
				// Consume stream
			}

			// Verify Gemini includes urlContext
			const geminiCall = mockGenerateContentStream.mock.calls[mockGenerateContentStream.mock.calls.length - 1][0]
			expect(geminiCall.config.tools).toContainEqual({ urlContext: {} })

			// Clear mock calls
			mockGenerateContentStream.mockClear()

			// Test with Vertex handler using same options
			const vertexHandler = new VertexHandler({
				vertexProjectId: "test-project",
				vertexRegion: "us-central1",
				apiModelId: "gemini-1.5-pro-001",
				enableUrlContext: true, // Same setting, but should be ignored
			})
			vertexHandler["client"] = {
				models: { generateContentStream: mockGenerateContentStream },
			} as any

			const vertexStream = vertexHandler.createMessage("System prompt", messages)
			for await (const chunk of vertexStream) {
				// Consume stream
			}

			// Verify Vertex does NOT include urlContext
			const vertexCall = mockGenerateContentStream.mock.calls[0][0]
			if (vertexCall.config.tools) {
				expect(vertexCall.config.tools).not.toContainEqual({ urlContext: {} })
			}
		})
	})
})
