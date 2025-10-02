import { describe, it, expect, vi, beforeEach } from "vitest"
import { summarizeConversation } from "../index"
import type { ApiHandler } from "../../../api/index"
import type { ApiMessage } from "../../task-persistence/apiMessages"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureContextCondensed: vi.fn(),
		},
	},
}))

describe("Condense Integration", () => {
	let mockApiHandler: ApiHandler

	beforeEach(() => {
		mockApiHandler = {
			createMessage: vi.fn(),
			getModel: vi.fn(),
			countTokens: vi.fn().mockResolvedValue(100),
		} as any
	})

	it("should maintain backward compatibility with summarizeConversation", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1000 },
			{ role: "assistant", content: "Hi there!", ts: 1001 },
			{ role: "user", content: "How are you?", ts: 1002 },
			{ role: "assistant", content: "I'm doing well!", ts: 1003 },
			{ role: "user", content: "Can you help me?", ts: 1004 },
		] as any

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary of conversation" }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 20,
					totalCost: 0.0006,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)

		const result = await summarizeConversation(
			messages,
			mockApiHandler,
			"You are a helpful assistant",
			"task-123",
			200,
		)

		// Check backward compatible format
		expect(result).toHaveProperty("messages")
		expect(result).toHaveProperty("cost")
		expect(result).toHaveProperty("summary")
		expect(result.messages.length).toBeGreaterThan(0)
		expect(result.summary).toContain("Summary")
		expect(result.cost).toBeGreaterThan(0)
		expect(result.newContextTokens).toBeDefined()
		expect(result.error).toBeUndefined()
	})

	it("should support custom condensing prompt", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Test", ts: 1000 },
			{ role: "assistant", content: "Response 1", ts: 1001 },
			{ role: "user", content: "Question", ts: 1002 },
			{ role: "assistant", content: "Response 2", ts: 1003 },
			{ role: "user", content: "Final", ts: 1004 },
		] as any

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
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(60)

		const customPrompt = "Summarize: {conversation}"

		const result = await summarizeConversation(
			messages,
			mockApiHandler,
			"System prompt",
			"task-123",
			200,
			false,
			customPrompt,
		)

		expect(result.summary).toContain("Custom summary")
		expect(result.error).toBeUndefined()
	})

	it("should support dedicated API handler", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Test", ts: 1000 },
			{ role: "assistant", content: "Response 1", ts: 1001 },
			{ role: "user", content: "Question", ts: 1002 },
			{ role: "assistant", content: "Response 2", ts: 1003 },
			{ role: "user", content: "Final", ts: 1004 },
		] as any

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
		vi.mocked(dedicatedHandler.countTokens).mockResolvedValue(80)

		const result = await summarizeConversation(
			messages,
			mockApiHandler,
			"System prompt",
			"task-123",
			200,
			false,
			undefined,
			dedicatedHandler,
		)

		expect(dedicatedHandler.createMessage).toHaveBeenCalled()
		expect(mockApiHandler.createMessage).not.toHaveBeenCalled()
		expect(result.error).toBeUndefined()
	})

	it("should return error on condensation failure", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Test", ts: 1000 },
			{ role: "assistant", content: "Response", ts: 1001 },
			{ role: "user", content: "Question", ts: 1002 },
		] as any

		const result = await summarizeConversation(messages, mockApiHandler, "System prompt", "task-123", 200)

		expect(result.error).toBeDefined()
		expect(result.messages).toEqual(messages)
	})

	it("should handle automatic trigger flag", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1000 },
			{ role: "assistant", content: "Hi", ts: 1001 },
			{ role: "user", content: "Question", ts: 1002 },
			{ role: "assistant", content: "Answer", ts: 1003 },
			{ role: "user", content: "Final", ts: 1004 },
		] as any

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Auto summary" }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 20,
					totalCost: 0.0006,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)

		const result = await summarizeConversation(
			messages,
			mockApiHandler,
			"System prompt",
			"task-123",
			200,
			true, // automatic trigger
		)

		expect(result.error).toBeUndefined()
		expect(result.summary).toContain("Auto summary")
	})

	it("should preserve all result properties", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1000 },
			{ role: "assistant", content: "Hi", ts: 1001 },
			{ role: "user", content: "Question", ts: 1002 },
			{ role: "assistant", content: "Answer", ts: 1003 },
			{ role: "user", content: "Final", ts: 1004 },
		] as any

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Detailed summary" }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 20,
					totalCost: 0.0006,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)

		const result = await summarizeConversation(messages, mockApiHandler, "System prompt", "task-123", 200)

		// Verify all expected properties exist
		expect(result).toHaveProperty("messages")
		expect(result).toHaveProperty("cost")
		expect(result).toHaveProperty("summary")
		expect(result).toHaveProperty("newContextTokens")

		// Verify messages structure
		const summaryMsg = result.messages.find((m) => m.isSummary)
		expect(summaryMsg).toBeDefined()
		expect(summaryMsg?.content).toBe("Detailed summary")
	})

	it("should handle empty summary gracefully", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1000 },
			{ role: "assistant", content: "Hi", ts: 1001 },
			{ role: "user", content: "Question", ts: 1002 },
			{ role: "assistant", content: "Answer", ts: 1003 },
			{ role: "user", content: "Final", ts: 1004 },
		] as any

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "   " } // Whitespace only
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 0,
					totalCost: 0.0003,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

		const result = await summarizeConversation(messages, mockApiHandler, "System prompt", "task-123", 200)

		expect(result.error).toBeDefined()
		expect(result.cost).toBeGreaterThan(0)
		expect(result.messages).toEqual(messages)
	})

	it("should handle context growth correctly", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1000 },
			{ role: "assistant", content: "Hi", ts: 1001 },
			{ role: "user", content: "Question", ts: 1002 },
			{ role: "assistant", content: "Answer", ts: 1003 },
			{ role: "user", content: "Final", ts: 1004 },
		] as any

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				// Very long summary that would make context grow
				yield { type: "text" as const, text: "Very long summary ".repeat(100) }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 500,
					totalCost: 0.001,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(600)

		const result = await summarizeConversation(
			messages,
			mockApiHandler,
			"System prompt",
			"task-123",
			1000, // prevContextTokens - should fail because new would be >= this
		)

		expect(result.error).toBeDefined()
		expect(result.messages).toEqual(messages)
		expect(result.cost).toBeGreaterThan(0)
	})

	it("should handle mixed content in messages", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: [{ type: "text", text: "Hello" }], ts: 1000 },
			{ role: "assistant", content: "Hi", ts: 1001 },
			{ role: "user", content: "Question", ts: 1002 },
			{ role: "assistant", content: [{ type: "text", text: "Answer" }], ts: 1003 },
			{ role: "user", content: "Final", ts: 1004 },
		] as any

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

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)
		vi.mocked(mockApiHandler.getModel).mockReturnValue({
			id: "test-model",
			info: {
				supportsImages: true,
			} as any,
		})

		const result = await summarizeConversation(messages, mockApiHandler, "System prompt", "task-123", 200)

		expect(result.error).toBeUndefined()
		expect(result.summary).toContain("mixed content")
	})

	it("should handle messages with isSummary flag in input", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1000 },
			{ role: "assistant", content: "Previous summary", ts: 1001, isSummary: true },
			{ role: "user", content: "Question", ts: 1002 },
			{ role: "assistant", content: "Answer", ts: 1003 },
			{ role: "user", content: "Final", ts: 1004 },
		] as any

		const result = await summarizeConversation(messages, mockApiHandler, "System prompt", "task-123", 200)

		// Should not summarize when there's a recent summary
		expect(result.error).toBeDefined()
		expect(result.messages).toEqual(messages)
	})

	it("should handle very large message count", async () => {
		const messages: ApiMessage[] = Array.from({ length: 100 }, (_, i) => ({
			role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
			content: `Message ${i}`,
			ts: 1000 + i,
		})) as any

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text" as const, text: "Summary of 100 messages" }
				yield {
					type: "usage" as const,
					inputTokens: 1000,
					outputTokens: 50,
					totalCost: 0.005,
				}
			},
		}

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(200)

		const result = await summarizeConversation(messages, mockApiHandler, "System prompt", "task-123", 5000)

		expect(result.error).toBeUndefined()
		expect(result.summary).toBe("Summary of 100 messages")
		expect(result.messages.length).toBeLessThan(messages.length)
	})

	it("should handle zero prevContextTokens", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1000 },
			{ role: "assistant", content: "Hi", ts: 1001 },
			{ role: "user", content: "Question", ts: 1002 },
			{ role: "assistant", content: "Answer", ts: 1003 },
			{ role: "user", content: "Final", ts: 1004 },
		] as any

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

		vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(40)

		const result = await summarizeConversation(
			messages,
			mockApiHandler,
			"System prompt",
			"task-123",
			0, // Zero previous context
		)

		// Should fail because new context would grow from 0
		expect(result.error).toBeDefined()
		expect(result.messages).toEqual(messages)
	})

	it("should preserve message timestamps correctly", async () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1000 },
			{ role: "assistant", content: "Hi", ts: 1001 },
			{ role: "user", content: "Question", ts: 1002 },
			{ role: "assistant", content: "Answer", ts: 1003 },
			{ role: "user", content: "Final", ts: 1004 },
		] as any

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
		vi.mocked(mockApiHandler.countTokens).mockResolvedValue(80)

		const result = await summarizeConversation(messages, mockApiHandler, "System prompt", "task-123", 200)

		expect(result.error).toBeUndefined()

		// Find summary message
		const summaryMsg = result.messages.find((m) => m.isSummary)
		expect(summaryMsg).toBeDefined()
		expect(summaryMsg?.ts).toBeDefined()
		expect(typeof summaryMsg?.ts).toBe("number")
	})
})
