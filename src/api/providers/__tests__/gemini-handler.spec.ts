// npx vitest run src/api/providers/__tests__/gemini-handler.spec.ts

// Mock the AI SDK functions
const mockStreamText = vi.fn()
const mockGenerateText = vi.fn()

vi.mock("ai", async (importOriginal) => {
	const original = await importOriginal<typeof import("ai")>()
	return {
		...original,
		streamText: (...args: unknown[]) => mockStreamText(...args),
		generateText: (...args: unknown[]) => mockGenerateText(...args),
	}
})

import { t } from "i18next"

import { GeminiHandler } from "../gemini"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("GeminiHandler backend support", () => {
	beforeEach(() => {
		mockStreamText.mockClear()
		mockGenerateText.mockClear()
	})

	it("createMessage uses AI SDK tools format", async () => {
		const options = {
			apiProvider: "gemini",
			enableUrlContext: true,
			enableGrounding: true,
		} as ApiHandlerOptions
		const handler = new GeminiHandler(options)

		const mockFullStream = (async function* () {})()

		mockStreamText.mockReturnValue({
			fullStream: mockFullStream,
			usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
			providerMetadata: Promise.resolve({}),
		})

		await handler.createMessage("instr", [] as any).next()

		// Verify streamText was called
		expect(mockStreamText).toHaveBeenCalledWith(
			expect.objectContaining({
				system: "instr",
			}),
		)
	})

	it("completePrompt passes tools when URL context and grounding enabled", async () => {
		const options = {
			apiProvider: "gemini",
			enableUrlContext: true,
			enableGrounding: true,
		} as ApiHandlerOptions
		const handler = new GeminiHandler(options)

		mockGenerateText.mockResolvedValue({
			text: "ok",
			providerMetadata: {},
		})

		const res = await handler.completePrompt("hi")
		expect(res).toBe("ok")

		// Verify generateText was called with tools
		expect(mockGenerateText).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: "hi",
				tools: expect.any(Object),
			}),
		)
	})

	it("completePrompt passes config overrides without tools when URL context and grounding disabled", async () => {
		const options = {
			apiProvider: "gemini",
			enableUrlContext: false,
			enableGrounding: false,
		} as ApiHandlerOptions
		const handler = new GeminiHandler(options)

		mockGenerateText.mockResolvedValue({
			text: "ok",
			providerMetadata: {},
		})

		const res = await handler.completePrompt("hi")
		expect(res).toBe("ok")

		// Verify generateText was called without tools
		const callArgs = mockGenerateText.mock.calls[0][0]
		expect(callArgs.tools).toBeUndefined()
	})

	describe("error scenarios", () => {
		it("should handle grounding metadata extraction failure gracefully", async () => {
			const options = {
				apiProvider: "gemini",
				enableGrounding: true,
			} as ApiHandlerOptions
			const handler = new GeminiHandler(options)

			// AI SDK text-delta events have a 'text' property (processAiSdkStreamPart casts to this)
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test response" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({
					google: {
						groundingMetadata: {
							// Invalid structure - missing groundingChunks
						},
					},
				}),
			})

			const messages = []
			for await (const chunk of handler.createMessage("test", [] as any)) {
				messages.push(chunk)
			}

			// Should still return the main content without sources
			expect(messages.some((m) => m.type === "text" && m.text === "test response")).toBe(true)
			expect(messages.some((m) => m.type === "grounding")).toBe(false)
		})

		it("should handle malformed grounding metadata", async () => {
			const options = {
				apiProvider: "gemini",
				enableGrounding: true,
			} as ApiHandlerOptions
			const handler = new GeminiHandler(options)

			// AI SDK text-delta events have a 'text' property (processAiSdkStreamPart casts to this)
			const mockFullStream = (async function* () {
				yield { type: "text-delta", text: "test response" }
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
				providerMetadata: Promise.resolve({
					google: {
						groundingMetadata: {
							groundingChunks: [
								{ web: null }, // Missing URI
								{ web: { uri: "https://example.com", title: "Example Site" } }, // Valid
								{}, // Missing web property entirely
							],
						},
					},
				}),
			})

			const messages = []
			for await (const chunk of handler.createMessage("test", [] as any)) {
				messages.push(chunk)
			}

			// Should have the text response
			const textMessage = messages.find((m) => m.type === "text")
			expect(textMessage).toBeDefined()
			if (textMessage && "text" in textMessage) {
				expect(textMessage.text).toBe("test response")
			}

			// Should have grounding chunk with only valid sources
			const groundingMessage = messages.find((m) => m.type === "grounding")
			expect(groundingMessage).toBeDefined()
			if (groundingMessage && "sources" in groundingMessage) {
				expect(groundingMessage.sources).toHaveLength(1)
				expect(groundingMessage.sources[0].url).toBe("https://example.com")
				expect(groundingMessage.sources[0].title).toBe("Example Site")
			}
		})

		it("should handle API errors when tools are enabled", async () => {
			const options = {
				apiProvider: "gemini",
				enableUrlContext: true,
				enableGrounding: true,
			} as ApiHandlerOptions
			const handler = new GeminiHandler(options)

			const mockError = new Error("API rate limit exceeded")
			// eslint-disable-next-line require-yield
			const mockFullStream = (async function* () {
				throw mockError
			})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			await expect(async () => {
				const generator = handler.createMessage("test", [] as any)
				await generator.next()
			}).rejects.toThrow(t("common:errors.gemini.generate_stream", { error: "API rate limit exceeded" }))
		})
	})

	describe("toolChoice support", () => {
		const testTools = [
			{
				type: "function" as const,
				function: {
					name: "read_file",
					description: "Read a file",
					parameters: { type: "object", properties: {} },
				},
			},
			{
				type: "function" as const,
				function: {
					name: "write_to_file",
					description: "Write to a file",
					parameters: { type: "object", properties: {} },
				},
			},
			{
				type: "function" as const,
				function: {
					name: "execute_command",
					description: "Execute a command",
					parameters: { type: "object", properties: {} },
				},
			},
		]

		it("should pass tools to streamText", async () => {
			const options = {
				apiProvider: "gemini",
			} as ApiHandlerOptions
			const handler = new GeminiHandler(options)

			const mockFullStream = (async function* () {})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			await handler
				.createMessage("test", [] as any, {
					taskId: "test-task",
					tools: testTools,
				})
				.next()

			// Verify streamText was called with tools
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Object),
				}),
			)
		})

		it("should pass toolChoice when allowedFunctionNames is provided", async () => {
			const options = {
				apiProvider: "gemini",
			} as ApiHandlerOptions
			const handler = new GeminiHandler(options)

			const mockFullStream = (async function* () {})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			await handler
				.createMessage("test", [] as any, {
					taskId: "test-task",
					tools: testTools,
					allowedFunctionNames: ["read_file", "write_to_file"],
				})
				.next()

			// Verify toolChoice is 'required' when allowedFunctionNames is provided
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					toolChoice: "required",
				}),
			)
		})

		it("should use tool_choice when allowedFunctionNames is not provided", async () => {
			const options = {
				apiProvider: "gemini",
			} as ApiHandlerOptions
			const handler = new GeminiHandler(options)

			const mockFullStream = (async function* () {})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			await handler
				.createMessage("test", [] as any, {
					taskId: "test-task",
					tools: testTools,
					tool_choice: "auto",
				})
				.next()

			// Verify toolChoice follows tool_choice
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					toolChoice: "auto",
				}),
			)
		})

		it("should not set toolChoice when allowedFunctionNames is empty and no tool_choice", async () => {
			const options = {
				apiProvider: "gemini",
			} as ApiHandlerOptions
			const handler = new GeminiHandler(options)

			const mockFullStream = (async function* () {})()

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({}),
				providerMetadata: Promise.resolve({}),
			})

			await handler
				.createMessage("test", [] as any, {
					taskId: "test-task",
					tools: testTools,
					allowedFunctionNames: [],
				})
				.next()

			// With empty allowedFunctionNames, toolChoice should be undefined
			const callArgs = mockStreamText.mock.calls[0][0]
			expect(callArgs.toolChoice).toBeUndefined()
		})
	})
})
