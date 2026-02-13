// npx vitest run api/providers/__tests__/native-ollama.spec.ts

// Use vi.hoisted to define mock functions that can be referenced in hoisted vi.mock() calls
const { mockStreamText, mockGenerateText } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("ollama-ai-provider-v2", () => ({
	createOllama: vi.fn(() => {
		return vi.fn(() => ({
			modelId: "llama2",
			provider: "ollama",
		}))
	}),
}))

// Mock the getOllamaModels function
vi.mock("../fetchers/ollama", () => ({
	getOllamaModels: vi.fn(),
}))

import { NativeOllamaHandler } from "../native-ollama"
import { ApiHandlerOptions } from "../../../shared/api"
import { getOllamaModels } from "../fetchers/ollama"

const mockGetOllamaModels = vi.mocked(getOllamaModels)

describe("NativeOllamaHandler", () => {
	let handler: NativeOllamaHandler

	beforeEach(() => {
		vi.clearAllMocks()

		mockGetOllamaModels.mockResolvedValue({
			llama2: {
				contextWindow: 4096,
				maxTokens: 4096,
				supportsImages: false,
				supportsPromptCache: false,
			},
		})

		const options: ApiHandlerOptions = {
			apiModelId: "llama2",
			ollamaModelId: "llama2",
			ollamaBaseUrl: "http://localhost:11434",
		}

		handler = new NativeOllamaHandler(options)
	})

	describe("createMessage", () => {
		it("should stream messages from Ollama", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Hello" }
				yield { type: "text-delta", text: " world" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 10, outputTokens: 2 }),
			})

			const systemPrompt = "You are a helpful assistant"
			const messages = [{ role: "user" as const, content: "Hi there" }]

			const stream = handler.createMessage(systemPrompt, messages)
			const results = []

			for await (const chunk of stream) {
				results.push(chunk)
			}

			expect(results).toHaveLength(3)
			expect(results[0]).toEqual({ type: "text", text: "Hello" })
			expect(results[1]).toEqual({ type: "text", text: " world" })
			expect(results[2]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 2,
				totalInputTokens: 10,
				totalOutputTokens: 2,
			})
		})

		it("should not include providerOptions by default (no num_ctx)", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("System", [{ role: "user" as const, content: "Test" }])

			for await (const _ of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.not.objectContaining({
					providerOptions: expect.anything(),
				}),
			)
		})

		it("should include num_ctx via providerOptions when explicitly set via ollamaNumCtx", async () => {
			const options: ApiHandlerOptions = {
				apiModelId: "llama2",
				ollamaModelId: "llama2",
				ollamaBaseUrl: "http://localhost:11434",
				ollamaNumCtx: 8192,
			}

			handler = new NativeOllamaHandler(options)

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("System", [{ role: "user" as const, content: "Test" }])

			for await (const _ of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: { ollama: { options: { num_ctx: 8192 } } },
				}),
			)
		})

		it("should handle DeepSeek R1 models with reasoning detection", async () => {
			const options: ApiHandlerOptions = {
				apiModelId: "deepseek-r1",
				ollamaModelId: "deepseek-r1",
				ollamaBaseUrl: "http://localhost:11434",
			}

			handler = new NativeOllamaHandler(options)

			async function* mockFullStream() {
				yield { type: "reasoning-delta", text: "Let me think about this" }
				yield { type: "text-delta", text: "The answer is 42" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("System", [{ role: "user" as const, content: "Question?" }])
			const results = []

			for await (const chunk of stream) {
				results.push(chunk)
			}

			expect(results.some((r) => r.type === "reasoning")).toBe(true)
			expect(results.some((r) => r.type === "text")).toBe(true)

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: { ollama: { think: true } },
				}),
			)
		})
	})

	describe("completePrompt", () => {
		it("should complete a prompt without streaming", async () => {
			mockGenerateText.mockResolvedValue({
				text: "This is the response",
			})

			const result = await handler.completePrompt("Tell me a joke")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Tell me a joke",
					temperature: 0,
				}),
			)
			expect(result).toBe("This is the response")
		})

		it("should not include providerOptions in completePrompt by default", async () => {
			mockGenerateText.mockResolvedValue({
				text: "Response",
			})

			await handler.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.not.objectContaining({
					providerOptions: expect.anything(),
				}),
			)
		})

		it("should include num_ctx via providerOptions in completePrompt when explicitly set", async () => {
			const options: ApiHandlerOptions = {
				apiModelId: "llama2",
				ollamaModelId: "llama2",
				ollamaBaseUrl: "http://localhost:11434",
				ollamaNumCtx: 4096,
			}

			handler = new NativeOllamaHandler(options)

			mockGenerateText.mockResolvedValue({
				text: "Response",
			})

			await handler.completePrompt("Test prompt")

			expect(mockGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					providerOptions: { ollama: { options: { num_ctx: 4096 } } },
				}),
			)
		})
	})

	describe("error handling", () => {
		it("should handle connection refused errors", async () => {
			const error = new Error("ECONNREFUSED") as any
			error.code = "ECONNREFUSED"

			const mockFullStream = {
				[Symbol.asyncIterator]: () => ({
					next: () => Promise.reject(error),
				}),
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("System", [{ role: "user" as const, content: "Test" }])

			await expect(async () => {
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("Ollama service is not running")
		})

		it("should handle model not found errors", async () => {
			const error = new Error("Not found") as any
			error.status = 404

			const mockFullStream = {
				[Symbol.asyncIterator]: () => ({
					next: () => Promise.reject(error),
				}),
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream,
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("System", [{ role: "user" as const, content: "Test" }])

			await expect(async () => {
				for await (const _ of stream) {
					// consume stream
				}
			}).rejects.toThrow("Model llama2 not found in Ollama")
		})
	})

	describe("getModel", () => {
		it("should return the configured model", () => {
			const model = handler.getModel()
			expect(model.id).toBe("llama2")
			expect(model.info).toBeDefined()
		})
	})

	describe("isAiSdkProvider", () => {
		it("should return true", () => {
			expect(handler.isAiSdkProvider()).toBe(true)
		})
	})

	describe("tool calling", () => {
		it("should pass tools via AI SDK when tools are provided", async () => {
			mockGetOllamaModels.mockResolvedValue({
				"llama3.2": {
					contextWindow: 128000,
					maxTokens: 4096,
					supportsImages: true,
					supportsPromptCache: false,
				},
			})

			const options: ApiHandlerOptions = {
				apiModelId: "llama3.2",
				ollamaModelId: "llama3.2",
				ollamaBaseUrl: "http://localhost:11434",
			}

			handler = new NativeOllamaHandler(options)

			async function* mockFullStream() {
				yield { type: "text-delta", text: "I will use the tool" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get the weather for a location",
						parameters: {
							type: "object",
							properties: {
								location: { type: "string", description: "The city name" },
							},
							required: ["location"],
						},
					},
				},
			]

			const stream = handler.createMessage(
				"System",
				[{ role: "user" as const, content: "What's the weather?" }],
				{ taskId: "test", tools },
			)

			for await (const _ of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Object),
				}),
			)
		})

		it("should pass tools even when model metadata doesn't advertise tool support", async () => {
			mockGetOllamaModels.mockResolvedValue({
				llama2: {
					contextWindow: 4096,
					maxTokens: 4096,
					supportsImages: false,
					supportsPromptCache: false,
				},
			})

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response without tools" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get the weather",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const stream = handler.createMessage("System", [{ role: "user" as const, content: "Test" }], {
				taskId: "test",
				tools,
			})

			for await (const _ of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Object),
				}),
			)
		})

		it("should not include tools when no tools are provided", async () => {
			mockGetOllamaModels.mockResolvedValue({
				"llama3.2": {
					contextWindow: 128000,
					maxTokens: 4096,
					supportsImages: true,
					supportsPromptCache: false,
				},
			})

			const options: ApiHandlerOptions = {
				apiModelId: "llama3.2",
				ollamaModelId: "llama3.2",
				ollamaBaseUrl: "http://localhost:11434",
			}

			handler = new NativeOllamaHandler(options)

			async function* mockFullStream() {
				yield { type: "text-delta", text: "Response" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const stream = handler.createMessage("System", [{ role: "user" as const, content: "Test" }], {
				taskId: "test",
			})

			for await (const _ of stream) {
				// consume stream
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: undefined,
				}),
			)
		})

		it("should yield tool call events when model returns tool calls", async () => {
			mockGetOllamaModels.mockResolvedValue({
				"llama3.2": {
					contextWindow: 128000,
					maxTokens: 4096,
					supportsImages: true,
					supportsPromptCache: false,
				},
			})

			const options: ApiHandlerOptions = {
				apiModelId: "llama3.2",
				ollamaModelId: "llama3.2",
				ollamaBaseUrl: "http://localhost:11434",
			}

			handler = new NativeOllamaHandler(options)

			async function* mockFullStream() {
				yield {
					type: "tool-input-start",
					id: "tool-call-1",
					toolName: "get_weather",
				}
				yield {
					type: "tool-input-delta",
					id: "tool-call-1",
					delta: '{"location":"San Francisco"}',
				}
				yield {
					type: "tool-input-end",
					id: "tool-call-1",
				}
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get the weather for a location",
						parameters: {
							type: "object",
							properties: {
								location: { type: "string" },
							},
							required: ["location"],
						},
					},
				},
			]

			const stream = handler.createMessage(
				"System",
				[{ role: "user" as const, content: "What's the weather in SF?" }],
				{ taskId: "test", tools },
			)

			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			const toolCallStart = results.find((r) => r.type === "tool_call_start")
			expect(toolCallStart).toBeDefined()
			expect(toolCallStart).toEqual({
				type: "tool_call_start",
				id: "tool-call-1",
				name: "get_weather",
			})

			const toolCallDelta = results.find((r) => r.type === "tool_call_delta")
			expect(toolCallDelta).toBeDefined()

			const toolCallEnd = results.find((r) => r.type === "tool_call_end")
			expect(toolCallEnd).toBeDefined()
			expect(toolCallEnd).toEqual({
				type: "tool_call_end",
				id: "tool-call-1",
			})
		})

		it("should yield tool_call_end events after tool_call_start for multiple tools", async () => {
			mockGetOllamaModels.mockResolvedValue({
				"llama3.2": {
					contextWindow: 128000,
					maxTokens: 4096,
					supportsImages: true,
					supportsPromptCache: false,
				},
			})

			const options: ApiHandlerOptions = {
				apiModelId: "llama3.2",
				ollamaModelId: "llama3.2",
				ollamaBaseUrl: "http://localhost:11434",
			}

			handler = new NativeOllamaHandler(options)

			async function* mockFullStream() {
				yield { type: "tool-input-start", id: "tool-0", toolName: "get_weather" }
				yield { type: "tool-input-delta", id: "tool-0", delta: '{"location":"SF"}' }
				yield { type: "tool-input-end", id: "tool-0" }
				yield { type: "tool-input-start", id: "tool-1", toolName: "get_time" }
				yield { type: "tool-input-delta", id: "tool-1", delta: '{"timezone":"PST"}' }
				yield { type: "tool-input-end", id: "tool-1" }
			}

			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			})

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "get_weather",
						description: "Get the weather for a location",
						parameters: {
							type: "object",
							properties: { location: { type: "string" } },
							required: ["location"],
						},
					},
				},
				{
					type: "function" as const,
					function: {
						name: "get_time",
						description: "Get the current time in a timezone",
						parameters: {
							type: "object",
							properties: { timezone: { type: "string" } },
							required: ["timezone"],
						},
					},
				},
			]

			const stream = handler.createMessage(
				"System",
				[{ role: "user" as const, content: "What's the weather and time in SF?" }],
				{ taskId: "test", tools },
			)

			const results = []
			for await (const chunk of stream) {
				results.push(chunk)
			}

			const toolCallStarts = results.filter((r) => r.type === "tool_call_start")
			expect(toolCallStarts).toHaveLength(2)

			const toolCallEnds = results.filter((r) => r.type === "tool_call_end")
			expect(toolCallEnds).toHaveLength(2)
			expect(toolCallEnds[0]).toEqual({ type: "tool_call_end", id: "tool-0" })
			expect(toolCallEnds[1]).toEqual({ type: "tool_call_end", id: "tool-1" })

			// tool_call_end should come after corresponding tool_call_start
			const firstStartIndex = results.findIndex((r) => r.type === "tool_call_start")
			const firstEndIndex = results.findIndex((r) => r.type === "tool_call_end")
			expect(firstEndIndex).toBeGreaterThan(firstStartIndex)
		})
	})
})
