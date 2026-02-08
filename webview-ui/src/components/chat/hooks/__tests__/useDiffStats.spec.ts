// npx vitest src/components/chat/hooks/__tests__/useDiffStats.spec.ts

import type { ClineMessage, ClineSayTool } from "@roo-code/types"

import { aggregateDiffStats } from "../useDiffStats"

/**
 * Helper to build a ClineMessage that mimics an ask="tool" message carrying
 * a serialised ClineSayTool payload.
 */
function toolMessage(tool: Partial<ClineSayTool>, type: "ask" | "say" = "ask"): ClineMessage {
	const base: ClineMessage = {
		ts: Date.now(),
		type,
		text: JSON.stringify(tool),
	} as any

	if (type === "ask") {
		;(base as any).ask = "tool"
	} else {
		;(base as any).say = "tool"
	}

	return base
}

describe("aggregateDiffStats", () => {
	it("returns zeros for undefined messages", () => {
		expect(aggregateDiffStats(undefined)).toEqual({ totalAdded: 0, totalRemoved: 0 })
	})

	it("returns zeros for empty messages array", () => {
		expect(aggregateDiffStats([])).toEqual({ totalAdded: 0, totalRemoved: 0 })
	})

	it("returns zeros when no tool messages exist", () => {
		const messages: ClineMessage[] = [{ ts: Date.now(), type: "say", say: "text", text: "hello" } as any]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 0, totalRemoved: 0 })
	})

	it("aggregates diffStats from ask=tool editedExistingFile messages", () => {
		const messages = [
			toolMessage({ tool: "editedExistingFile", path: "a.ts", diffStats: { added: 10, removed: 3 } }),
			toolMessage({ tool: "editedExistingFile", path: "b.ts", diffStats: { added: 5, removed: 2 } }),
		]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 15, totalRemoved: 5 })
	})

	it("aggregates diffStats from say=tool messages", () => {
		const messages = [
			toolMessage({ tool: "editedExistingFile", path: "a.ts", diffStats: { added: 7, removed: 1 } }, "say"),
		]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 7, totalRemoved: 1 })
	})

	it("aggregates diffStats from appliedDiff tool", () => {
		const messages = [toolMessage({ tool: "appliedDiff", path: "c.ts", diffStats: { added: 20, removed: 10 } })]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 20, totalRemoved: 10 })
	})

	it("aggregates diffStats from newFileCreated tool", () => {
		const messages = [toolMessage({ tool: "newFileCreated", path: "d.ts", diffStats: { added: 50, removed: 0 } })]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 50, totalRemoved: 0 })
	})

	it("ignores non-file-edit tools (readFile, searchFiles, etc.)", () => {
		const messages = [
			toolMessage({ tool: "readFile", path: "e.ts", diffStats: { added: 100, removed: 100 } } as any),
			toolMessage({ tool: "searchFiles" } as any),
		]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 0, totalRemoved: 0 })
	})

	it("handles messages with missing diffStats gracefully", () => {
		const messages = [
			toolMessage({ tool: "editedExistingFile", path: "f.ts" }), // no diffStats
		]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 0, totalRemoved: 0 })
	})

	it("aggregates per-file stats from batchDiffs", () => {
		const messages = [
			toolMessage({
				tool: "appliedDiff",
				batchDiffs: [
					{ path: "g.ts", changeCount: 2, key: "1", content: "...", diffStats: { added: 8, removed: 2 } },
					{ path: "h.ts", changeCount: 1, key: "2", content: "...", diffStats: { added: 3, removed: 1 } },
				],
			}),
		]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 11, totalRemoved: 3 })
	})

	it("aggregates both top-level and batchDiffs stats", () => {
		const messages = [
			toolMessage({
				tool: "editedExistingFile",
				path: "i.ts",
				diffStats: { added: 5, removed: 2 },
			}),
			toolMessage({
				tool: "appliedDiff",
				batchDiffs: [
					{ path: "j.ts", changeCount: 1, key: "1", content: "...", diffStats: { added: 10, removed: 0 } },
				],
			}),
		]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 15, totalRemoved: 2 })
	})

	it("handles malformed JSON text gracefully", () => {
		const messages: ClineMessage[] = [{ ts: Date.now(), type: "ask", ask: "tool", text: "not valid json" } as any]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 0, totalRemoved: 0 })
	})

	it("handles null text gracefully", () => {
		const messages: ClineMessage[] = [{ ts: Date.now(), type: "ask", ask: "tool", text: null } as any]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 0, totalRemoved: 0 })
	})

	it("mixes ask and say tool messages", () => {
		const messages = [
			toolMessage({ tool: "editedExistingFile", path: "a.ts", diffStats: { added: 3, removed: 1 } }, "ask"),
			toolMessage({ tool: "newFileCreated", path: "b.ts", diffStats: { added: 20, removed: 0 } }, "say"),
		]
		expect(aggregateDiffStats(messages)).toEqual({ totalAdded: 23, totalRemoved: 1 })
	})
})
