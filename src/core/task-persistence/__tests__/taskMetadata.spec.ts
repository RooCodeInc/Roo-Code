import { describe, it, expect, vi, beforeEach } from "vitest"

// Hoisted mocks to avoid initialization ordering issues
const hoisted = vi.hoisted(() => ({
	getTaskDirectoryPathMock: vi.fn().mockResolvedValue("/mock/task/dir"),
	getFolderSizeLooseMock: vi.fn().mockResolvedValue(0),
	getApiMetricsMock: vi.fn().mockReturnValue({
		totalTokensIn: 0,
		totalTokensOut: 0,
		totalCacheWrites: 0,
		totalCacheReads: 0,
		totalCost: 0,
		contextTokens: 0,
	}),
}))

vi.mock("get-folder-size", () => ({
	default: {
		loose: hoisted.getFolderSizeLooseMock,
	},
}))

vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: hoisted.getTaskDirectoryPathMock,
}))

vi.mock("../../../shared/getApiMetrics", () => ({
	getApiMetrics: hoisted.getApiMetricsMock,
}))

// Import after mocks
import { taskMetadata } from "../taskMetadata"

describe("taskMetadata() line change parsing", () => {
	beforeEach(() => {
		hoisted.getTaskDirectoryPathMock.mockClear()
		hoisted.getFolderSizeLooseMock.mockClear()
		hoisted.getApiMetricsMock.mockClear()
	})

	it("computes linesAdded/linesRemoved from tool message diffStats", async () => {
		const result = await taskMetadata({
			taskId: "task-1",
			taskNumber: 1,
			globalStoragePath: "/mock/global",
			workspace: "/mock/workspace",
			messages: [
				{ ts: 1, type: "say", say: "text", text: "Task" } as any,
				{
					ts: 2,
					type: "ask",
					ask: "tool",
					text: JSON.stringify({ diffStats: { added: 5, removed: 2 } }),
				} as any,
			],
		})

		expect(result.historyItem.linesAdded).toBe(5)
		expect(result.historyItem.linesRemoved).toBe(2)
	})

	it("aggregates linesAdded/linesRemoved from batch tool message batchDiffs[].diffStats", async () => {
		const result = await taskMetadata({
			taskId: "task-2",
			taskNumber: 2,
			globalStoragePath: "/mock/global",
			workspace: "/mock/workspace",
			messages: [
				{ ts: 1, type: "say", say: "text", text: "Task" } as any,
				{
					ts: 2,
					type: "ask",
					ask: "tool",
					text: JSON.stringify({
						batchDiffs: [
							{ path: "a.ts", diffStats: { added: 1, removed: 1 } },
							{ path: "b.ts", diffStats: { added: 2, removed: 3 } },
						],
					}),
				} as any,
			],
		})

		expect(result.historyItem.linesAdded).toBe(3)
		expect(result.historyItem.linesRemoved).toBe(4)
	})

	it("ignores partial tool messages", async () => {
		const result = await taskMetadata({
			taskId: "task-3",
			taskNumber: 3,
			globalStoragePath: "/mock/global",
			workspace: "/mock/workspace",
			messages: [
				{ ts: 1, type: "say", say: "text", text: "Task" } as any,
				{
					ts: 2,
					type: "ask",
					ask: "tool",
					partial: true,
					text: JSON.stringify({ diffStats: { added: 10, removed: 10 } }),
				} as any,
			],
		})

		expect(result.historyItem.linesAdded).toBeUndefined()
		expect(result.historyItem.linesRemoved).toBeUndefined()
	})

	it("ignores invalid JSON in tool message text gracefully", async () => {
		const result = await taskMetadata({
			taskId: "task-4",
			taskNumber: 4,
			globalStoragePath: "/mock/global",
			workspace: "/mock/workspace",
			messages: [
				{ ts: 1, type: "say", say: "text", text: "Task" } as any,
				{ ts: 2, type: "ask", ask: "tool", text: "{not-json" } as any,
			],
		})

		expect(result.historyItem.linesAdded).toBeUndefined()
		expect(result.historyItem.linesRemoved).toBeUndefined()
	})
})
