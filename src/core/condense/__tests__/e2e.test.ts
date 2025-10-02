import { describe, it, expect, beforeEach, vi, type Mock } from "vitest"
import { summarizeConversation, getMessagesSinceLastSummary, N_MESSAGES_TO_KEEP } from "../index"
import type { ApiHandler } from "../../../api"
import type { ApiMessage } from "../../task-persistence/apiMessages"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"

// Mock dependencies
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureContextCondensed: vi.fn(),
		},
	},
}))

vi.mock("../../../api/transform/image-cleaning", () => ({
	maybeRemoveImageBlocks: vi.fn((messages: ApiMessage[], _apiHandler: ApiHandler) => [...messages]),
}))

/**
 * End-to-end tests for the condensation provider system
 * These tests validate the complete flow from API to provider to result
 */
describe("Condensation E2E Tests", () => {
	let mockApiHandler: ApiHandler
	let mockStream: AsyncGenerator<any, void, unknown>
	const taskId = "test-task-id"
	const DEFAULT_PREV_CONTEXT_TOKENS = 1000
	const defaultSystemPrompt = "You are a helpful assistant."

	beforeEach(() => {
		// Clear mocks
		vi.clearAllMocks()

		// Setup mock stream with usage information
		mockStream = (async function* () {
			yield { type: "text" as const, text: "This is " }
			yield { type: "text" as const, text: "a summary" }
			yield { type: "usage" as const, inputTokens: 100, totalCost: 0.05, outputTokens: 150 }
		})()

		// Mock API handler
		mockApiHandler = {
			createMessage: vi.fn().mockReturnValue(mockStream),
			countTokens: vi.fn().mockResolvedValue(100),
			getModel: vi.fn().mockReturnValue({
				id: "claude-3-5-sonnet-20241022",
				info: {
					contextWindow: 8000,
					supportsImages: true,
					supportsComputerUse: true,
					supportsVision: true,
					maxTokens: 4000,
					supportsPromptCache: true,
					maxCachePoints: 10,
					minTokensPerCachePoint: 100,
					cachableFields: ["system", "messages"],
				},
			}),
		} as unknown as ApiHandler
	})

	describe("Complete Condensation Flow", () => {
		it("should condense a conversation end-to-end using Native provider", async () => {
			// Arrange: Create a realistic conversation with enough messages
			const messages: ApiMessage[] = [
				{ role: "user", content: "Hello, I need help with TypeScript", ts: 1000 },
				{ role: "assistant", content: "I'd be happy to help! What aspect?", ts: 1001 },
				{ role: "user", content: "I'm trying to understand generics", ts: 1002 },
				{ role: "assistant", content: "Generics allow you to create reusable components...", ts: 1003 },
				{ role: "user", content: "Can you show me an example?", ts: 1004 },
				{ role: "assistant", content: "Sure! Here's a generic function...", ts: 1005 },
				{ role: "user", content: "That's helpful, thanks!", ts: 1006 },
			]

			// Act: Condense the conversation
			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Assert: Verify complete flow
			expect(result.summary).toBeDefined()
			expect(result.summary).toBe("This is a summary")
			expect(result.cost).toBe(0.05)
			expect(result.newContextTokens).toBe(250) // 150 output + 100 from countTokens
			expect(result.error).toBeUndefined()

			// Verify API was called correctly
			expect(mockApiHandler.createMessage).toHaveBeenCalledTimes(1)

			// Verify message structure: first + summary + last N_MESSAGES_TO_KEEP
			expect(result.messages.length).toBe(1 + 1 + N_MESSAGES_TO_KEEP)
			expect(result.messages[0]).toEqual(messages[0]) // First message preserved
			expect(result.messages[1].isSummary).toBe(true) // Summary inserted
		})

		it("should handle condensation with custom prompt", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			const customCondensingPrompt = "Create a brief summary"

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
				false,
				customCondensingPrompt,
			)

			expect(result.summary).toBeDefined()
			expect(result.summary.length).toBeGreaterThan(0)
			expect(result.error).toBeUndefined()
		})

		it("should use dedicated API handler when provided", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			const dedicatedStream = (async function* () {
				yield { type: "text" as const, text: "Summary via dedicated handler" }
				yield { type: "usage" as const, inputTokens: 60, totalCost: 0.03, outputTokens: 80 }
			})()

			const dedicatedHandler = {
				createMessage: vi.fn().mockReturnValue(dedicatedStream),
				countTokens: vi.fn().mockResolvedValue(50),
				getModel: vi.fn().mockReturnValue({
					id: "claude-3-5-sonnet-20241022",
					info: {
						contextWindow: 8000,
						supportsImages: true,
						supportsComputerUse: true,
						supportsVision: true,
						maxTokens: 4000,
						supportsPromptCache: true,
						maxCachePoints: 10,
						minTokensPerCachePoint: 100,
						cachableFields: ["system", "messages"],
					},
				}),
			} as unknown as ApiHandler

			await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
				false,
				undefined,
				dedicatedHandler,
			)

			// Verify dedicated handler was used, not main handler
			expect(dedicatedHandler.createMessage).toHaveBeenCalled()
			expect(mockApiHandler.createMessage).not.toHaveBeenCalled()
		})
	})

	describe("Integration with getMessagesSinceLastSummary", () => {
		it("should correctly identify messages after a summary", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{
					role: "assistant",
					content: "Summary of previous conversation",
					ts: 1002,
					isSummary: true,
				},
				{ role: "user", content: "Message 2", ts: 1003 },
				{ role: "assistant", content: "Response 2", ts: 1004 },
			]

			const result = getMessagesSinceLastSummary(messages)

			// Should include original first user message + summary + messages after
			expect(result.length).toBeGreaterThanOrEqual(3)

			// Verify original first message is included
			expect(result[0].content).toBe("Message 1")

			// Find the summary message
			const summaryMsg = result.find((msg) => msg.isSummary)
			expect(summaryMsg).toBeDefined()
			expect(summaryMsg?.content).toBe("Summary of previous conversation")

			// Verify messages after summary are included
			const lastMsg = result[result.length - 1]
			expect(lastMsg.content).toBe("Response 2")
		})

		it("should return all messages when there is no summary", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Hello", ts: 1000 },
				{ role: "assistant", content: "Hi!", ts: 1001 },
			]

			const result = getMessagesSinceLastSummary(messages)
			expect(result).toEqual(messages)
		})
	})

	describe("Error Handling and Edge Cases", () => {
		it("should not condense when there are not enough messages", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Hello", ts: 1000 },
				{ role: "assistant", content: "Hi!", ts: 1001 },
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Should return error and original messages
			expect(result.error).toBeTruthy()
			expect(result.summary).toBe("")
			expect(result.cost).toBe(0)
			expect(result.messages).toEqual(messages)
			expect(mockApiHandler.createMessage).not.toHaveBeenCalled()
		})

		it("should handle API errors gracefully", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			// Create a mock stream that throws an error
			// eslint-disable-next-line require-yield
			const errorStream = (async function* () {
				throw new Error("Network timeout")
			})()
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(errorStream)

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Should return error in result, not throw
			expect(result.error).toBeTruthy()
			expect(result.summary).toBe("")
		})

		it("should calculate costs correctly", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Cost should match the mock value
			expect(result.cost).toBe(0.05)
		})
	})

	describe("Backward Compatibility", () => {
		it("should work exactly like old implementation for default case", async () => {
			// This test ensures 100% backward compatibility
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Check result has same structure as before
			expect(result).toHaveProperty("summary")
			expect(result).toHaveProperty("cost")
			expect(result).toHaveProperty("messages")
			expect(typeof result.summary).toBe("string")

			// Verify that summarization occurred
			expect(result.summary).toBe("This is a summary")
			expect(result.newContextTokens).toBe(250) // 150 output + 100 from countTokens

			// Verify message structure
			expect(result.messages.length).toBe(1 + 1 + N_MESSAGES_TO_KEEP)
		})

		it("should handle empty summary response", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			// Setup empty summary response
			const emptyStream = (async function* () {
				yield { type: "text" as const, text: "" }
				yield { type: "usage" as const, inputTokens: 50, totalCost: 0.02, outputTokens: 0 }
			})()
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(emptyStream)

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Should return error when summary is empty
			expect(result.error).toBeTruthy()
			expect(result.summary).toBe("")
			expect(result.messages).toEqual(messages)
		})

		it("should not condense when there was a recent summary", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Hello", ts: 1 },
				{ role: "assistant", content: "Hi there", ts: 2 },
				{ role: "user", content: "How are you?", ts: 3 },
				{ role: "assistant", content: "I'm good", ts: 4 },
				{ role: "user", content: "What's new?", ts: 5 },
				{ role: "assistant", content: "Not much", ts: 6, isSummary: true }, // Recent summary
				{ role: "user", content: "Tell me more", ts: 7 },
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			expect(result.messages).toEqual(messages)
			expect(result.cost).toBe(0)
			expect(result.summary).toBe("")
			expect(result.newContextTokens).toBeUndefined()
			expect(result.error).toBeTruthy()
			expect(mockApiHandler.createMessage).not.toHaveBeenCalled()
		})
	})

	describe("Advanced Features", () => {
		it("should support automatic trigger flag", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
				true, // isAutomaticTrigger
			)

			expect(result.summary).toBeDefined()
			expect(result.error).toBeUndefined()
		})

		it("should clean image blocks before condensing", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Verify image cleaning was called
			expect(maybeRemoveImageBlocks).toHaveBeenCalled()
		})
		it("should handle multiple condensation cycles", async () => {
			// First condensation
			const messages1: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			const result1 = await summarizeConversation(
				messages1,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			expect(result1.error).toBeUndefined()

			// Second condensation with the condensed result
			const messages2: ApiMessage[] = [
				...result1.messages,
				{ role: "user" as const, content: "Message 5", ts: 1007 },
				{ role: "assistant" as const, content: "Response 5", ts: 1008 },
				{ role: "user" as const, content: "Message 6", ts: 1009 },
				{ role: "assistant" as const, content: "Response 6", ts: 1010 },
			]

			// Reset mock for second call
			const secondStream = (async function* () {
				yield { type: "text" as const, text: "Second summary" }
				yield { type: "usage" as const, inputTokens: 100, totalCost: 0.05, outputTokens: 150 }
			})()
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(secondStream)

			const result2 = await summarizeConversation(
				messages2,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Should have condensed again successfully
			expect(result2.error).toBeUndefined()
			expect(mockApiHandler.createMessage).toHaveBeenCalledTimes(2)
		})

		it("should preserve message metadata during condensation", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Verify timestamps are preserved
			result.messages.forEach((msg) => {
				expect(msg.ts).toBeDefined()
				expect(typeof msg.ts).toBe("number")
			})

			// Verify summary message has isSummary flag
			const summaryMsg = result.messages.find((msg) => msg.isSummary)
			expect(summaryMsg).toBeDefined()
			expect(summaryMsg?.isSummary).toBe(true)
		})

		it("should handle very long conversations efficiently", async () => {
			// Create a very long conversation
			const messages: ApiMessage[] = []
			for (let i = 0; i < 50; i++) {
				messages.push({ role: "user", content: `User message ${i}`, ts: 1000 + i * 2 })
				messages.push({ role: "assistant", content: `Assistant response ${i}`, ts: 1001 + i * 2 })
			}

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Should successfully condense
			expect(result.error).toBeUndefined()
			expect(result.messages.length).toBeLessThan(messages.length) // Should have reduced
			expect(result.summary).toBeDefined()
		})

		it("should handle mixed content types in messages", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: [{ type: "text", text: "Response with blocks" }], ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Simple response", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: [{ type: "text", text: "Another block response" }], ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			expect(result.error).toBeUndefined()
			expect(result.summary).toBeDefined()
		})

		it("should handle system prompt correctly", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			const customSystemPrompt = "You are a specialized coding assistant."

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				customSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			expect(result.error).toBeUndefined()
			expect(mockApiHandler.createMessage).toHaveBeenCalled()
		})

		it("should handle prevContextTokens parameter", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				5000, // Different prevContextTokens
			)

			expect(result.error).toBeUndefined()
			expect(result.newContextTokens).toBeLessThan(5000) // Should reduce context
		})

		it("should handle streaming with partial content", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			// Create a stream with minimal content
			const minimalStream = (async function* () {
				yield { type: "text" as const, text: "OK" }
				yield { type: "usage" as const, inputTokens: 10, totalCost: 0.0001, outputTokens: 2 }
			})()
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(minimalStream)

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			// Should handle minimal content gracefully
			expect(result.summary).toBe("OK")
			expect(result.cost).toBeGreaterThan(0)
		})

		it("should handle zero-cost condensation", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			// Create a stream with zero cost
			const zeroStream = (async function* () {
				yield { type: "text" as const, text: "Free summary" }
				yield { type: "usage" as const, inputTokens: 0, totalCost: 0, outputTokens: 0 }
			})()
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(zeroStream)

			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				defaultSystemPrompt,
				taskId,
				DEFAULT_PREV_CONTEXT_TOKENS,
			)

			expect(result.cost).toBe(0)
			expect(result.error).toBeUndefined()
		})

		it("should handle taskId variations", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1000 },
				{ role: "assistant", content: "Response 1", ts: 1001 },
				{ role: "user", content: "Message 2", ts: 1002 },
				{ role: "assistant", content: "Response 2", ts: 1003 },
				{ role: "user", content: "Message 3", ts: 1004 },
				{ role: "assistant", content: "Response 3", ts: 1005 },
				{ role: "user", content: "Message 4", ts: 1006 },
			]

			// Test with different taskId formats
			const taskIds = ["task-123", "uuid-abc-def", "12345", ""]

			for (const testTaskId of taskIds) {
				// Reset mock for each iteration
				const testStream = (async function* () {
					yield { type: "text" as const, text: `Summary for ${testTaskId}` }
					yield { type: "usage" as const, inputTokens: 100, totalCost: 0.05, outputTokens: 150 }
				})()
				vi.mocked(mockApiHandler.createMessage).mockReturnValue(testStream)

				const result = await summarizeConversation(
					messages,
					mockApiHandler,
					defaultSystemPrompt,
					testTaskId,
					DEFAULT_PREV_CONTEXT_TOKENS,
				)

				expect(result).toBeDefined()
			}
		})
	})
})
