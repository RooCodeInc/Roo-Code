// Mock TelemetryService before other imports
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureException: vi.fn(),
		},
	},
}))

// Mock AWS SDK credential providers
vi.mock("@aws-sdk/credential-providers", () => {
	const mockFromIni = vi.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	})
	return { fromIni: mockFromIni }
})

// Use vi.hoisted to define mock functions for AI SDK
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

vi.mock("@ai-sdk/amazon-bedrock", () => ({
	createAmazonBedrock: vi.fn(() => vi.fn(() => ({ modelId: "test", provider: "bedrock" }))),
}))

import { AwsBedrockHandler } from "../bedrock"
import type { ApiHandlerCreateMessageMetadata } from "../../index"

// Test tool definitions in OpenAI format
const testTools = [
	{
		type: "function" as const,
		function: {
			name: "read_file",
			description: "Read a file from the filesystem",
			parameters: {
				type: "object",
				properties: {
					path: { type: "string", description: "The path to the file" },
				},
				required: ["path"],
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: "write_file",
			description: "Write content to a file",
			parameters: {
				type: "object",
				properties: {
					path: { type: "string", description: "The path to the file" },
					content: { type: "string", description: "The content to write" },
				},
				required: ["path", "content"],
			},
		},
	},
]

/**
 * Helper: set up mockStreamText to return a simple text-delta stream.
 */
function setupMockStreamText() {
	async function* mockFullStream() {
		yield { type: "text-delta", text: "Response text" }
	}
	mockStreamText.mockReturnValue({
		fullStream: mockFullStream(),
		usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
		providerMetadata: Promise.resolve({}),
	})
}

/**
 * Helper: set up mockStreamText to return a stream with tool-call events.
 */
function setupMockStreamTextWithToolCall() {
	async function* mockFullStream() {
		yield {
			type: "tool-input-start",
			id: "tool-123",
			toolName: "read_file",
		}
		yield {
			type: "tool-input-delta",
			id: "tool-123",
			delta: '{"path": "/test.txt"}',
		}
		yield {
			type: "tool-input-end",
			id: "tool-123",
		}
	}
	mockStreamText.mockReturnValue({
		fullStream: mockFullStream(),
		usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
		providerMetadata: Promise.resolve({}),
	})
}

describe("AwsBedrockHandler Native Tool Calling (AI SDK)", () => {
	let handler: AwsBedrockHandler

	beforeEach(() => {
		vi.clearAllMocks()

		handler = new AwsBedrockHandler({
			apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
		})
	})

	describe("tools passed to streamText", () => {
		it("should pass converted tools to streamText when tools are provided", async () => {
			setupMockStreamText()

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: testTools,
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read the file at /test.txt" }],
				metadata,
			)

			// Drain the generator
			for await (const _chunk of generator) {
				/* consume */
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// tools should be defined and contain AI SDK tool objects keyed by name
			expect(callArgs.tools).toBeDefined()
			expect(callArgs.tools.read_file).toBeDefined()
			expect(callArgs.tools.write_file).toBeDefined()
		})

		it("should pass undefined tools when no tools are provided in metadata", async () => {
			setupMockStreamText()

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				// No tools
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Hello" }],
				metadata,
			)

			for await (const _chunk of generator) {
				/* consume */
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// When no tools are provided, tools should be undefined
			expect(callArgs.tools).toBeUndefined()
		})

		it("should filter non-function tools before passing to streamText", async () => {
			setupMockStreamText()

			const mixedTools: any[] = [
				...testTools,
				{ type: "other", something: {} }, // Should be filtered out
			]

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: mixedTools as any,
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read a file" }],
				metadata,
			)

			for await (const _chunk of generator) {
				/* consume */
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// Only function tools should be present (keyed by name)
			expect(callArgs.tools).toBeDefined()
			expect(Object.keys(callArgs.tools)).toHaveLength(2)
			expect(callArgs.tools.read_file).toBeDefined()
			expect(callArgs.tools.write_file).toBeDefined()
		})
	})

	describe("toolChoice passed to streamText", () => {
		it("should default toolChoice to undefined when tool_choice is not specified", async () => {
			setupMockStreamText()

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: testTools,
				// No tool_choice
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read the file" }],
				metadata,
			)

			for await (const _chunk of generator) {
				/* consume */
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// mapToolChoice(undefined) returns undefined
			expect(callArgs.toolChoice).toBeUndefined()
		})

		it("should pass 'auto' toolChoice when tool_choice is 'auto'", async () => {
			setupMockStreamText()

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: testTools,
				tool_choice: "auto",
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read the file" }],
				metadata,
			)

			for await (const _chunk of generator) {
				/* consume */
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			expect(callArgs.toolChoice).toBe("auto")
		})

		it("should pass 'none' toolChoice when tool_choice is 'none'", async () => {
			setupMockStreamText()

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: testTools,
				tool_choice: "none",
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read the file" }],
				metadata,
			)

			for await (const _chunk of generator) {
				/* consume */
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			expect(callArgs.toolChoice).toBe("none")
		})

		it("should pass 'required' toolChoice when tool_choice is 'required'", async () => {
			setupMockStreamText()

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: testTools,
				tool_choice: "required",
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read the file" }],
				metadata,
			)

			for await (const _chunk of generator) {
				/* consume */
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			expect(callArgs.toolChoice).toBe("required")
		})

		it("should pass specific tool choice when tool_choice names a function", async () => {
			setupMockStreamText()

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: testTools,
				tool_choice: {
					type: "function",
					function: { name: "read_file" },
				},
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read the file" }],
				metadata,
			)

			for await (const _chunk of generator) {
				/* consume */
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			expect(callArgs.toolChoice).toEqual({
				type: "tool",
				toolName: "read_file",
			})
		})
	})

	describe("tool call streaming events", () => {
		it("should yield tool_call_start, tool_call_delta, and tool_call_end for tool input stream", async () => {
			setupMockStreamTextWithToolCall()

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: testTools,
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read the file" }],
				metadata,
			)

			const results: any[] = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Should have tool_call_start chunk
			const startChunks = results.filter((r) => r.type === "tool_call_start")
			expect(startChunks).toHaveLength(1)
			expect(startChunks[0]).toEqual({
				type: "tool_call_start",
				id: "tool-123",
				name: "read_file",
			})

			// Should have tool_call_delta chunk
			const deltaChunks = results.filter((r) => r.type === "tool_call_delta")
			expect(deltaChunks).toHaveLength(1)
			expect(deltaChunks[0]).toEqual({
				type: "tool_call_delta",
				id: "tool-123",
				delta: '{"path": "/test.txt"}',
			})

			// Should have tool_call_end chunk
			const endChunks = results.filter((r) => r.type === "tool_call_end")
			expect(endChunks).toHaveLength(1)
			expect(endChunks[0]).toEqual({
				type: "tool_call_end",
				id: "tool-123",
			})
		})

		it("should handle mixed text and tool use content in stream", async () => {
			async function* mockFullStream() {
				yield { type: "text-delta", text: "Let me read that file for you." }
				yield { type: "text-delta", text: " Here's what I found:" }
				yield {
					type: "tool-input-start",
					id: "tool-789",
					toolName: "read_file",
				}
				yield {
					type: "tool-input-delta",
					id: "tool-789",
					delta: '{"path": "/example.txt"}',
				}
				yield {
					type: "tool-input-end",
					id: "tool-789",
				}
			}
			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 150, outputTokens: 75 }),
				providerMetadata: Promise.resolve({}),
			})

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: testTools,
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read the example file" }],
				metadata,
			)

			const results: any[] = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Should have text chunks
			const textChunks = results.filter((r) => r.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Let me read that file for you.")
			expect(textChunks[1].text).toBe(" Here's what I found:")

			// Should have tool call start
			const startChunks = results.filter((r) => r.type === "tool_call_start")
			expect(startChunks).toHaveLength(1)
			expect(startChunks[0].name).toBe("read_file")

			// Should have tool call delta
			const deltaChunks = results.filter((r) => r.type === "tool_call_delta")
			expect(deltaChunks).toHaveLength(1)
			expect(deltaChunks[0].delta).toBe('{"path": "/example.txt"}')

			// Should have tool call end
			const endChunks = results.filter((r) => r.type === "tool_call_end")
			expect(endChunks).toHaveLength(1)
		})

		it("should handle multiple tool calls in a single stream", async () => {
			async function* mockFullStream() {
				yield {
					type: "tool-input-start",
					id: "tool-1",
					toolName: "read_file",
				}
				yield {
					type: "tool-input-delta",
					id: "tool-1",
					delta: '{"path": "/file1.txt"}',
				}
				yield {
					type: "tool-input-end",
					id: "tool-1",
				}
				yield {
					type: "tool-input-start",
					id: "tool-2",
					toolName: "write_file",
				}
				yield {
					type: "tool-input-delta",
					id: "tool-2",
					delta: '{"path": "/file2.txt", "content": "hello"}',
				}
				yield {
					type: "tool-input-end",
					id: "tool-2",
				}
			}
			mockStreamText.mockReturnValue({
				fullStream: mockFullStream(),
				usage: Promise.resolve({ inputTokens: 200, outputTokens: 100 }),
				providerMetadata: Promise.resolve({}),
			})

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: testTools,
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read and write files" }],
				metadata,
			)

			const results: any[] = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Should have two tool_call_start chunks
			const startChunks = results.filter((r) => r.type === "tool_call_start")
			expect(startChunks).toHaveLength(2)
			expect(startChunks[0].name).toBe("read_file")
			expect(startChunks[1].name).toBe("write_file")

			// Should have two tool_call_delta chunks
			const deltaChunks = results.filter((r) => r.type === "tool_call_delta")
			expect(deltaChunks).toHaveLength(2)

			// Should have two tool_call_end chunks
			const endChunks = results.filter((r) => r.type === "tool_call_end")
			expect(endChunks).toHaveLength(2)
		})
	})

	describe("tools schema normalization", () => {
		it("should apply schema normalization (additionalProperties: false, strict: true) via convertToolsForOpenAI", async () => {
			setupMockStreamText()

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: [
					{
						type: "function" as const,
						function: {
							name: "test_tool",
							description: "A test tool",
							parameters: {
								type: "object",
								properties: {
									arg1: { type: "string" },
								},
								// Note: no "required" field and no "additionalProperties"
							},
						},
					},
				],
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "test" }],
				metadata,
			)

			for await (const _chunk of generator) {
				/* consume */
			}

			expect(mockStreamText).toHaveBeenCalledTimes(1)
			const callArgs = mockStreamText.mock.calls[0][0]

			// The AI SDK tools should be keyed by tool name
			expect(callArgs.tools).toBeDefined()
			expect(callArgs.tools.test_tool).toBeDefined()
		})
	})

	describe("usage metrics with tools", () => {
		it("should yield usage chunk after tool call stream completes", async () => {
			setupMockStreamTextWithToolCall()

			const metadata: ApiHandlerCreateMessageMetadata = {
				taskId: "test-task",
				tools: testTools,
			}

			const generator = handler.createMessage(
				"You are a helpful assistant.",
				[{ role: "user", content: "Read a file" }],
				metadata,
			)

			const results: any[] = []
			for await (const chunk of generator) {
				results.push(chunk)
			}

			// Should have a usage chunk at the end
			const usageChunks = results.filter((r) => r.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0].inputTokens).toBe(100)
			expect(usageChunks[0].outputTokens).toBe(50)
		})
	})
})
