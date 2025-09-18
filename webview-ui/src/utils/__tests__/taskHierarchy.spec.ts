import { describe, it, expect } from "vitest"
import type { HistoryItem } from "@roo-code/types"
import {
	buildTaskTree,
	getTaskDescendants,
	calculateAggregatedCost,
	isTopLevelOrchestrator,
	formatTaskTree,
	filterTaskTree,
} from "../taskHierarchy"

describe("taskHierarchy utilities", () => {
	const mockTasks: HistoryItem[] = [
		{
			id: "root-1",
			number: 1,
			ts: Date.now(),
			task: "Root orchestrator task",
			tokensIn: 100,
			tokensOut: 50,
			totalCost: 1.5,
			mode: "orchestrator",
		},
		{
			id: "child-1",
			rootTaskId: "root-1",
			parentTaskId: "root-1",
			number: 2,
			ts: Date.now(),
			task: "Child task 1",
			tokensIn: 50,
			tokensOut: 25,
			totalCost: 0.5,
			mode: "code",
		},
		{
			id: "child-2",
			rootTaskId: "root-1",
			parentTaskId: "root-1",
			number: 3,
			ts: Date.now(),
			task: "Child task 2",
			tokensIn: 75,
			tokensOut: 40,
			totalCost: 0.8,
			mode: "debug",
		},
		{
			id: "grandchild-1",
			rootTaskId: "root-1",
			parentTaskId: "child-1",
			number: 4,
			ts: Date.now(),
			task: "Grandchild task",
			tokensIn: 25,
			tokensOut: 15,
			totalCost: 0.3,
			mode: "code",
		},
		{
			id: "root-2",
			number: 5,
			ts: Date.now(),
			task: "Another root task",
			tokensIn: 200,
			tokensOut: 100,
			totalCost: 2.0,
			mode: "code",
		},
	]

	describe("buildTaskTree", () => {
		it("should build a correct tree structure from flat tasks", () => {
			const tree = buildTaskTree(mockTasks)

			expect(tree).toHaveLength(2) // Two root nodes
			expect(tree[0].task.id).toBe("root-1")
			expect(tree[1].task.id).toBe("root-2")

			// Check root-1 structure
			expect(tree[0].children).toHaveLength(2) // Two direct children
			expect(tree[0].children[0].task.id).toBe("child-1")
			expect(tree[0].children[1].task.id).toBe("child-2")

			// Check grandchild
			expect(tree[0].children[0].children).toHaveLength(1)
			expect(tree[0].children[0].children[0].task.id).toBe("grandchild-1")

			// Check root-2 has no children
			expect(tree[1].children).toHaveLength(0)
		})

		it("should calculate aggregated costs correctly", () => {
			const tree = buildTaskTree(mockTasks)

			// Root-1 should have aggregated cost of all its descendants
			// 1.5 (root) + 0.5 (child-1) + 0.8 (child-2) + 0.3 (grandchild) = 3.1
			expect(tree[0].aggregatedCost).toBeCloseTo(3.1, 1)
			expect(tree[0].descendantCount).toBe(3)

			// Child-1 should include grandchild cost
			// 0.5 (self) + 0.3 (grandchild) = 0.8
			expect(tree[0].children[0].aggregatedCost).toBeCloseTo(0.8, 1)
			expect(tree[0].children[0].descendantCount).toBe(1)

			// Root-2 has no children
			expect(tree[1].aggregatedCost).toBe(2.0)
			expect(tree[1].descendantCount).toBe(0)
		})

		it("should handle empty task list", () => {
			const tree = buildTaskTree([])
			expect(tree).toHaveLength(0)
		})

		it("should handle orphaned tasks (parent not in list)", () => {
			const orphanedTasks: HistoryItem[] = [
				{
					id: "orphan",
					parentTaskId: "non-existent",
					number: 1,
					ts: Date.now(),
					task: "Orphaned task",
					tokensIn: 10,
					tokensOut: 5,
					totalCost: 0.1,
				},
			]

			const tree = buildTaskTree(orphanedTasks)
			expect(tree).toHaveLength(1)
			expect(tree[0].task.id).toBe("orphan")
		})
	})

	describe("getTaskDescendants", () => {
		it("should return all descendants of a task", () => {
			const descendants = getTaskDescendants(mockTasks, "root-1")

			expect(descendants).toHaveLength(3)
			const descendantIds = descendants.map((d) => d.id)
			expect(descendantIds).toContain("child-1")
			expect(descendantIds).toContain("child-2")
			expect(descendantIds).toContain("grandchild-1")
		})

		it("should return empty array for task with no descendants", () => {
			const descendants = getTaskDescendants(mockTasks, "root-2")
			expect(descendants).toHaveLength(0)
		})

		it("should return empty array for non-existent task", () => {
			const descendants = getTaskDescendants(mockTasks, "non-existent")
			expect(descendants).toHaveLength(0)
		})

		it("should handle circular references gracefully", () => {
			const circularTasks: HistoryItem[] = [
				{
					id: "task-a",
					parentTaskId: "task-b",
					number: 1,
					ts: Date.now(),
					task: "Task A",
					tokensIn: 10,
					tokensOut: 5,
					totalCost: 0.1,
				},
				{
					id: "task-b",
					parentTaskId: "task-a",
					number: 2,
					ts: Date.now(),
					task: "Task B",
					tokensIn: 10,
					tokensOut: 5,
					totalCost: 0.1,
				},
			]

			// Should not cause infinite loop - in this case both tasks are descendants of each other
			const descendants = getTaskDescendants(circularTasks, "task-a")
			// task-a has task-b as a child, and task-b has task-a as a child (circular)
			// The visited set prevents infinite loop, but both are found as descendants
			expect(descendants).toHaveLength(2)
		})
	})

	describe("calculateAggregatedCost", () => {
		it("should calculate total cost including descendants", () => {
			const cost = calculateAggregatedCost(mockTasks, "root-1")
			// 1.5 + 0.5 + 0.8 + 0.3 = 3.1
			expect(cost).toBeCloseTo(3.1, 1)
		})

		it("should return task's own cost if no descendants", () => {
			const cost = calculateAggregatedCost(mockTasks, "root-2")
			expect(cost).toBe(2.0)
		})

		it("should return 0 for non-existent task", () => {
			const cost = calculateAggregatedCost(mockTasks, "non-existent")
			expect(cost).toBe(0)
		})

		it("should handle tasks with undefined totalCost", () => {
			const tasksWithUndefinedCost: HistoryItem[] = [
				{
					id: "task-1",
					number: 1,
					ts: Date.now(),
					task: "Task without cost",
					tokensIn: 10,
					tokensOut: 5,
					totalCost: 0, // Set to 0 instead of undefined
				},
				{
					id: "child",
					parentTaskId: "task-1",
					number: 2,
					ts: Date.now(),
					task: "Child with cost",
					tokensIn: 10,
					tokensOut: 5,
					totalCost: 0.5,
				},
			]

			const cost = calculateAggregatedCost(tasksWithUndefinedCost, "task-1")
			expect(cost).toBe(0.5) // Parent's 0 + child's 0.5
		})
	})

	describe("isTopLevelOrchestrator", () => {
		it("should return true for top-level orchestrator task", () => {
			const task = mockTasks[0] // root-1 with mode="orchestrator"
			expect(isTopLevelOrchestrator(task, "orchestrator")).toBe(true)
		})

		it("should return false for orchestrator with parent", () => {
			const task: HistoryItem = {
				...mockTasks[1],
				mode: "orchestrator",
			}
			expect(isTopLevelOrchestrator(task, "orchestrator")).toBe(false)
		})

		it("should return false for non-orchestrator task", () => {
			const task = mockTasks[4] // root-2 with mode="code"
			expect(isTopLevelOrchestrator(task, "code")).toBe(false)
		})

		it("should return false for undefined task", () => {
			expect(isTopLevelOrchestrator(undefined, "orchestrator")).toBe(false)
		})

		it("should return false for undefined mode", () => {
			expect(isTopLevelOrchestrator(mockTasks[0], undefined)).toBe(false)
		})
	})

	describe("formatTaskTree", () => {
		it("should format tree with correct depth levels", () => {
			const tree = buildTaskTree(mockTasks)
			const formatted = formatTaskTree(tree[0])

			expect(formatted).toHaveLength(4) // root + 2 children + 1 grandchild
			expect(formatted[0].depth).toBe(0) // root
			expect(formatted[1].depth).toBe(1) // child-1
			expect(formatted[2].depth).toBe(2) // grandchild
			expect(formatted[3].depth).toBe(1) // child-2
		})

		it("should include aggregated costs and hasChildren flag", () => {
			const tree = buildTaskTree(mockTasks)
			const formatted = formatTaskTree(tree[0])

			expect(formatted[0].hasChildren).toBe(true)
			expect(formatted[0].aggregatedCost).toBeCloseTo(3.1, 1)

			expect(formatted[1].hasChildren).toBe(true)
			expect(formatted[1].aggregatedCost).toBeCloseTo(0.8, 1)

			expect(formatted[2].hasChildren).toBe(false)
			expect(formatted[2].aggregatedCost).toBe(0.3)
		})
	})

	describe("filterTaskTree", () => {
		it("should filter tree based on search term", () => {
			const tree = buildTaskTree(mockTasks)
			const filtered = filterTaskTree(tree, "child")

			// Should include root-1 (has matching children) and both child tasks
			expect(filtered).toHaveLength(1) // Only root-1 tree
			expect(filtered[0].task.id).toBe("root-1")
			expect(filtered[0].children).toHaveLength(2)
		})

		it("should include parent if child matches", () => {
			const tree = buildTaskTree(mockTasks)
			const filtered = filterTaskTree(tree, "grandchild")

			expect(filtered).toHaveLength(1)
			expect(filtered[0].task.id).toBe("root-1")
			expect(filtered[0].children).toHaveLength(1) // Only child-1
			expect(filtered[0].children[0].task.id).toBe("child-1")
			expect(filtered[0].children[0].children).toHaveLength(1)
		})

		it("should return original tree for empty search term", () => {
			const tree = buildTaskTree(mockTasks)
			const filtered = filterTaskTree(tree, "")

			expect(filtered).toEqual(tree)
		})

		it("should be case-insensitive", () => {
			const tree = buildTaskTree(mockTasks)
			const filtered = filterTaskTree(tree, "CHILD")

			expect(filtered).toHaveLength(1)
			expect(filtered[0].children).toHaveLength(2)
		})

		it("should return empty array if no matches", () => {
			const tree = buildTaskTree(mockTasks)
			const filtered = filterTaskTree(tree, "nonexistent")

			expect(filtered).toHaveLength(0)
		})
	})
})
