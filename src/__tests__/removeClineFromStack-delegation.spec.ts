// npx vitest run __tests__/removeClineFromStack-delegation.spec.ts

import { describe, it, expect, vi } from "vitest"

vi.mock("../core/task-persistence/delegationMeta", () => ({
	readDelegationMeta: vi.fn().mockResolvedValue(null),
	saveDelegationMeta: vi.fn().mockResolvedValue(undefined),
}))

import { ClineProvider } from "../core/webview/ClineProvider"

describe("ClineProvider.removeClineFromStack() delegation awareness", () => {
	/**
	 * Helper to build a minimal mock provider with a single task on the stack.
	 * The task's parentTaskId and taskId are configurable.
	 */
	function buildMockProvider(opts: {
		childTaskId: string
		parentTaskId?: string
		parentHistoryItem?: Record<string, any>
		getTaskWithIdError?: Error
	}) {
		const childTask = {
			taskId: opts.childTaskId,
			instanceId: "inst-1",
			parentTaskId: opts.parentTaskId,
			emit: vi.fn(),
			abortTask: vi.fn().mockResolvedValue(undefined),
		}

		const updateTaskHistory = vi.fn().mockResolvedValue([])
		const getTaskWithId = opts.getTaskWithIdError
			? vi.fn().mockRejectedValue(opts.getTaskWithIdError)
			: vi.fn().mockImplementation(async (id: string) => {
					if (id === opts.parentTaskId && opts.parentHistoryItem) {
						return { historyItem: { ...opts.parentHistoryItem } }
					}
					throw new Error("Task not found")
				})

		const provider = {
			clineStack: [childTask] as any[],
			taskEventListeners: new Map(),
			log: vi.fn(),
			getTaskWithId,
			updateTaskHistory,
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
		}

		return { provider, childTask, updateTaskHistory, getTaskWithId }
	}

	it("repairs parent metadata (delegated → active) when a delegated child is removed", async () => {
		const { provider, updateTaskHistory, getTaskWithId } = buildMockProvider({
			childTaskId: "child-1",
			parentTaskId: "parent-1",
			parentHistoryItem: {
				id: "parent-1",
				task: "Parent task",
				ts: 1000,
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
				status: "delegated",
				awaitingChildId: "child-1",
				delegatedToId: "child-1",
				childIds: ["child-1"],
			},
		})

		await (ClineProvider.prototype as any).removeClineFromStack.call(provider)

		// Stack should be empty after pop
		expect(provider.clineStack).toHaveLength(0)

		// Parent lookup should have been called
		expect(getTaskWithId).toHaveBeenCalledWith("parent-1")

		// Parent metadata should be repaired
		expect(updateTaskHistory).toHaveBeenCalledTimes(1)
		const updatedParent = updateTaskHistory.mock.calls[0][0]
		expect(updatedParent).toEqual(
			expect.objectContaining({
				id: "parent-1",
				status: "active",
				awaitingChildId: undefined,
			}),
		)

		// Log the repair
		expect(provider.log).toHaveBeenCalledWith(expect.stringContaining("Repaired parent parent-1 metadata"))
	})

	it("does NOT modify parent metadata when the task has no parentTaskId (non-delegated)", async () => {
		const { provider, updateTaskHistory, getTaskWithId } = buildMockProvider({
			childTaskId: "standalone-1",
			// No parentTaskId — this is a top-level task
		})

		await (ClineProvider.prototype as any).removeClineFromStack.call(provider)

		// Stack should be empty
		expect(provider.clineStack).toHaveLength(0)

		// No parent lookup or update should happen
		expect(getTaskWithId).not.toHaveBeenCalled()
		expect(updateTaskHistory).not.toHaveBeenCalled()
	})

	it("does NOT modify parent metadata when awaitingChildId does not match the popped child", async () => {
		const { provider, updateTaskHistory, getTaskWithId } = buildMockProvider({
			childTaskId: "child-1",
			parentTaskId: "parent-1",
			parentHistoryItem: {
				id: "parent-1",
				task: "Parent task",
				ts: 1000,
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
				status: "delegated",
				awaitingChildId: "child-OTHER", // different child
				delegatedToId: "child-OTHER",
				childIds: ["child-OTHER"],
			},
		})

		await (ClineProvider.prototype as any).removeClineFromStack.call(provider)

		// Parent was looked up but should NOT be updated
		expect(getTaskWithId).toHaveBeenCalledWith("parent-1")
		expect(updateTaskHistory).not.toHaveBeenCalled()
	})

	it("does NOT modify parent metadata when parent status is not 'delegated'", async () => {
		const { provider, updateTaskHistory, getTaskWithId } = buildMockProvider({
			childTaskId: "child-1",
			parentTaskId: "parent-1",
			parentHistoryItem: {
				id: "parent-1",
				task: "Parent task",
				ts: 1000,
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
				status: "completed", // already completed
				awaitingChildId: "child-1",
				childIds: ["child-1"],
			},
		})

		await (ClineProvider.prototype as any).removeClineFromStack.call(provider)

		expect(getTaskWithId).toHaveBeenCalledWith("parent-1")
		expect(updateTaskHistory).not.toHaveBeenCalled()
	})

	it("catches and logs errors during parent metadata repair without blocking the pop", async () => {
		const { provider, childTask, updateTaskHistory, getTaskWithId } = buildMockProvider({
			childTaskId: "child-1",
			parentTaskId: "parent-1",
			getTaskWithIdError: new Error("Storage unavailable"),
		})

		// Should NOT throw
		await (ClineProvider.prototype as any).removeClineFromStack.call(provider)

		// Stack should still be empty (pop was not blocked)
		expect(provider.clineStack).toHaveLength(0)

		// The abort should still have been called
		expect(childTask.abortTask).toHaveBeenCalledWith(true)

		// Error should be logged as non-fatal
		expect(provider.log).toHaveBeenCalledWith(
			expect.stringContaining("Failed to repair parent metadata for parent-1 (non-fatal)"),
		)

		// No update should have been attempted
		expect(updateTaskHistory).not.toHaveBeenCalled()
	})

	it("handles empty stack gracefully", async () => {
		const provider = {
			clineStack: [] as any[],
			taskEventListeners: new Map(),
			log: vi.fn(),
			getTaskWithId: vi.fn(),
			updateTaskHistory: vi.fn(),
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
		}

		// Should not throw
		await (ClineProvider.prototype as any).removeClineFromStack.call(provider)

		expect(provider.clineStack).toHaveLength(0)
		expect(provider.getTaskWithId).not.toHaveBeenCalled()
		expect(provider.updateTaskHistory).not.toHaveBeenCalled()
	})

	it("skips delegation repair when skipDelegationRepair option is true", async () => {
		const { provider, updateTaskHistory, getTaskWithId } = buildMockProvider({
			childTaskId: "child-1",
			parentTaskId: "parent-1",
			parentHistoryItem: {
				id: "parent-1",
				task: "Parent task",
				ts: 1000,
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
				status: "delegated",
				awaitingChildId: "child-1",
				delegatedToId: "child-1",
				childIds: ["child-1"],
			},
		})

		// Call with skipDelegationRepair: true (as delegateParentAndOpenChild would)
		await (ClineProvider.prototype as any).removeClineFromStack.call(provider, { skipDelegationRepair: true })

		// Stack should be empty after pop
		expect(provider.clineStack).toHaveLength(0)

		// Parent lookup should NOT have been called — repair was skipped entirely
		expect(getTaskWithId).not.toHaveBeenCalled()
		expect(updateTaskHistory).not.toHaveBeenCalled()
	})

	it("does NOT reset grandparent during A→B→C nested delegation transition", async () => {
		// Scenario: A delegated to B, B is now delegating to C.
		// delegateParentAndOpenChild() pops B via removeClineFromStack({ skipDelegationRepair: true }).
		// Grandparent A should remain "delegated" — its metadata must not be repaired.
		const grandparentHistory = {
			id: "task-A",
			task: "Grandparent task",
			ts: 1000,
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
			status: "delegated",
			awaitingChildId: "task-B",
			delegatedToId: "task-B",
			childIds: ["task-B"],
		}

		const taskB = {
			taskId: "task-B",
			instanceId: "inst-B",
			parentTaskId: "task-A",
			emit: vi.fn(),
			abortTask: vi.fn().mockResolvedValue(undefined),
		}

		const getTaskWithId = vi.fn().mockImplementation(async (id: string) => {
			if (id === "task-A") {
				return { historyItem: { ...grandparentHistory } }
			}
			throw new Error("Task not found")
		})
		const updateTaskHistory = vi.fn().mockResolvedValue([])

		const provider = {
			clineStack: [taskB] as any[],
			taskEventListeners: new Map(),
			log: vi.fn(),
			getTaskWithId,
			updateTaskHistory,
			contextProxy: { globalStorageUri: { fsPath: "/tmp" } },
		}

		// Simulate what delegateParentAndOpenChild does: pop B with skipDelegationRepair
		await (ClineProvider.prototype as any).removeClineFromStack.call(provider, { skipDelegationRepair: true })

		// B was popped
		expect(provider.clineStack).toHaveLength(0)

		// Grandparent A should NOT have been looked up or modified
		expect(getTaskWithId).not.toHaveBeenCalled()
		expect(updateTaskHistory).not.toHaveBeenCalled()

		// Grandparent A's metadata remains intact (delegated, awaitingChildId: task-B)
		// The caller (delegateParentAndOpenChild) will update A to point to C separately.
	})
})
