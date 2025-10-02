import { describe, it, expect, vi, beforeEach } from "vitest"
import { NativeCondensationProvider } from "../NativeProvider"
import type { CondensationContext, CondensationOptions } from "../../types"
import type { ApiHandler } from "../../../../api/index"
import Anthropic from "@anthropic-ai/sdk"

describe("NativeCondensationProvider", () => {
	let provider: NativeCondensationProvider
	let mockApiHandler: ApiHandler
	let mockOptions: CondensationOptions

	const mockContext: CondensationContext = {
		messages: [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
			{ role: "user", content: "How are you?" },
			{ role: "assistant", content: "I'm doing well, thanks!" },
			{ role: "user", content: "Can you help me?" },
		] as any,
		systemPrompt: "You are a helpful assistant",
		taskId: "task-123",
		prevContextTokens: 1000,
	}

	beforeEach(() => {
		provider = new NativeCondensationProvider()

		// Mock API handler
		mockApiHandler = {
			createMessage: vi.fn(),
			getModel: vi.fn(),
			countTokens: vi.fn().mockResolvedValue(100),
		} as any

		mockOptions = {
			apiHandler: mockApiHandler,
		}
	})

	it("should have correct provider metadata", () => {
		expect(provider.id).toBe("native")
		expect(provider.name).toBe("Native Condensation")
		expect(provider.description).toContain("Original")
	})

	it("should condense messages using API", async () => {
		const mockResponse = {
			id: "msg_123",
			type: "message" as const,
			role: "assistant" as const,
			content: [
				{
					type: "text" as const,
					text: "Summary: User greeted and asked how I am.",
				},
			],
			model: "claude-3-5-sonnet-20241022",
			usage: {
				input_tokens: 100,
				output_tokens: 20,
			},
			stop_reason: "end_turn" as const,
			stop_sequence: null,
		}

		// Mock the async iterator for the stream
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary: User greeted and asked how I am." }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 20,
					totalCost: 0.0006,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toBeUndefined()
		expect(result.messages).toHaveLength(5) // first + summary + last 3
		expect(result.messages[1].role).toBe("assistant")
		expect(result.messages[1].isSummary).toBe(true)
		expect(result.summary).toContain("Summary")
		expect(result.cost).toBeGreaterThan(0)
		expect(result.newContextTokens).toBeGreaterThan(0)
	})

	it("should use custom condensing prompt if provided", async () => {
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Custom summary" }
				yield {
					type: "usage" as const,
					inputTokens: 50,
					outputTokens: 10,
					totalCost: 0.0003,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		const customOptions: CondensationOptions = {
			...mockOptions,
			customCondensingPrompt: "Provide a brief summary of the conversation.",
		}

		await provider.condense(mockContext, customOptions)

		expect(mockApiHandler.createMessage).toHaveBeenCalledWith(
			"Provide a brief summary of the conversation.",
			expect.any(Array),
		)
	})

	it("should use dedicated API handler if provided", async () => {
		const dedicatedHandler = {
			createMessage: vi.fn(),
			getModel: vi.fn(),
			countTokens: vi.fn().mockResolvedValue(100),
		} as any

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary" }
				yield {
					type: "usage" as const,
					inputTokens: 50,
					outputTokens: 10,
					totalCost: 0.0003,
				}
			},
		}

		vi.mocked(dedicatedHandler.createMessage).mockReturnValue(mockStream as any)

		const optionsWithDedicated: CondensationOptions = {
			...mockOptions,
			condensingApiHandler: dedicatedHandler,
		}

		await provider.condense(mockContext, optionsWithDedicated)

		expect(dedicatedHandler.createMessage).toHaveBeenCalled()
		expect(mockApiHandler.createMessage).not.toHaveBeenCalled()
	})

	it("should handle API errors gracefully", async () => {
		vi.mocked(mockApiHandler.createMessage).mockImplementation(() => {
			throw new Error("API timeout")
		})

		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toContain("API timeout")
		expect(result.cost).toBe(0)
		expect(result.messages).toEqual(mockContext.messages)
	})

	it("should estimate cost accurately", async () => {
		const cost = await provider.estimateCost(mockContext)

		expect(cost).toBeGreaterThan(0)
		expect(cost).toBeLessThan(1) // Should be reasonable
	})

	it("should reject condensation if not enough messages", async () => {
		const shortContext: CondensationContext = {
			messages: [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi" },
				{ role: "user", content: "Bye" },
			] as any,
			systemPrompt: "You are a helpful assistant",
			taskId: "task-123",
			prevContextTokens: 100,
		}

		const result = await provider.condense(shortContext, mockOptions)

		expect(result.error).toBeDefined()
		expect(result.messages).toEqual(shortContext.messages)
	})

	it("should reject condensation if recently condensed", async () => {
		const recentlyCondensedContext: CondensationContext = {
			messages: [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Summary", isSummary: true },
				{ role: "user", content: "More" },
				{ role: "assistant", content: "Response" },
				{ role: "user", content: "Question" },
			] as any,
			systemPrompt: "You are a helpful assistant",
			taskId: "task-123",
			prevContextTokens: 500,
		}

		const result = await provider.condense(recentlyCondensedContext, mockOptions)

		expect(result.error).toBeDefined()
		expect(result.messages).toEqual(recentlyCondensedContext.messages)
	})

	it("should reject if condensation produces empty summary", async () => {
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "   " } // Empty/whitespace
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 0,
					totalCost: 0.0003,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toBeDefined()
		expect(result.cost).toBeGreaterThan(0) // Cost was incurred
		expect(result.messages).toEqual(mockContext.messages)
	})

	it("should reject if condensation grows the context", async () => {
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				// Very long summary that would exceed context
				yield {
					type: "text" as const,
					text: "This is a very long summary that exceeds the original context size. ".repeat(100),
				}
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 2000, // Large output
					totalCost: 0.003,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(2500) // Would exceed prevContextTokens

		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toBeDefined()
		expect(result.messages).toEqual(mockContext.messages)
	})

	it("should preserve first message and last N messages", async () => {
		const longContext: CondensationContext = {
			messages: [
				{ role: "user", content: "First message" }, // Should be preserved
				{ role: "assistant", content: "Response 1" },
				{ role: "user", content: "Message 2" },
				{ role: "assistant", content: "Response 2" },
				{ role: "user", content: "Message 3" },
				{ role: "assistant", content: "Response 3" }, // Last 3 start here
				{ role: "user", content: "Message 4" },
				{ role: "assistant", content: "Response 4" },
				{ role: "user", content: "Message 5" }, // Last message
			] as any,
			systemPrompt: "You are a helpful assistant",
			taskId: "task-123",
			prevContextTokens: 1000,
		}

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary of middle messages" }
				yield {
					type: "usage" as const,
					inputTokens: 200,
					outputTokens: 30,
					totalCost: 0.0009,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		const result = await provider.condense(longContext, mockOptions)

		expect(result.error).toBeUndefined()
		expect(result.messages).toHaveLength(5) // first + summary + last 3
		expect(result.messages[0].content).toBe("First message") // First preserved
		expect(result.messages[1].isSummary).toBe(true) // Summary inserted
		expect(result.messages[2].content).toBe("Message 4") // Last 3 start (index 6 of original)
		expect(result.messages[3].content).toBe("Response 4") // index 7
		expect(result.messages[4].content).toBe("Message 5") // Last preserved (index 8)
	})

	it("should use default prompt when custom prompt is empty or whitespace", async () => {
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary with default prompt" }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 20,
					totalCost: 0.0006,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		// Test with empty string
		const emptyOptions: CondensationOptions = {
			...mockOptions,
			customCondensingPrompt: "",
		}
		await provider.condense(mockContext, emptyOptions)

		// Should use default prompt (contains "Your task is to create")
		let call = vi.mocked(mockApiHandler.createMessage).mock.calls[0]
		expect(call[0]).toContain("Your task is to create")

		vi.clearAllMocks()
		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		// Test with whitespace only
		const whitespaceOptions: CondensationOptions = {
			...mockOptions,
			customCondensingPrompt: "   \n\t  ",
		}
		await provider.condense(mockContext, whitespaceOptions)

		call = vi.mocked(mockApiHandler.createMessage).mock.calls[0]
		expect(call[0]).toContain("Your task is to create")
	})

	it("should handle messages with mixed content types", async () => {
		const mockHandlerWithModel = {
			createMessage: vi.fn(),
			getModel: vi.fn().mockReturnValue({
				id: "test-model",
				info: { supportsImages: true },
			}),
			countTokens: vi.fn().mockResolvedValue(100),
		} as any

		const mixedContext: CondensationContext = {
			messages: [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: [{ type: "text", text: "Response" }] },
				{ role: "user", content: "Question" },
				{ role: "assistant", content: "Answer" },
				{ role: "user", content: "Final question" },
			] as any,
			systemPrompt: "You are a helpful assistant",
			taskId: "task-123",
			prevContextTokens: 1000,
		}

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary of mixed content" }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 20,
					totalCost: 0.0006,
				}
			},
		}

		vi.mocked(mockHandlerWithModel.createMessage).mockReturnValue(mockStream as any)

		const mixedOptions: CondensationOptions = {
			apiHandler: mockHandlerWithModel,
		}

		const result = await provider.condense(mixedContext, mixedOptions)

		expect(result.error).toBeUndefined()
		expect(result.messages).toHaveLength(5) // first + summary + last 3
	})

	it("should properly set isSummary flag on summary message", async () => {
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "This is a summary" }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 20,
					totalCost: 0.0006,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toBeUndefined()
		expect(result.messages[1].isSummary).toBe(true)
		expect(result.messages[1].role).toBe("assistant")
		expect(result.messages[1].content).toBe("This is a summary")
		// Other messages should not have isSummary flag
		expect(result.messages[0].isSummary).toBeUndefined()
		expect(result.messages[2].isSummary).toBeUndefined()
	})

	it("should handle stream with multiple text chunks", async () => {
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Part 1 " }
				yield { type: "text" as const, text: "Part 2 " }
				yield { type: "text" as const, text: "Part 3" }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 20,
					totalCost: 0.0006,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toBeUndefined()
		expect(result.summary).toBe("Part 1 Part 2 Part 3")
	})

	it("should count tokens correctly for cost calculation", async () => {
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary" }
				yield {
					type: "usage" as const,
					inputTokens: 200,
					outputTokens: 50,
					totalCost: 0.0015,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(250)

		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toBeUndefined()
		expect(result.cost).toBe(0.0015)
		expect(result.newContextTokens).toBe(300) // 50 (output) + 250 (context)
	})

	it("should handle invalid API handler gracefully", async () => {
		const invalidOptions: CondensationOptions = {
			apiHandler: null as any,
		}

		const result = await provider.condense(mockContext, invalidOptions)

		expect(result.error).toBeDefined()
		expect(result.error).toContain("No API handler provided")
		expect(result.messages).toEqual(mockContext.messages)
	})

	it("should preserve timestamp from first kept message in summary", async () => {
		const timestampedContext: CondensationContext = {
			messages: [
				{ role: "user", content: "Hello", ts: 1000 },
				{ role: "assistant", content: "Hi", ts: 1001 },
				{ role: "user", content: "Question", ts: 1002 },
				{ role: "assistant", content: "Answer", ts: 1003 },
				{ role: "user", content: "Final", ts: 1004 },
			] as any,
			systemPrompt: "You are a helpful assistant",
			taskId: "task-123",
			prevContextTokens: 1000,
		}

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary" }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 20,
					totalCost: 0.0006,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		const result = await provider.condense(timestampedContext, mockOptions)

		expect(result.error).toBeUndefined()
		// Summary should have timestamp from first kept message (index 2 = ts 1002)
		expect(result.messages[1].ts).toBe(1002)
	})

	it("should estimate cost for large contexts", async () => {
		const largeContext: CondensationContext = {
			messages: Array.from({ length: 20 }, (_, i) => ({
				role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
				content: `Message ${i + 1} with some content`,
			})),
			systemPrompt: "You are a helpful assistant",
			taskId: "task-123",
			prevContextTokens: 5000,
		}

		const cost = await provider.estimateCost(largeContext)

		expect(cost).toBeGreaterThan(0)
		expect(cost).toBeLessThan(0.1) // Should be reasonable for this size
	})

	it("should handle usage chunk without totalCost", async () => {
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary" }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 20,
					// totalCost is undefined
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		const result = await provider.condense(mockContext, mockOptions)

		expect(result.error).toBeUndefined()
		expect(result.cost).toBe(0) // Should default to 0
	})
})
