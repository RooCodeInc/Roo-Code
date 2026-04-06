import type { Mock } from "vitest"
import { checkModelSupportsImages, IMAGE_CAPABLE_MODEL_PATTERNS, IMAGE_INCAPABLE_MODEL_PATTERNS } from "../vscode-lm"

// Mocks must come first, before imports
vi.mock("vscode", () => {
	class MockLanguageModelTextPart {
		type = "text"
		constructor(public value: string) {}
	}

	class MockLanguageModelToolCallPart {
		type = "tool_call"
		constructor(
			public callId: string,
			public name: string,
			public input: any,
		) {}
	}

	return {
		workspace: {
			onDidChangeConfiguration: vi.fn((_callback) => ({
				dispose: vi.fn(),
			})),
		},
		CancellationTokenSource: vi.fn(() => ({
			token: {
				isCancellationRequested: false,
				onCancellationRequested: vi.fn(),
			},
			cancel: vi.fn(),
			dispose: vi.fn(),
		})),
		CancellationError: class CancellationError extends Error {
			constructor() {
				super("Operation cancelled")
				this.name = "CancellationError"
			}
		},
		LanguageModelChatMessage: {
			Assistant: vi.fn((content) => ({
				role: "assistant",
				content: Array.isArray(content) ? content : [new MockLanguageModelTextPart(content)],
			})),
			User: vi.fn((content) => ({
				role: "user",
				content: Array.isArray(content) ? content : [new MockLanguageModelTextPart(content)],
			})),
		},
		LanguageModelTextPart: MockLanguageModelTextPart,
		LanguageModelToolCallPart: MockLanguageModelToolCallPart,
		lm: {
			selectChatModels: vi.fn(),
		},
	}
})

import * as vscode from "vscode"
import { VsCodeLmHandler } from "../vscode-lm"
import type { ApiHandlerOptions } from "../../../shared/api"
import type { Anthropic } from "@anthropic-ai/sdk"

const mockLanguageModelChat = {
	id: "test-model",
	name: "Test Model",
	vendor: "test-vendor",
	family: "test-family",
	version: "1.0",
	maxInputTokens: 4096,
	sendRequest: vi.fn(),
	countTokens: vi.fn(),
}

describe("VsCodeLmHandler", () => {
	let handler: VsCodeLmHandler
	const defaultOptions: ApiHandlerOptions = {
		vsCodeLmModelSelector: {
			vendor: "test-vendor",
			family: "test-family",
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		handler = new VsCodeLmHandler(defaultOptions)
	})

	afterEach(() => {
		handler.dispose()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeDefined()
			expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled()
		})

		it("should handle configuration changes", () => {
			const callback = (vscode.workspace.onDidChangeConfiguration as Mock).mock.calls[0][0]
			callback({ affectsConfiguration: () => true })
			// Should reset client when config changes
			expect(handler["client"]).toBeNull()
		})
	})

	describe("createClient", () => {
		it("should create client with selector", async () => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])

			const client = await handler["createClient"]({
				vendor: "test-vendor",
				family: "test-family",
			})

			expect(client).toBeDefined()
			expect(client.id).toBe("test-model")
			expect(vscode.lm.selectChatModels).toHaveBeenCalledWith({
				vendor: "test-vendor",
				family: "test-family",
			})
		})

		it("should return default client when no models available", async () => {
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([])

			const client = await handler["createClient"]({})

			expect(client).toBeDefined()
			expect(client.id).toBe("default-lm")
			expect(client.vendor).toBe("vscode")
		})
	})

	describe("createMessage", () => {
		beforeEach(() => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])
			mockLanguageModelChat.countTokens.mockResolvedValue(10)

			// Override the default client with our test client
			handler["client"] = mockLanguageModelChat
		})

		it("should stream text responses", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: "Hello",
				},
			]

			const responseText = "Hello! How can I help you?"
			mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
				stream: (async function* () {
					yield new vscode.LanguageModelTextPart(responseText)
					return
				})(),
				text: (async function* () {
					yield responseText
					return
				})(),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(2) // Text chunk + usage chunk
			expect(chunks[0]).toEqual({
				type: "text",
				text: responseText,
			})
			expect(chunks[1]).toMatchObject({
				type: "usage",
				inputTokens: expect.any(Number),
				outputTokens: expect.any(Number),
			})
		})

		it("should emit tool_call chunks when tools are provided", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: "Calculate 2+2",
				},
			]

			const toolCallData = {
				name: "calculator",
				arguments: { operation: "add", numbers: [2, 2] },
				callId: "call-1",
			}

			mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
				stream: (async function* () {
					yield new vscode.LanguageModelToolCallPart(
						toolCallData.callId,
						toolCallData.name,
						toolCallData.arguments,
					)
					return
				})(),
				text: (async function* () {
					yield JSON.stringify({ type: "tool_call", ...toolCallData })
					return
				})(),
			})

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "calculator",
						description: "A simple calculator",
						parameters: {
							type: "object",
							properties: {
								operation: { type: "string" },
								numbers: { type: "array", items: { type: "number" } },
							},
						},
					},
				},
			]

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools,
			})
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(2) // Tool call chunk + usage chunk
			expect(chunks[0]).toEqual({
				type: "tool_call",
				id: toolCallData.callId,
				name: toolCallData.name,
				arguments: JSON.stringify(toolCallData.arguments),
			})
		})

		it("should handle native tool calls when tools are provided", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: "Calculate 2+2",
				},
			]

			const toolCallData = {
				name: "calculator",
				arguments: { operation: "add", numbers: [2, 2] },
				callId: "call-1",
			}

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "calculator",
						description: "A simple calculator",
						parameters: {
							type: "object",
							properties: {
								operation: { type: "string" },
								numbers: { type: "array", items: { type: "number" } },
							},
						},
					},
				},
			]

			mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
				stream: (async function* () {
					yield new vscode.LanguageModelToolCallPart(
						toolCallData.callId,
						toolCallData.name,
						toolCallData.arguments,
					)
					return
				})(),
				text: (async function* () {
					yield JSON.stringify({ type: "tool_call", ...toolCallData })
					return
				})(),
			})

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools,
			})
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(2) // Tool call chunk + usage chunk
			expect(chunks[0]).toEqual({
				type: "tool_call",
				id: toolCallData.callId,
				name: toolCallData.name,
				arguments: JSON.stringify(toolCallData.arguments),
			})
		})

		it("should pass tools to request options when tools are provided", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: "Calculate 2+2",
				},
			]

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "calculator",
						description: "A simple calculator",
						parameters: {
							type: "object",
							properties: {
								operation: { type: "string" },
							},
						},
					},
				},
			]

			mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
				stream: (async function* () {
					yield new vscode.LanguageModelTextPart("Result: 4")
					return
				})(),
				text: (async function* () {
					yield "Result: 4"
					return
				})(),
			})

			const stream = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				tools,
			})
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify sendRequest was called with tools in options
			// Note: normalizeToolSchema adds additionalProperties: false for JSON Schema 2020-12 compliance
			expect(mockLanguageModelChat.sendRequest).toHaveBeenCalledWith(
				expect.any(Array),
				expect.objectContaining({
					tools: [
						{
							name: "calculator",
							description: "A simple calculator",
							inputSchema: {
								type: "object",
								properties: {
									operation: { type: "string" },
								},
								additionalProperties: false,
							},
						},
					],
				}),
				expect.anything(),
			)
		})

		it("should handle errors", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: "Hello",
				},
			]

			mockLanguageModelChat.sendRequest.mockRejectedValueOnce(new Error("API Error"))

			await expect(handler.createMessage(systemPrompt, messages).next()).rejects.toThrow("API Error")
		})
	})

	describe("getModel", () => {
		it("should return model info when client exists", async () => {
			const mockModel = { ...mockLanguageModelChat }
			// The handler starts async initialization in the constructor.
			// Make the test deterministic by explicitly (re)initializing here.
			;(vscode.lm.selectChatModels as Mock).mockResolvedValue([mockModel])
			handler["client"] = null
			await handler.initializeClient()

			const model = handler.getModel()
			expect(model.id).toBe("test-model")
			expect(model.info).toBeDefined()
			expect(model.info.contextWindow).toBe(4096)
		})

		it("should return fallback model info when no client exists", () => {
			// Clear the client first
			handler["client"] = null
			const model = handler.getModel()
			expect(model.id).toBe("test-vendor/test-family")
			expect(model.info).toBeDefined()
		})

		it("should return basic model info when client exists", async () => {
			const mockModel = { ...mockLanguageModelChat }
			// The handler starts async initialization in the constructor.
			// Make the test deterministic by explicitly (re)initializing here.
			;(vscode.lm.selectChatModels as Mock).mockResolvedValue([mockModel])
			handler["client"] = null
			await handler.initializeClient()

			const model = handler.getModel()
			expect(model.info).toBeDefined()
			expect(model.info.contextWindow).toBe(4096)
		})

		it("should return fallback model info when no client exists", () => {
			// Clear the client first
			handler["client"] = null
			const model = handler.getModel()
			expect(model.info).toBeDefined()
		})
	})

	describe("countTokens", () => {
		beforeEach(() => {
			handler["client"] = mockLanguageModelChat
		})

		it("should count tokens when called outside of an active request", async () => {
			// Ensure no active request cancellation token exists
			handler["currentRequestCancellation"] = null

			mockLanguageModelChat.countTokens.mockResolvedValueOnce(42)

			const content: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: "Hello world" }]
			const result = await handler.countTokens(content)

			expect(result).toBe(42)
			expect(mockLanguageModelChat.countTokens).toHaveBeenCalledWith("Hello world", expect.any(Object))
		})

		it("should count tokens when called during an active request", async () => {
			// Simulate an active request with a cancellation token
			const mockCancellation = {
				token: { isCancellationRequested: false, onCancellationRequested: vi.fn() },
				cancel: vi.fn(),
				dispose: vi.fn(),
			}
			handler["currentRequestCancellation"] = mockCancellation as any

			mockLanguageModelChat.countTokens.mockResolvedValueOnce(50)

			const content: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: "Test content" }]
			const result = await handler.countTokens(content)

			expect(result).toBe(50)
			expect(mockLanguageModelChat.countTokens).toHaveBeenCalledWith("Test content", mockCancellation.token)
		})

		it("should return 0 when no client is available", async () => {
			handler["client"] = null
			handler["currentRequestCancellation"] = null

			const content: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: "Hello" }]
			const result = await handler.countTokens(content)

			expect(result).toBe(0)
		})

		it("should handle image blocks with placeholder", async () => {
			handler["currentRequestCancellation"] = null
			mockLanguageModelChat.countTokens.mockResolvedValueOnce(5)

			const content: Anthropic.Messages.ContentBlockParam[] = [
				{ type: "image", source: { type: "base64", media_type: "image/png", data: "abc" } },
			]
			const result = await handler.countTokens(content)

			expect(result).toBe(5)
			expect(mockLanguageModelChat.countTokens).toHaveBeenCalledWith("[IMAGE]", expect.any(Object))
		})
	})

	describe("completePrompt", () => {
		it("should complete single prompt", async () => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])

			const responseText = "Completed text"
			mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
				stream: (async function* () {
					yield new vscode.LanguageModelTextPart(responseText)
					return
				})(),
				text: (async function* () {
					yield responseText
					return
				})(),
			})

			// Override the default client with our test client to ensure it uses
			// the mock implementation rather than the default fallback
			handler["client"] = mockLanguageModelChat

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe(responseText)
			expect(mockLanguageModelChat.sendRequest).toHaveBeenCalled()
		})

		it("should handle errors during completion", async () => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])

			mockLanguageModelChat.sendRequest.mockRejectedValueOnce(new Error("Completion failed"))

			// Make sure we're using the mock client
			handler["client"] = mockLanguageModelChat

			const promise = handler.completePrompt("Test prompt")
			await expect(promise).rejects.toThrow("VSCode LM completion error: Completion failed")
		})
	})
})

describe("checkModelSupportsImages", () => {
	describe("static vscodeLlmModels lookup", () => {
		it("should return supportsImages from static definitions when model family matches", () => {
			// Models in vscodeLlmModels should return their static supportsImages value
			expect(checkModelSupportsImages("gpt-3.5-turbo", "gpt-3.5-turbo")).toBe(false)
			expect(checkModelSupportsImages("gpt-4", "gpt-4")).toBe(false)
			expect(checkModelSupportsImages("gpt-4o-mini", "gpt-4o-mini")).toBe(false)
			expect(checkModelSupportsImages("gpt-4o", "gpt-4o")).toBe(true)
			expect(checkModelSupportsImages("gpt-4.1", "gpt-4.1")).toBe(true)
			expect(checkModelSupportsImages("gpt-5", "gpt-5")).toBe(true)
			expect(checkModelSupportsImages("gpt-5-mini", "gpt-5-mini")).toBe(true)
			expect(checkModelSupportsImages("o1", "o1")).toBe(false)
			expect(checkModelSupportsImages("o3-mini", "o3-mini")).toBe(false)
			expect(checkModelSupportsImages("o4-mini", "o4-mini")).toBe(false)
		})

		it("should return supportsImages from static definitions for claude models", () => {
			expect(checkModelSupportsImages("claude-3.5-sonnet", "claude-3.5-sonnet")).toBe(true)
			expect(checkModelSupportsImages("claude-4-sonnet", "claude-4-sonnet")).toBe(true)
		})

		it("should return supportsImages from static definitions for gemini models", () => {
			expect(checkModelSupportsImages("gemini-2.0-flash-001", "gemini-2.0-flash-001")).toBe(true)
			expect(checkModelSupportsImages("gemini-2.5-pro", "gemini-2.5-pro")).toBe(true)
		})
	})

	describe("pattern matching for unknown models", () => {
		it("should return true for gpt-4o (but not gpt-4o-mini)", () => {
			expect(checkModelSupportsImages("custom", "gpt-4o")).toBe(true)
			expect(checkModelSupportsImages("custom", "gpt-4o-mini")).toBe(false)
		})

		it("should return true for gpt-4.x and higher versions", () => {
			expect(checkModelSupportsImages("custom", "gpt-4.1-preview")).toBe(true)
			expect(checkModelSupportsImages("custom", "gpt-4.2")).toBe(true)
		})

		it("should return true for gpt-5 and higher (unknown variants)", () => {
			expect(checkModelSupportsImages("custom", "gpt-5-turbo")).toBe(true)
			expect(checkModelSupportsImages("custom", "gpt-6")).toBe(true)
		})

		it("should return true for all claude-* models", () => {
			expect(checkModelSupportsImages("custom", "claude-haiku-4.5")).toBe(true)
			expect(checkModelSupportsImages("custom", "claude-opus-4.5")).toBe(true)
			expect(checkModelSupportsImages("custom", "claude-sonnet-4")).toBe(true)
		})

		it("should return true for all gemini-* models", () => {
			expect(checkModelSupportsImages("custom", "gemini-2.5-pro")).toBe(true)
			expect(checkModelSupportsImages("custom", "gemini-3-flash-preview")).toBe(true)
		})
	})

	describe("non-vision models", () => {
		it("should return false for gpt-3.5 models", () => {
			expect(checkModelSupportsImages("custom", "gpt-3.5-turbo")).toBe(false)
			expect(checkModelSupportsImages("custom", "gpt-3.5-turbo-16k")).toBe(false)
		})

		it("should return false for base gpt-4 and gpt-4-* variants", () => {
			expect(checkModelSupportsImages("custom", "gpt-4")).toBe(false)
			expect(checkModelSupportsImages("custom", "gpt-4-0125-preview")).toBe(false)
			expect(checkModelSupportsImages("custom", "gpt-4-turbo")).toBe(false)
		})

		it("should return false for reasoning models (o1, o3-mini, o4-mini)", () => {
			expect(checkModelSupportsImages("custom", "o1")).toBe(false)
			expect(checkModelSupportsImages("custom", "o1-preview")).toBe(false)
			expect(checkModelSupportsImages("custom", "o1-mini")).toBe(false)
			expect(checkModelSupportsImages("custom", "o3-mini")).toBe(false)
			expect(checkModelSupportsImages("custom", "o4-mini")).toBe(false)
		})

		it("should return false for grok models", () => {
			expect(checkModelSupportsImages("custom", "grok-code-fast-1")).toBe(false)
			expect(checkModelSupportsImages("custom", "grok-2")).toBe(false)
		})

		it("should return false for unknown model families", () => {
			expect(checkModelSupportsImages("mistral", "mistral-large")).toBe(false)
			expect(checkModelSupportsImages("llama", "llama-3-70b")).toBe(false)
			expect(checkModelSupportsImages("unknown", "some-random-model")).toBe(false)
		})
	})

	describe("case insensitivity", () => {
		it("should match regardless of case for pattern matching", () => {
			expect(checkModelSupportsImages("custom", "GPT-4O")).toBe(true)
			expect(checkModelSupportsImages("custom", "CLAUDE-SONNET-4")).toBe(true)
			expect(checkModelSupportsImages("custom", "GEMINI-2.5-PRO")).toBe(true)
		})
	})

	describe("pattern matching edge cases", () => {
		it("should only match IDs that start with known patterns", () => {
			expect(checkModelSupportsImages("custom", "my-gpt-4o-model")).toBe(false) // gpt not at start
			expect(checkModelSupportsImages("custom", "not-claude-model")).toBe(false) // claude not at start
		})
	})
})

describe("IMAGE_CAPABLE_MODEL_PATTERNS", () => {
	it("should export the model patterns array", () => {
		expect(Array.isArray(IMAGE_CAPABLE_MODEL_PATTERNS)).toBe(true)
		expect(IMAGE_CAPABLE_MODEL_PATTERNS.length).toBeGreaterThan(0)
	})

	it("should contain RegExp patterns for vision-capable models", () => {
		// All patterns should be RegExp instances
		IMAGE_CAPABLE_MODEL_PATTERNS.forEach((pattern) => {
			expect(pattern).toBeInstanceOf(RegExp)
		})
	})
})

describe("IMAGE_INCAPABLE_MODEL_PATTERNS", () => {
	it("should export the incapable model patterns array", () => {
		expect(Array.isArray(IMAGE_INCAPABLE_MODEL_PATTERNS)).toBe(true)
		expect(IMAGE_INCAPABLE_MODEL_PATTERNS.length).toBeGreaterThan(0)
	})

	it("should contain RegExp patterns for non-vision models", () => {
		// All patterns should be RegExp instances
		IMAGE_INCAPABLE_MODEL_PATTERNS.forEach((pattern) => {
			expect(pattern).toBeInstanceOf(RegExp)
		})
	})
})
