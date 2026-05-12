import type { HistoryItem } from "@roo-code/types"
import { buildTaskTree } from "../useTaskTree"

function makeItem(overrides: Partial<HistoryItem> & { id: string }): HistoryItem {
	return {
		ts: Date.now(),
		task: "Test task",
		tokensIn: 0,
		tokensOut: 0,
		totalCost: 0,
		number: 1,
		...overrides,
	}
}

describe("buildTaskTree", () => {
	it("returns null when currentTaskItem is undefined", () => {
		const result = buildTaskTree([], undefined)
		expect(result.rootNode).toBeNull()
		expect(result.hasDelegationHierarchy).toBe(false)
	})

	it("returns null when current task has no delegation hierarchy", () => {
		const item = makeItem({ id: "standalone" })
		const result = buildTaskTree([item], item)
		expect(result.rootNode).toBeNull()
		expect(result.hasDelegationHierarchy).toBe(false)
	})

	it("builds a simple parent-child tree", () => {
		const parent = makeItem({
			id: "parent-1",
			task: "Orchestrator task",
			mode: "orchestrator",
			status: "delegated",
			childIds: ["child-1"],
		})
		const child = makeItem({
			id: "child-1",
			task: "Code task",
			mode: "code",
			status: "active",
			rootTaskId: "parent-1",
			parentTaskId: "parent-1",
		})
		const history = [parent, child]

		const result = buildTaskTree(history, child)

		expect(result.hasDelegationHierarchy).toBe(true)
		expect(result.rootNode).not.toBeNull()
		expect(result.rootNode!.item.id).toBe("parent-1")
		expect(result.rootNode!.children).toHaveLength(1)
		expect(result.rootNode!.children[0].item.id).toBe("child-1")
	})

	it("builds a tree when current task is the root", () => {
		const parent = makeItem({
			id: "parent-1",
			task: "Orchestrator task",
			mode: "orchestrator",
			status: "delegated",
			childIds: ["child-1"],
		})
		const child = makeItem({
			id: "child-1",
			task: "Code task",
			mode: "code",
			status: "active",
			rootTaskId: "parent-1",
			parentTaskId: "parent-1",
		})
		const history = [parent, child]

		// Current task is the root itself
		const result = buildTaskTree(history, parent)

		expect(result.hasDelegationHierarchy).toBe(true)
		expect(result.rootNode!.item.id).toBe("parent-1")
		expect(result.rootNode!.children).toHaveLength(1)
	})

	it("builds a deep tree (parent -> child -> grandchild)", () => {
		const root = makeItem({
			id: "root",
			task: "Root task",
			mode: "orchestrator",
			status: "delegated",
			childIds: ["mid"],
		})
		const mid = makeItem({
			id: "mid",
			task: "Middle task",
			mode: "architect",
			status: "delegated",
			rootTaskId: "root",
			parentTaskId: "root",
			childIds: ["leaf"],
		})
		const leaf = makeItem({
			id: "leaf",
			task: "Leaf task",
			mode: "code",
			status: "active",
			rootTaskId: "root",
			parentTaskId: "mid",
		})
		const history = [root, mid, leaf]

		const result = buildTaskTree(history, leaf)

		expect(result.hasDelegationHierarchy).toBe(true)
		expect(result.rootNode!.item.id).toBe("root")
		expect(result.rootNode!.children).toHaveLength(1)
		expect(result.rootNode!.children[0].item.id).toBe("mid")
		expect(result.rootNode!.children[0].children).toHaveLength(1)
		expect(result.rootNode!.children[0].children[0].item.id).toBe("leaf")
	})

	it("builds a tree with multiple children", () => {
		const root = makeItem({
			id: "root",
			task: "Root task",
			mode: "orchestrator",
			status: "delegated",
			childIds: ["child-a", "child-b", "child-c"],
		})
		const childA = makeItem({
			id: "child-a",
			task: "Task A",
			mode: "code",
			status: "completed",
			rootTaskId: "root",
			parentTaskId: "root",
		})
		const childB = makeItem({
			id: "child-b",
			task: "Task B",
			mode: "debug",
			status: "completed",
			rootTaskId: "root",
			parentTaskId: "root",
		})
		const childC = makeItem({
			id: "child-c",
			task: "Task C",
			mode: "code",
			status: "active",
			rootTaskId: "root",
			parentTaskId: "root",
		})
		const history = [root, childA, childB, childC]

		const result = buildTaskTree(history, childC)

		expect(result.hasDelegationHierarchy).toBe(true)
		expect(result.rootNode!.children).toHaveLength(3)
	})

	it("handles circular references safely", () => {
		const taskA = makeItem({
			id: "a",
			task: "Task A",
			status: "delegated",
			childIds: ["b"],
		})
		const taskB = makeItem({
			id: "b",
			task: "Task B",
			status: "delegated",
			rootTaskId: "a",
			parentTaskId: "a",
			childIds: ["a"], // circular reference
		})
		const history = [taskA, taskB]

		// Should not throw or infinite loop
		const result = buildTaskTree(history, taskB)

		expect(result.hasDelegationHierarchy).toBe(true)
		expect(result.rootNode!.item.id).toBe("a")
	})

	it("excludes tasks from other sessions", () => {
		const root = makeItem({
			id: "root",
			task: "Root task",
			childIds: ["child"],
		})
		const child = makeItem({
			id: "child",
			task: "Child task",
			rootTaskId: "root",
			parentTaskId: "root",
		})
		const otherRoot = makeItem({
			id: "other-root",
			task: "Other session",
			childIds: ["other-child"],
		})
		const otherChild = makeItem({
			id: "other-child",
			task: "Other child",
			rootTaskId: "other-root",
			parentTaskId: "other-root",
		})
		const history = [root, child, otherRoot, otherChild]

		const result = buildTaskTree(history, child)

		expect(result.hasDelegationHierarchy).toBe(true)
		expect(result.rootNode!.item.id).toBe("root")
		expect(result.rootNode!.children).toHaveLength(1)
		expect(result.rootNode!.children[0].item.id).toBe("child")
	})

	it("handles missing child items gracefully", () => {
		const root = makeItem({
			id: "root",
			task: "Root task",
			childIds: ["existing-child", "missing-child"],
		})
		const child = makeItem({
			id: "existing-child",
			task: "Existing child",
			rootTaskId: "root",
			parentTaskId: "root",
		})
		// "missing-child" is not in the history
		const history = [root, child]

		const result = buildTaskTree(history, child)

		expect(result.hasDelegationHierarchy).toBe(true)
		// Only the existing child should appear
		expect(result.rootNode!.children).toHaveLength(1)
		expect(result.rootNode!.children[0].item.id).toBe("existing-child")
	})
})
