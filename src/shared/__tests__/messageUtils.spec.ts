// npx vitest run src/shared/__tests__/messageUtils.spec.ts

import type { ClineMessage } from "@roo-code/types"
import { getLineStatsFromToolApprovalMessages } from "../messageUtils"

describe("messageUtils", () => {
	describe("getLineStatsFromToolApprovalMessages", () => {
		it("should return zero stats for empty messages array", () => {
			const result = getLineStatsFromToolApprovalMessages([])

			expect(result).toEqual({
				linesAdded: 0,
				linesRemoved: 0,
				foundAnyStats: false,
			})
		})

		it("should ignore non-tool ask messages", () => {
			const messages: ClineMessage[] = [
				{ type: "say", say: "text", text: "hello", ts: 1000 },
				{ type: "ask", ask: "followup", text: '{"diffStats":{"added":10,"removed":5}}', ts: 1001 },
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 0,
				linesRemoved: 0,
				foundAnyStats: false,
			})
		})

		it("should ignore partial tool ask messages", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					partial: true,
					text: '{"diffStats":{"added":10,"removed":5}}',
					ts: 1000,
				},
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 0,
				linesRemoved: 0,
				foundAnyStats: false,
			})
		})

		it("should extract stats from a valid tool ask with diffStats", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					text: '{"diffStats":{"added":10,"removed":5}}',
					ts: 1000,
				},
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 10,
				linesRemoved: 5,
				foundAnyStats: true,
			})
		})

		it("should extract stats from batchDiffs array", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					text: JSON.stringify({
						batchDiffs: [{ diffStats: { added: 5, removed: 3 } }, { diffStats: { added: 15, removed: 7 } }],
					}),
					ts: 1000,
				},
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 20,
				linesRemoved: 10,
				foundAnyStats: true,
			})
		})

		it("should handle both diffStats and batchDiffs in the same message", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					text: JSON.stringify({
						diffStats: { added: 10, removed: 5 },
						batchDiffs: [{ diffStats: { added: 5, removed: 3 } }, { diffStats: { added: 15, removed: 7 } }],
					}),
					ts: 1000,
				},
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 30,
				linesRemoved: 15,
				foundAnyStats: true,
			})
		})

		it("should accumulate stats from multiple messages", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					text: '{"diffStats":{"added":10,"removed":5}}',
					ts: 1000,
				},
				{
					type: "ask",
					ask: "tool",
					text: '{"diffStats":{"added":20,"removed":15}}',
					ts: 1001,
				},
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 30,
				linesRemoved: 20,
				foundAnyStats: true,
			})
		})

		it("should ignore messages with invalid JSON", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					text: "not valid json",
					ts: 1000,
				},
				{
					type: "ask",
					ask: "tool",
					text: '{"diffStats":{"added":10,"removed":5}}',
					ts: 1001,
				},
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 10,
				linesRemoved: 5,
				foundAnyStats: true,
			})
		})

		it("should ignore messages with empty or missing text", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					text: "",
					ts: 1000,
				},
				{
					type: "ask",
					ask: "tool",
					ts: 1001,
				},
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 0,
				linesRemoved: 0,
				foundAnyStats: false,
			})
		})

		it("should ignore invalid diffStats (non-finite numbers)", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					text: '{"diffStats":{"added":"10","removed":5}}',
					ts: 1000,
				},
				{
					type: "ask",
					ask: "tool",
					text: '{"diffStats":{"added":10,"removed":null}}',
					ts: 1001,
				},
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 0,
				linesRemoved: 0,
				foundAnyStats: false,
			})
		})

		it("should skip invalid items in batchDiffs array", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					text: JSON.stringify({
						batchDiffs: [
							{ diffStats: { added: 5, removed: 3 } },
							null,
							{ diffStats: { added: "invalid", removed: 7 } },
							{ diffStats: { added: 15, removed: 10 } },
						],
					}),
					ts: 1000,
				},
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 20,
				linesRemoved: 13,
				foundAnyStats: true,
			})
		})

		it("should handle messages with no diffStats field", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					text: '{"someOtherField":"value"}',
					ts: 1000,
				},
			]

			const result = getLineStatsFromToolApprovalMessages(messages)

			expect(result).toEqual({
				linesAdded: 0,
				linesRemoved: 0,
				foundAnyStats: false,
			})
		})
	})
})
