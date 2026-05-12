/**
 * Tests for Phase 2: Sequential fan-out / fan-in.
 *
 * Tests the subtask queue mechanism where an orchestrator can define
 * multiple subtasks that execute one after another with automatic transitions.
 */

import { describe, it, expect, vi } from "vitest"
import { RooCodeEventName } from "@roo-code/types"
import type { HistoryItem, SubtaskQueueItem } from "@roo-code/types"

import { ClineProvider } from "../core/webview/ClineProvider"

describe("Sequential fan-out queue types", () => {
	it("SubtaskQueueItem has required mode and message fields", () => {
		const item: SubtaskQueueItem = { mode: "code", message: "Implement feature X" }
		expect(item.mode).toBe("code")
		expect(item.message).toBe("Implement feature X")
	})

	it("HistoryItem can include subtask queue fields", () => {
		const historyItem: Partial<HistoryItem> = {
			id: "test-1",
			subtaskQueue: [
				{ mode: "code", message: "Step 1" },
				{ mode: "debug", message: "Step 2" },
			],
			subtaskQueueIndex: 0,
			subtaskResults: [{ taskId: "child-1", mode: "code", summary: "Done" }],
		}
		expect(historyItem.subtaskQueue).toHaveLength(2)
		expect(historyItem.subtaskQueueIndex).toBe(0)
		expect(historyItem.subtaskResults).toHaveLength(1)
	})

	it("HistoryItem subtask queue fields are optional", () => {
		const historyItem: Partial<HistoryItem> = {
			id: "test-2",
			status: "active",
		}
		expect(historyItem.subtaskQueue).toBeUndefined()
		expect(historyItem.subtaskQueueIndex).toBeUndefined()
		expect(historyItem.subtaskResults).toBeUndefined()
	})
})

describe("advanceSubtaskQueue", () => {
	const makeHistoryItem = (overrides: Partial<HistoryItem> = {}): HistoryItem => ({
		id: "parent-1",
		number: 1,
		ts: Date.now(),
		task: "Test task",
		tokensIn: 0,
		tokensOut: 0,
		totalCost: 0,
		status: "delegated",
		...overrides,
	})

	it("returns handled=true when there are more subtasks in the queue", async () => {
		const emitSpy = vi.fn()
		const mockChild = { taskId: "child-2", start: vi.fn() }
		const provider = {
			getCurrentTask: vi.fn().mockReturnValue({ taskId: "child-1" }),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: makeHistoryItem({ id: "child-1", mode: "code", status: "active" }),
			}),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
			handleModeSwitch: vi.fn().mockResolvedValue(undefined),
			createTask: vi.fn().mockResolvedValue(mockChild),
			emit: emitSpy,
			log: vi.fn(),
		}

		// Queue items represent ADDITIONAL subtasks after the initial child.
		// subtaskQueueIndex=0 means queue[0] is the next to dispatch.
		const subtaskQueue: SubtaskQueueItem[] = [
			{ mode: "code", message: "Step 1" },
			{ mode: "debug", message: "Step 2" },
		]

		const historyItem = makeHistoryItem({
			subtaskQueue,
			subtaskQueueIndex: 0,
			subtaskResults: [],
			childIds: ["child-1"],
		})

		const result = await (ClineProvider.prototype as any).advanceSubtaskQueue.call(provider, {
			parentTaskId: "parent-1",
			childTaskId: "child-1",
			completionResultSummary: "Initial task done",
			historyItem,
		})

		expect(result.handled).toBe(true)

		// Should have closed the current child
		expect(provider.removeClineFromStack).toHaveBeenCalled()

		// Should have marked child as completed
		expect(provider.updateTaskHistory).toHaveBeenCalledWith(
			expect.objectContaining({ id: "child-1", status: "completed" }),
		)

		// Should have switched mode to queue[0]'s mode (the next item to dispatch)
		expect(provider.handleModeSwitch).toHaveBeenCalledWith("code")

		// Should have created the next child with queue[0]'s message
		expect(provider.createTask).toHaveBeenCalledWith("Step 1", undefined, undefined, {
			initialTodos: [],
			initialStatus: "active",
			startTask: false,
		})

		// Should have started the next child
		expect(mockChild.start).toHaveBeenCalled()

		// Should have updated parent with advanced queue index (0 -> 1)
		// completedMode comes from child's history (mode: "code")
		expect(provider.updateTaskHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "parent-1",
				subtaskQueueIndex: 1,
				subtaskResults: [{ taskId: "child-1", mode: "code", summary: "Initial task done" }],
				awaitingChildId: "child-2",
				delegatedToId: "child-2",
			}),
		)

		// Should have emitted delegation events
		expect(emitSpy).toHaveBeenCalledWith(
			RooCodeEventName.TaskDelegationCompleted,
			"parent-1",
			"child-1",
			"Initial task done",
		)
		expect(emitSpy).toHaveBeenCalledWith(RooCodeEventName.TaskDelegated, "parent-1", "child-2")
	})

	it("returns handled=false with aggregated summary when queue is exhausted", async () => {
		const provider = {
			getCurrentTask: vi.fn().mockReturnValue({ taskId: "child-2" }),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: makeHistoryItem({ id: "child-2", mode: "code", status: "active" }),
			}),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
			handleModeSwitch: vi.fn(),
			createTask: vi.fn(),
			emit: vi.fn(),
			log: vi.fn(),
			formatAggregatedQueueResults: (ClineProvider.prototype as any).formatAggregatedQueueResults,
		}

		// Queue has 1 item, subtaskQueueIndex=1 means queue[0] was already dispatched.
		// Now that child completes and the queue is exhausted.
		const subtaskQueue: SubtaskQueueItem[] = [{ mode: "code", message: "Step 1" }]

		const historyItem = makeHistoryItem({
			subtaskQueue,
			subtaskQueueIndex: 1,
			subtaskResults: [{ taskId: "child-1", mode: "code", summary: "Step 1 done" }],
			childIds: ["child-1", "child-2"],
		})

		const result = await (ClineProvider.prototype as any).advanceSubtaskQueue.call(provider, {
			parentTaskId: "parent-1",
			childTaskId: "child-2",
			completionResultSummary: "Step 2 done",
			historyItem,
		})

		expect(result.handled).toBe(false)
		expect(result.aggregatedSummary).toContain("Sequential Fan-Out Complete")
		expect(result.aggregatedSummary).toContain("Step 1 done")
		expect(result.aggregatedSummary).toContain("Step 2 done")

		// Should NOT have created a new child
		expect(provider.createTask).not.toHaveBeenCalled()

		// Should have cleared queue from parent metadata
		expect(provider.updateTaskHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				subtaskQueue: undefined,
				subtaskQueueIndex: undefined,
			}),
		)
	})

	it("returns handled=false immediately when queue is empty", async () => {
		const provider = {
			getCurrentTask: vi.fn(),
			removeClineFromStack: vi.fn(),
			getTaskWithId: vi.fn(),
			updateTaskHistory: vi.fn(),
			emit: vi.fn(),
			log: vi.fn(),
			formatAggregatedQueueResults: (ClineProvider.prototype as any).formatAggregatedQueueResults,
		}

		const historyItem = makeHistoryItem({
			subtaskQueue: [],
			subtaskQueueIndex: 0,
		})

		const result = await (ClineProvider.prototype as any).advanceSubtaskQueue.call(provider, {
			parentTaskId: "parent-1",
			childTaskId: "child-1",
			completionResultSummary: "Done",
			historyItem,
		})

		expect(result.handled).toBe(false)
		expect(result.aggregatedSummary).toBe("Done")
	})
})

describe("formatAggregatedQueueResults", () => {
	it("formats multiple results into a structured summary", () => {
		const results = [
			{ taskId: "child-1", mode: "code", summary: "Implemented feature X" },
			{ taskId: "child-2", mode: "debug", summary: "Fixed bugs in feature X" },
		]

		const formatted = (ClineProvider.prototype as any).formatAggregatedQueueResults(results, "Final result")

		expect(formatted).toContain("Sequential Fan-Out Complete (2 subtasks)")
		expect(formatted).toContain("Subtask 1 (code)")
		expect(formatted).toContain("Implemented feature X")
		expect(formatted).toContain("Subtask 2 (debug)")
		expect(formatted).toContain("Fixed bugs in feature X")
	})

	it("returns last summary when results array is empty", () => {
		const formatted = (ClineProvider.prototype as any).formatAggregatedQueueResults([], "Just a summary")
		expect(formatted).toBe("Just a summary")
	})

	it("handles single result", () => {
		const results = [{ taskId: "child-1", mode: "code", summary: "Done" }]
		const formatted = (ClineProvider.prototype as any).formatAggregatedQueueResults(results, "Done")
		expect(formatted).toContain("Sequential Fan-Out Complete (1 subtask)")
		expect(formatted).toContain("Subtask 1 (code)")
	})
})
