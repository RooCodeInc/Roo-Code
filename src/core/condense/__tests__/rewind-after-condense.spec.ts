// npx vitest src/core/condense/__tests__/rewind-after-condense.spec.ts

/**
 * Regression tests for the issue: "Rewind after Condense is broken"
 * https://github.com/RooCodeInc/Roo-Code/issues/8295
 *
 * These tests verify that when a user rewinds (deletes/truncates) their conversation
 * after a condense operation, the orphaned condensed messages are properly reactivated
 * so they can be sent to the API again.
 */

import { TelemetryService } from "@roo-code/telemetry"

import { getEffectiveApiHistory, cleanupAfterTruncation } from "../index"
import { ApiMessage } from "../../task-persistence/apiMessages"

describe("Rewind After Condense - Issue #8295", () => {
	beforeEach(() => {
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}
	})

	describe("getEffectiveApiHistory", () => {
		it("should filter out messages tagged with condenseParent", () => {
			const condenseId = "summary-123"
			const messages: ApiMessage[] = [
				{ role: "user", content: "First message", ts: 1 },
				{ role: "assistant", content: "First response", ts: 2, condenseParent: condenseId },
				{ role: "user", content: "Second message", ts: 3, condenseParent: condenseId },
				{ role: "assistant", content: "Summary", ts: 4, isSummary: true, condenseId },
				{ role: "user", content: "Third message", ts: 5 },
				{ role: "assistant", content: "Third response", ts: 6 },
			]

			const effective = getEffectiveApiHistory(messages)

			// Effective history should be: first message, summary, third message, third response
			expect(effective.length).toBe(4)
			expect(effective[0].content).toBe("First message")
			expect(effective[1].isSummary).toBe(true)
			expect(effective[2].content).toBe("Third message")
			expect(effective[3].content).toBe("Third response")
		})

		it("should include messages without condenseParent", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Hello", ts: 1 },
				{ role: "assistant", content: "Hi", ts: 2 },
			]

			const effective = getEffectiveApiHistory(messages)

			expect(effective.length).toBe(2)
			expect(effective).toEqual(messages)
		})

		it("should handle empty messages array", () => {
			const effective = getEffectiveApiHistory([])
			expect(effective).toEqual([])
		})
	})

	describe("cleanupAfterTruncation", () => {
		it("should clear condenseParent when summary message is deleted", () => {
			const condenseId = "summary-123"
			const messages: ApiMessage[] = [
				{ role: "user", content: "First message", ts: 1 },
				{ role: "assistant", content: "First response", ts: 2, condenseParent: condenseId },
				{ role: "user", content: "Second message", ts: 3, condenseParent: condenseId },
				// Summary is NOT in the array (was truncated/deleted)
			]

			const cleaned = cleanupAfterTruncation(messages)

			// All condenseParent tags should be cleared since summary is gone
			expect(cleaned[1].condenseParent).toBeUndefined()
			expect(cleaned[2].condenseParent).toBeUndefined()
		})

		it("should preserve condenseParent when summary message still exists", () => {
			const condenseId = "summary-123"
			const messages: ApiMessage[] = [
				{ role: "user", content: "First message", ts: 1 },
				{ role: "assistant", content: "First response", ts: 2, condenseParent: condenseId },
				{ role: "assistant", content: "Summary", ts: 3, isSummary: true, condenseId },
			]

			const cleaned = cleanupAfterTruncation(messages)

			// condenseParent should remain since summary exists
			expect(cleaned[1].condenseParent).toBe(condenseId)
		})

		it("should handle multiple condense operations with different IDs", () => {
			const condenseId1 = "summary-1"
			const condenseId2 = "summary-2"
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1, condenseParent: condenseId1 },
				{ role: "assistant", content: "Summary 1", ts: 2, isSummary: true, condenseId: condenseId1 },
				{ role: "user", content: "Message 2", ts: 3, condenseParent: condenseId2 },
				// Summary 2 is NOT present (was truncated)
			]

			const cleaned = cleanupAfterTruncation(messages)

			// condenseId1 should remain (summary exists)
			expect(cleaned[0].condenseParent).toBe(condenseId1)
			// condenseId2 should be cleared (summary deleted)
			expect(cleaned[2].condenseParent).toBeUndefined()
		})

		it("should not modify messages without condenseParent", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Hello", ts: 1 },
				{ role: "assistant", content: "Hi", ts: 2 },
			]

			const cleaned = cleanupAfterTruncation(messages)

			expect(cleaned).toEqual(messages)
		})

		it("should handle empty messages array", () => {
			const cleaned = cleanupAfterTruncation([])
			expect(cleaned).toEqual([])
		})
	})

	describe("Rewind scenario: truncate after condense", () => {
		it("should reactivate condensed messages when their summary is deleted via truncation", () => {
			const condenseId = "summary-abc"

			// Simulate a conversation after condensing
			const fullHistory: ApiMessage[] = [
				{ role: "user", content: "Initial task", ts: 1 },
				{ role: "assistant", content: "Working on it", ts: 2, condenseParent: condenseId },
				{ role: "user", content: "Continue", ts: 3, condenseParent: condenseId },
				{ role: "assistant", content: "Summary of work so far", ts: 4, isSummary: true, condenseId },
				{ role: "user", content: "Now do this", ts: 5 },
				{ role: "assistant", content: "Done", ts: 6 },
				{ role: "user", content: "And this", ts: 7 },
				{ role: "assistant", content: "Also done", ts: 8 },
			]

			// Verify effective history before truncation
			const effectiveBefore = getEffectiveApiHistory(fullHistory)
			// Should be: first message, summary, last 4 messages
			expect(effectiveBefore.length).toBe(6)

			// Simulate rewind: user truncates back to message ts=4 (keeping 0-3)
			const truncatedHistory = fullHistory.slice(0, 4) // Keep first, condensed1, condensed2, summary

			// After truncation, the summary is still there, so condensed messages remain condensed
			const cleanedAfterKeepingSummary = cleanupAfterTruncation(truncatedHistory)
			expect(cleanedAfterKeepingSummary[1].condenseParent).toBe(condenseId)
			expect(cleanedAfterKeepingSummary[2].condenseParent).toBe(condenseId)

			// Now simulate a more aggressive rewind: delete back to message ts=2
			const aggressiveTruncate = fullHistory.slice(0, 2) // Keep only first message and first response

			// The condensed messages should now be reactivated since summary is gone
			const cleanedAfterDeletingSummary = cleanupAfterTruncation(aggressiveTruncate)
			expect(cleanedAfterDeletingSummary[1].condenseParent).toBeUndefined()

			// Verify effective history after cleanup
			const effectiveAfterCleanup = getEffectiveApiHistory(cleanedAfterDeletingSummary)
			// Now both messages should be active (no condensed filtering)
			expect(effectiveAfterCleanup.length).toBe(2)
			expect(effectiveAfterCleanup[0].content).toBe("Initial task")
			expect(effectiveAfterCleanup[1].content).toBe("Working on it")
		})

		it("should properly restore context after rewind when summary was deleted", () => {
			const condenseId = "summary-xyz"

			// Scenario: Most of the conversation was condensed, but the summary was deleted.
			// getEffectiveApiHistory already correctly handles orphaned messages (includes them
			// when their summary doesn't exist). cleanupAfterTruncation cleans up the tags.
			const messages: ApiMessage[] = [
				{ role: "user", content: "Start", ts: 1 },
				{ role: "assistant", content: "Response 1", ts: 2, condenseParent: condenseId },
				{ role: "user", content: "More", ts: 3, condenseParent: condenseId },
				{ role: "assistant", content: "Response 2", ts: 4, condenseParent: condenseId },
				{ role: "user", content: "Even more", ts: 5, condenseParent: condenseId },
				// Summary was deleted (not present), so these are "orphaned" messages
			]

			// getEffectiveApiHistory already includes orphaned messages (summary doesn't exist)
			const effectiveBefore = getEffectiveApiHistory(messages)
			expect(effectiveBefore.length).toBe(5) // All messages visible since summary was deleted
			expect(effectiveBefore[0].content).toBe("Start")
			expect(effectiveBefore[1].content).toBe("Response 1")

			// cleanupAfterTruncation clears the orphaned condenseParent tags for data hygiene
			const cleaned = cleanupAfterTruncation(messages)

			// Verify condenseParent was cleared for all orphaned messages
			expect(cleaned[1].condenseParent).toBeUndefined()
			expect(cleaned[2].condenseParent).toBeUndefined()
			expect(cleaned[3].condenseParent).toBeUndefined()
			expect(cleaned[4].condenseParent).toBeUndefined()

			// After cleanup, effective history is the same (all visible)
			const effectiveAfter = getEffectiveApiHistory(cleaned)
			expect(effectiveAfter.length).toBe(5) // All messages visible
		})

		it("should hide condensed messages when their summary still exists", () => {
			const condenseId = "summary-exists"

			// Scenario: Messages were condensed and summary exists - condensed messages should be hidden
			const messages: ApiMessage[] = [
				{ role: "user", content: "Start", ts: 1 },
				{ role: "assistant", content: "Response 1", ts: 2, condenseParent: condenseId },
				{ role: "user", content: "More", ts: 3, condenseParent: condenseId },
				{ role: "assistant", content: "Summary", ts: 4, isSummary: true, condenseId },
				{ role: "user", content: "After summary", ts: 5 },
			]

			// Effective history should hide condensed messages since summary exists
			const effective = getEffectiveApiHistory(messages)
			expect(effective.length).toBe(3) // Start, Summary, After summary
			expect(effective[0].content).toBe("Start")
			expect(effective[1].content).toBe("Summary")
			expect(effective[2].content).toBe("After summary")

			// cleanupAfterTruncation should NOT clear condenseParent since summary exists
			const cleaned = cleanupAfterTruncation(messages)
			expect(cleaned[1].condenseParent).toBe(condenseId)
			expect(cleaned[2].condenseParent).toBe(condenseId)
		})
	})
})
