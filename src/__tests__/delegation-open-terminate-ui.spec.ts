import { ClineProvider } from "../core/webview/ClineProvider"
import type { HistoryItem } from "@roo-code/types"

describe("Delegation metadata preservation - open/terminate/new-task", () => {
	function makeStubProvider(initialHistory: HistoryItem[]) {
		const state: Record<string, any> = { taskHistory: initialHistory }

		const stub = {
			contextProxy: {
				getValue: (k: string) => state[k],
				setValue: (k: string, v: any) => {
					state[k] = v
					return Promise.resolve()
				},
			},
			// match ClineProvider private helpers' behavior
			updateGlobalState: async function <K extends keyof any>(key: K, value: any) {
				await (this as any).contextProxy.setValue(key as any, value)
			},
			getGlobalState: function <K extends keyof any>(key: K) {
				return (this as any).contextProxy.getValue(key as any)
			},
			recentTasksCache: undefined as undefined | string[],
		} as unknown as ClineProvider

		return { stub, state }
	}

	it("preserves status/awaitingChildId/delegatedToId when saving history with partial items (simple open)", async () => {
		const parent: HistoryItem = {
			id: "parent-1",
			rootTaskId: undefined,
			parentTaskId: undefined,
			number: 1,
			ts: Date.now(),
			task: "Parent",
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
			workspace: "/tmp",
			mode: "code",
			// Delegation metadata that must NOT be lost
			status: "delegated",
			delegatedToId: "child-1",
			awaitingChildId: "child-1",
			childIds: ["child-1"],
		}

		// Simulate open-from-history producing a historyItem that lacks delegation fields
		const itemWithoutDelegation: HistoryItem = {
			id: "parent-1",
			rootTaskId: undefined,
			parentTaskId: undefined,
			number: 1,
			ts: Date.now() + 10,
			task: "Parent",
			tokensIn: 10,
			tokensOut: 20,
			totalCost: 0.01,
			workspace: "/tmp",
			mode: "code",
			// Note: no status/awaitingChildId/etc emitted by taskMetadata() during simple save
		}

		const { stub, state } = makeStubProvider([parent])

		const historyAfter = await (ClineProvider.prototype as any).updateTaskHistory.call(stub, itemWithoutDelegation)

		const updated = historyAfter.find((h: HistoryItem) => h.id === "parent-1")!
		// Delegation metadata should remain intact
		expect(updated.status).toBe("delegated")
		expect(updated.awaitingChildId).toBe("child-1")
		expect(updated.delegatedToId).toBe("child-1")
		expect(updated.childIds).toEqual(["child-1"])

		// Non-delegation fields should update
		expect(updated.tokensIn).toBe(10)
		expect(updated.tokensOut).toBe(20)
		expect(updated.totalCost).toBe(0.01)

		// Ensure global state updated
		const persisted = state.taskHistory.find((h: HistoryItem) => h.id === "parent-1")!
		expect(persisted.status).toBe("delegated")
		expect(persisted.awaitingChildId).toBe("child-1")
	})

	it("preserves delegation metadata across multiple stack-clear flows (Terminate / New Task)", async () => {
		const parent: HistoryItem = {
			id: "parent-2",
			number: 2,
			ts: Date.now(),
			task: "Parent Two",
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
			// delegated state set previously
			status: "delegated",
			delegatedToId: "child-xyz",
			awaitingChildId: "child-xyz",
			childIds: ["child-xyz"],
		} as any

		const { stub } = makeStubProvider([parent])

		// Terminate flow -> routine save without delegation fields
		const terminateSave: HistoryItem = {
			id: "parent-2",
			number: 2,
			ts: Date.now() + 100,
			task: "Parent Two",
			tokensIn: 1,
			tokensOut: 2,
			totalCost: 0.02,
		} as any

		const afterTerminate = await (ClineProvider.prototype as any).updateTaskHistory.call(stub, terminateSave)
		const updated1 = afterTerminate.find((h: HistoryItem) => h.id === "parent-2")!
		expect(updated1.status).toBe("delegated")
		expect(updated1.awaitingChildId).toBe("child-xyz")

		// New Task flow -> another routine save without delegation fields
		const newTaskSave: HistoryItem = {
			id: "parent-2",
			number: 2,
			ts: Date.now() + 200,
			task: "Parent Two",
			tokensIn: 3,
			tokensOut: 5,
			totalCost: 0.05,
		} as any

		const afterNewTask = await (ClineProvider.prototype as any).updateTaskHistory.call(stub, newTaskSave)
		const updated2 = afterNewTask.find((h: HistoryItem) => h.id === "parent-2")!
		expect(updated2.status).toBe("delegated")
		expect(updated2.awaitingChildId).toBe("child-xyz")
		expect(updated2.delegatedToId).toBe("child-xyz")
		expect(updated2.childIds).toEqual(["child-xyz"])
	})
})
