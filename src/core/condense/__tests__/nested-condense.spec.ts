import { describe, it, expect } from "vitest"
import { ApiMessage } from "../../task-persistence/apiMessages"
import { getEffectiveApiHistory, getMessagesSinceLastSummary } from "../index"

describe("nested condensing scenarios", () => {
	describe("fresh-start model (user-role summaries)", () => {
		it("should return only the latest summary and messages after it", () => {
			const condenseId1 = "condense-1"
			const condenseId2 = "condense-2"

			// Simulate history after two nested condenses with user-role summaries
			const history: ApiMessage[] = [
				// Original task - condensed in first condense
				{ role: "user", content: "Build an app", ts: 100, condenseParent: condenseId1 },
				// Messages from first condense
				{ role: "assistant", content: "Starting...", ts: 200, condenseParent: condenseId1 },
				{ role: "user", content: "Add auth", ts: 300, condenseParent: condenseId1 },
				// First summary (user role, fresh-start model) - then condensed in second condense
				{
					role: "user",
					content: [{ type: "text", text: "## Summary 1" }],
					ts: 399,
					isSummary: true,
					condenseId: condenseId1,
					condenseParent: condenseId2, // Tagged during second condense
				},
				// Messages after first condense but before second
				{ role: "assistant", content: "Auth added", ts: 400, condenseParent: condenseId2 },
				{ role: "user", content: "Add database", ts: 500, condenseParent: condenseId2 },
				// Second summary (user role, fresh-start model)
				{
					role: "user",
					content: [{ type: "text", text: "## Summary 2" }],
					ts: 599,
					isSummary: true,
					condenseId: condenseId2,
				},
				// Messages after second condense (kept messages)
				{ role: "assistant", content: "Database added", ts: 600 },
				{ role: "user", content: "Now test it", ts: 700 },
			]

			// Step 1: Get effective history
			const effectiveHistory = getEffectiveApiHistory(history)

			// Should only contain: Summary2, and messages after it
			expect(effectiveHistory.length).toBe(3)
			expect(effectiveHistory[0].isSummary).toBe(true)
			expect(effectiveHistory[0].condenseId).toBe(condenseId2) // Latest summary
			expect(effectiveHistory[1].content).toBe("Database added")
			expect(effectiveHistory[2].content).toBe("Now test it")

			// Verify NO condensed messages are included
			const hasCondensedMessages = effectiveHistory.some(
				(msg) => msg.condenseParent && history.some((m) => m.isSummary && m.condenseId === msg.condenseParent),
			)
			expect(hasCondensedMessages).toBe(false)

			// Step 2: Get messages since last summary (on effective history)
			const messagesSinceLastSummary = getMessagesSinceLastSummary(effectiveHistory)

			// Should be the same as effective history since Summary2 is already at the start
			expect(messagesSinceLastSummary.length).toBe(3)
			expect(messagesSinceLastSummary[0].isSummary).toBe(true)
			expect(messagesSinceLastSummary[0].condenseId).toBe(condenseId2)

			// CRITICAL: No previous history (Summary1 or original task) should be included
			const hasSummary1 = messagesSinceLastSummary.some((m) => m.condenseId === condenseId1)
			expect(hasSummary1).toBe(false)

			const hasOriginalTask = messagesSinceLastSummary.some((m) => m.content === "Build an app")
			expect(hasOriginalTask).toBe(false)
		})

		it("should handle triple nested condense correctly", () => {
			const condenseId1 = "condense-1"
			const condenseId2 = "condense-2"
			const condenseId3 = "condense-3"

			const history: ApiMessage[] = [
				// First condense content
				{ role: "user", content: "Task", ts: 100, condenseParent: condenseId1 },
				{
					role: "user",
					content: [{ type: "text", text: "## Summary 1" }],
					ts: 199,
					isSummary: true,
					condenseId: condenseId1,
					condenseParent: condenseId2,
				},
				// Second condense content
				{ role: "assistant", content: "After S1", ts: 200, condenseParent: condenseId2 },
				{
					role: "user",
					content: [{ type: "text", text: "## Summary 2" }],
					ts: 299,
					isSummary: true,
					condenseId: condenseId2,
					condenseParent: condenseId3,
				},
				// Third condense content
				{ role: "assistant", content: "After S2", ts: 300, condenseParent: condenseId3 },
				{
					role: "user",
					content: [{ type: "text", text: "## Summary 3" }],
					ts: 399,
					isSummary: true,
					condenseId: condenseId3,
				},
				// Current messages
				{ role: "assistant", content: "Current work", ts: 400 },
			]

			const effectiveHistory = getEffectiveApiHistory(history)

			// Should only contain Summary3 and current work
			expect(effectiveHistory.length).toBe(2)
			expect(effectiveHistory[0].condenseId).toBe(condenseId3)
			expect(effectiveHistory[1].content).toBe("Current work")

			const messagesSinceLastSummary = getMessagesSinceLastSummary(effectiveHistory)
			expect(messagesSinceLastSummary.length).toBe(2)

			// No previous summaries should be included
			const hasPreviousSummaries = messagesSinceLastSummary.some(
				(m) => m.condenseId === condenseId1 || m.condenseId === condenseId2,
			)
			expect(hasPreviousSummaries).toBe(false)
		})
	})

	describe("legacy assistant-role summaries (Bedrock fix scenario)", () => {
		it("should NOT duplicate the summary when summary is assistant role", () => {
			const condenseId = "condense-1"

			const history: ApiMessage[] = [
				{ role: "user", content: "Task", ts: 100, condenseParent: condenseId },
				{ role: "assistant", content: "Response", ts: 200, condenseParent: condenseId },
				// Legacy summary with assistant role
				{
					role: "assistant",
					content: "Summary of work",
					ts: 299,
					isSummary: true,
					condenseId,
				},
				{ role: "user", content: "Continue", ts: 300 },
			]

			const effectiveHistory = getEffectiveApiHistory(history)
			expect(effectiveHistory.length).toBe(2)
			expect(effectiveHistory[0].isSummary).toBe(true)

			const messagesSinceLastSummary = getMessagesSinceLastSummary(effectiveHistory)

			// The Bedrock fix might trigger, but it should NOT create duplicates
			// when the input is already the effective history
			const summaryCount = messagesSinceLastSummary.filter((m) => m.isSummary).length
			expect(summaryCount).toBe(1) // Only one summary, not duplicated

			// Should have summary + "Continue"
			expect(messagesSinceLastSummary.length).toBeLessThanOrEqual(3)
		})

		it("should NOT include original task when called on effective history", () => {
			const condenseId = "condense-1"

			const history: ApiMessage[] = [
				{ role: "user", content: "Original task content", ts: 100, condenseParent: condenseId },
				{
					role: "assistant",
					content: "Legacy summary",
					ts: 199,
					isSummary: true,
					condenseId,
				},
				{ role: "user", content: "After summary", ts: 200 },
			]

			const effectiveHistory = getEffectiveApiHistory(history)
			const messagesSinceLastSummary = getMessagesSinceLastSummary(effectiveHistory)

			// The original task should NOT be in the result
			const hasOriginalTask = messagesSinceLastSummary.some((m) => m.content === "Original task content")
			expect(hasOriginalTask).toBe(false)
		})

		describe("BUG: getMessagesSinceLastSummary with full history (summarization input)", () => {
			it("should NOT include original task in summarization input when summary is assistant role", () => {
				const condenseId = "condense-1"

				// Scenario: First condense created an assistant-role summary (legacy)
				// Now we're doing a second condense
				const fullHistory: ApiMessage[] = [
					// Original task - was condensed in first condense
					{
						role: "user",
						content: "Original task that should NOT be in summarization input",
						ts: 100,
						condenseParent: condenseId,
					},
					{ role: "assistant", content: "Old response", ts: 200, condenseParent: condenseId },
					// Legacy assistant-role summary from first condense
					{
						role: "assistant", // <-- Legacy: assistant role
						content: "First summary",
						ts: 299,
						isSummary: true,
						condenseId,
					},
					// New messages to be summarized in second condense
					{ role: "user", content: "Message after summary", ts: 300 },
					{ role: "assistant", content: "Response after summary", ts: 400 },
				]

				// This simulates what summarizeConversation does when called for manual condense
				const messagesToSummarize = getMessagesSinceLastSummary(fullHistory)

				// THE BUG: Bedrock fix prepends messages[0] (original task) when summary is assistant role
				// This is wrong because:
				// 1. The original task was already condensed (has condenseParent)
				// 2. It should not be included in the summarization input for the second condense

				// Check if original task is incorrectly included
				const hasOriginalTask = messagesToSummarize.some(
					(m) => typeof m.content === "string" && m.content.includes("Original task"),
				)

				// This test documents the current BUGGY behavior if it fails
				// The fix should make this pass by NOT including the original task
				console.log(
					"Messages to summarize:",
					messagesToSummarize.map((m) => ({
						role: m.role,
						content: typeof m.content === "string" ? m.content.substring(0, 50) : "[array]",
						condenseParent: m.condenseParent,
						isSummary: m.isSummary,
					})),
				)

				// EXPECTED: Original task should NOT be included
				// ACTUAL (if bug exists): Original task IS included due to Bedrock fix
				expect(hasOriginalTask).toBe(false)
			})

			it("should NOT include condensed messages when preparing summarization input", () => {
				const condenseId1 = "condense-1"

				const fullHistory: ApiMessage[] = [
					// Original condensed messages
					{ role: "user", content: "Condensed task", ts: 100, condenseParent: condenseId1 },
					{ role: "assistant", content: "Condensed response", ts: 200, condenseParent: condenseId1 },
					// First summary (assistant role for legacy)
					{
						role: "assistant",
						content: "Summary of first condense",
						ts: 299,
						isSummary: true,
						condenseId: condenseId1,
					},
					// Messages to be summarized
					{ role: "user", content: "New work", ts: 300 },
					{ role: "assistant", content: "New response", ts: 400 },
				]

				const messagesToSummarize = getMessagesSinceLastSummary(fullHistory)

				// Count how many messages with condenseParent are in the result
				const condensedMessagesInResult = messagesToSummarize.filter(
					(m) => m.condenseParent && m.condenseParent === condenseId1 && !m.isSummary,
				)

				console.log("Condensed messages in result:", condensedMessagesInResult.length)

				// No condensed messages (other than the summary which kicks off the new input) should be included
				expect(condensedMessagesInResult.length).toBe(0)
			})
		})
	})

	describe("getMessagesSinceLastSummary behavior with full vs effective history", () => {
		it("should behave differently when called with full history vs effective history", () => {
			const condenseId = "condense-1"

			const fullHistory: ApiMessage[] = [
				{ role: "user", content: "Original task", ts: 100, condenseParent: condenseId },
				{ role: "assistant", content: "Response", ts: 200, condenseParent: condenseId },
				{
					role: "user",
					content: [{ type: "text", text: "Summary" }],
					ts: 299,
					isSummary: true,
					condenseId,
				},
				{ role: "assistant", content: "After summary", ts: 300 },
			]

			// Called with FULL history (as in summarizeConversation)
			const fromFullHistory = getMessagesSinceLastSummary(fullHistory)

			// Called with EFFECTIVE history (as in attemptApiRequest)
			const effectiveHistory = getEffectiveApiHistory(fullHistory)
			const fromEffectiveHistory = getMessagesSinceLastSummary(effectiveHistory)

			// Both should return the same messages when summary is user role
			expect(fromFullHistory.length).toBe(fromEffectiveHistory.length)

			// The key difference: fromFullHistory[0] references fullHistory,
			// while fromEffectiveHistory[0] references effectiveHistory
			// With user-role summary, Bedrock fix should NOT trigger in either case
			expect(fromFullHistory[0].isSummary).toBe(true)
			expect(fromEffectiveHistory[0].isSummary).toBe(true)
		})

		it("BUG SCENARIO: Bedrock fix should not include condensed original task", () => {
			const condenseId1 = "condense-1"
			const condenseId2 = "condense-2"

			// Scenario: Two condenses, first summary is assistant role (legacy)
			const fullHistory: ApiMessage[] = [
				{ role: "user", content: "Original task - should NOT appear", ts: 100, condenseParent: condenseId1 },
				{ role: "assistant", content: "Old response", ts: 200, condenseParent: condenseId1 },
				// Legacy assistant-role summary, then condensed again
				{
					role: "assistant",
					content: "Summary 1",
					ts: 299,
					isSummary: true,
					condenseId: condenseId1,
					condenseParent: condenseId2,
				},
				{ role: "user", content: "After S1", ts: 300, condenseParent: condenseId2 },
				// Second summary (still assistant for legacy consistency in this test)
				{
					role: "assistant",
					content: "Summary 2",
					ts: 399,
					isSummary: true,
					condenseId: condenseId2,
				},
				{ role: "user", content: "Current message", ts: 400 },
			]

			const effectiveHistory = getEffectiveApiHistory(fullHistory)
			expect(effectiveHistory.length).toBe(2) // Summary2 + Current message

			const messagesSinceLastSummary = getMessagesSinceLastSummary(effectiveHistory)

			// CRITICAL BUG CHECK: The original task should NEVER be included
			const hasOriginalTask = messagesSinceLastSummary.some((m) =>
				typeof m.content === "string"
					? m.content.includes("Original task")
					: JSON.stringify(m.content).includes("Original task"),
			)

			// This assertion documents the expected behavior
			expect(hasOriginalTask).toBe(false)

			// Also verify Summary1 is not included
			const hasSummary1 = messagesSinceLastSummary.some((m) => m.condenseId === condenseId1)
			expect(hasSummary1).toBe(false)
		})
	})
})
