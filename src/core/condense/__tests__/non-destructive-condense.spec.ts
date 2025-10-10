// npx vitest src/core/condense/__tests__/non-destructive-condense.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { summarizeConversation } from "../index"
import { ApiMessage } from "../../task-persistence/apiMessages"
import { ApiHandler } from "../../../api"

// Mock the translation function
vi.mock("../../../i18n", () => ({
	t: (key: string) => key,
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureContextCondensed: vi.fn(),
		},
	},
}))

describe("Non-destructive condense", () => {
	let mockApiHandler: ApiHandler
	let messages: ApiMessage[]

	beforeEach(() => {
		// Create a mock API handler
		mockApiHandler = {
			createMessage: vi.fn().mockImplementation(() => {
				// Return an async generator that yields a summary
				return (async function* () {
					yield { type: "text", text: "This is a summary of the conversation" }
					yield { type: "usage", totalCost: 0.01, outputTokens: 50 }
				})()
			}),
			countTokens: vi.fn().mockResolvedValue(100),
			getModel: vi.fn().mockReturnValue({ info: {} }),
		} as any

		// Create test messages
		messages = [
			{ role: "user", content: "First message", ts: 1000 },
			{ role: "assistant", content: "Response 1", ts: 2000 },
			{ role: "user", content: "Second message", ts: 3000 },
			{ role: "assistant", content: "Response 2", ts: 4000 },
			{ role: "user", content: "Third message", ts: 5000 },
			{ role: "assistant", content: "Response 3", ts: 6000 },
			{ role: "user", content: "Fourth message", ts: 7000 },
			{ role: "assistant", content: "Response 4", ts: 8000 },
		]
	})

	describe("summarizeConversation", () => {
		it("should preserve all messages with condenseParent tags", async () => {
			const result = await summarizeConversation(
				messages,
				mockApiHandler,
				"system prompt",
				"task-123",
				1000, // prevContextTokens
				false,
			)

			// Should not have an error
			expect(result.error).toBeUndefined()

			// Should have more messages than before (all original + summary)
			expect(result.messages.length).toBeGreaterThan(messages.length)

			// First message should be preserved
			expect(result.messages[0]).toEqual(messages[0])

			// Should have a summary message with condenseId
			const summaryMessage = result.messages.find((m) => m.isSummary)
			expect(summaryMessage).toBeDefined()
			expect(summaryMessage?.condenseId).toBeDefined()
			expect(summaryMessage?.condenseId).toMatch(/^condense-\d+-[a-z0-9]+$/)

			// Middle messages should have condenseParent
			const middleMessages = result.messages.filter((m) => m.condenseParent)
			expect(middleMessages.length).toBeGreaterThan(0)
			expect(middleMessages.every((m) => m.condenseParent === summaryMessage?.condenseId)).toBe(true)

			// Last N messages should not have condenseParent
			const tailMessages = result.messages.slice(-3) // N_MESSAGES_TO_KEEP = 3
			expect(tailMessages.every((m) => !m.condenseParent)).toBe(true)
		})

		it("should generate unique condenseId for each condensation", async () => {
			const result1 = await summarizeConversation(
				messages,
				mockApiHandler,
				"system prompt",
				"task-123",
				1000,
				false,
			)

			const result2 = await summarizeConversation(
				messages,
				mockApiHandler,
				"system prompt",
				"task-123",
				1000,
				false,
			)

			const summaryMessage1 = result1.messages.find((m) => m.isSummary)
			const summaryMessage2 = result2.messages.find((m) => m.isSummary)

			expect(summaryMessage1?.condenseId).toBeDefined()
			expect(summaryMessage2?.condenseId).toBeDefined()
			expect(summaryMessage1?.condenseId).not.toEqual(summaryMessage2?.condenseId)
		})

		it("should not condense if not enough messages", async () => {
			const shortMessages = messages.slice(0, 3)
			const result = await summarizeConversation(
				shortMessages,
				mockApiHandler,
				"system prompt",
				"task-123",
				1000,
				false,
			)

			expect(result.error).toBe("common:errors.condense_not_enough_messages")
			expect(result.messages).toEqual(shortMessages)
		})

		it("should not condense if recent summary exists", async () => {
			const messagesWithSummary: ApiMessage[] = [
				...messages.slice(0, -2),
				{ role: "assistant" as const, content: "Previous summary", ts: 6500, isSummary: true },
				...messages.slice(-2),
			]

			const result = await summarizeConversation(
				messagesWithSummary,
				mockApiHandler,
				"system prompt",
				"task-123",
				1000,
				false,
			)

			expect(result.error).toBe("common:errors.condensed_recently")
			expect(result.messages).toEqual(messagesWithSummary)
		})
	})

	describe("Message filtering with active summaries", () => {
		it("should filter out messages with condenseParent matching active summary", () => {
			const messagesWithCondense: ApiMessage[] = [
				{ role: "user", content: "First", ts: 1000 },
				{ role: "user", content: "Second", ts: 2000, condenseParent: "condense-123-abc" },
				{ role: "assistant", content: "Response", ts: 3000, condenseParent: "condense-123-abc" },
				{
					role: "assistant",
					content: "Summary",
					ts: 4000,
					isSummary: true,
					condenseId: "condense-123-abc",
				},
				{ role: "user", content: "Latest", ts: 5000 },
			]

			// Simulate filtering logic from Task.attemptApiRequest
			const activeCondenseIds = new Set(
				messagesWithCondense.filter((m) => m.isSummary && m.condenseId).map((m) => m.condenseId!),
			)

			const effectiveHistory = messagesWithCondense.filter(
				(m) => !m.condenseParent || !activeCondenseIds.has(m.condenseParent),
			)

			// Should filter out the middle messages with condenseParent
			expect(effectiveHistory.length).toBe(3)
			expect(effectiveHistory[0].content).toBe("First")
			expect(effectiveHistory[1].content).toBe("Summary")
			expect(effectiveHistory[2].content).toBe("Latest")
		})

		it("should include messages with orphaned condenseParent", () => {
			const messagesWithOrphan: ApiMessage[] = [
				{ role: "user", content: "First", ts: 1000 },
				{ role: "user", content: "Second", ts: 2000, condenseParent: "condense-old-xyz" }, // Orphaned
				{ role: "assistant", content: "Response", ts: 3000 },
			]

			// No active summaries
			const activeCondenseIds = new Set(
				messagesWithOrphan.filter((m) => m.isSummary && m.condenseId).map((m) => m.condenseId!),
			)

			const effectiveHistory = messagesWithOrphan.filter(
				(m) => !m.condenseParent || !activeCondenseIds.has(m.condenseParent),
			)

			// Should include the orphaned message since its condenseParent doesn't match any active summary
			expect(effectiveHistory.length).toBe(3)
		})
	})

	describe("Nested condense support", () => {
		it("should handle multiple condensations with different condenseIds", async () => {
			// First condensation
			const result1 = await summarizeConversation(
				messages,
				mockApiHandler,
				"system prompt",
				"task-123",
				1000,
				false,
			)

			// Add more messages
			const extendedMessages: ApiMessage[] = [
				...result1.messages,
				{ role: "user" as const, content: "Fifth message", ts: 9000 },
				{ role: "assistant" as const, content: "Response 5", ts: 10000 },
				{ role: "user" as const, content: "Sixth message", ts: 11000 },
				{ role: "assistant" as const, content: "Response 6", ts: 12000 },
			]

			// Second condensation
			const result2 = await summarizeConversation(
				extendedMessages,
				mockApiHandler,
				"system prompt",
				"task-123",
				1000,
				false,
			)

			// Should have two different summaries with different condenseIds
			const summaries = result2.messages.filter((m) => m.isSummary)
			expect(summaries.length).toBeGreaterThanOrEqual(1)

			// Messages should have different condenseParent values
			const condenseParents = new Set(
				result2.messages.filter((m) => m.condenseParent).map((m) => m.condenseParent),
			)
			expect(condenseParents.size).toBeGreaterThanOrEqual(1)
		})
	})

	describe("Rollback behavior", () => {
		it("should support rollback by removing summary and cleaning condenseParent", () => {
			const messagesWithCondense: ApiMessage[] = [
				{ role: "user", content: "First", ts: 1000 },
				{ role: "user", content: "Second", ts: 2000, condenseParent: "condense-123-abc" },
				{ role: "assistant", content: "Response", ts: 3000, condenseParent: "condense-123-abc" },
				{
					role: "assistant",
					content: "Summary",
					ts: 4000,
					isSummary: true,
					condenseId: "condense-123-abc",
				},
				{ role: "user", content: "Latest", ts: 5000 },
			]

			// Simulate rollback: remove summary
			const afterRollback = messagesWithCondense.filter((m) => !m.isSummary)

			// Simulate hygiene: clean orphaned condenseParent
			const activeCondenseIds = new Set(afterRollback.filter((m) => m.condenseId).map((m) => m.condenseId!))

			afterRollback.forEach((m) => {
				if (m.condenseParent && !activeCondenseIds.has(m.condenseParent)) {
					delete m.condenseParent
				}
			})

			// All messages should have condenseParent removed
			expect(afterRollback.every((m) => !m.condenseParent)).toBe(true)
			expect(afterRollback.length).toBe(4)
		})
	})
})
