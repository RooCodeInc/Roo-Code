import { describe, it, expect, vi, beforeEach } from "vitest"
import { aggregateTaskCostsRecursive, buildSubtaskDetails } from "../aggregateTaskCosts.js"
import type { HistoryItem } from "@roo-code/types"
import type { AggregatedCosts } from "../aggregateTaskCosts.js"

describe("aggregateTaskCostsRecursive", () => {
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
	})

	it("should calculate cost for task with no children", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			"task-1": {
				id: "task-1",
				totalCost: 1.5,
				childIds: [],
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("task-1", getTaskHistory)

		expect(result.ownCost).toBe(1.5)
		expect(result.childrenCost).toBe(0)
		expect(result.totalCost).toBe(1.5)
		expect(result.childBreakdown).toEqual({})
	})

	it("should calculate cost for task with undefined childIds", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			"task-1": {
				id: "task-1",
				totalCost: 2.0,
				// childIds is undefined
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("task-1", getTaskHistory)

		expect(result.ownCost).toBe(2.0)
		expect(result.childrenCost).toBe(0)
		expect(result.totalCost).toBe(2.0)
		expect(result.childBreakdown).toEqual({})
	})

	it("should aggregate parent with one child", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			parent: {
				id: "parent",
				totalCost: 1.0,
				linesAdded: 2,
				linesRemoved: 1,
				childIds: ["child-1"],
			} as unknown as HistoryItem,
			"child-1": {
				id: "child-1",
				totalCost: 0.5,
				linesAdded: 3,
				linesRemoved: 2,
				childIds: [],
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("parent", getTaskHistory)

		expect(result.ownCost).toBe(1.0)
		expect(result.childrenCost).toBe(0.5)
		expect(result.totalCost).toBe(1.5)
		expect(result.ownAdded).toBe(2)
		expect(result.ownRemoved).toBe(1)
		expect(result.childrenAdded).toBe(3)
		expect(result.childrenRemoved).toBe(2)
		expect(result.totalAdded).toBe(5)
		expect(result.totalRemoved).toBe(3)
		expect(result.childBreakdown).toHaveProperty("child-1")
		const child1 = result.childBreakdown?.["child-1"]
		expect(child1).toBeDefined()
		expect(child1!.totalCost).toBe(0.5)
	})

	it("should aggregate parent with multiple children", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			parent: {
				id: "parent",
				totalCost: 1.0,
				childIds: ["child-1", "child-2", "child-3"],
			} as unknown as HistoryItem,
			"child-1": {
				id: "child-1",
				totalCost: 0.5,
				childIds: [],
			} as unknown as HistoryItem,
			"child-2": {
				id: "child-2",
				totalCost: 0.75,
				childIds: [],
			} as unknown as HistoryItem,
			"child-3": {
				id: "child-3",
				totalCost: 0.25,
				childIds: [],
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("parent", getTaskHistory)

		expect(result.ownCost).toBe(1.0)
		expect(result.childrenCost).toBe(1.5) // 0.5 + 0.75 + 0.25
		expect(result.totalCost).toBe(2.5)
		expect(Object.keys(result.childBreakdown || {})).toHaveLength(3)
	})

	it("should recursively aggregate multi-level hierarchy", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			parent: {
				id: "parent",
				totalCost: 1.0,
				linesAdded: 2,
				linesRemoved: 2,
				childIds: ["child"],
			} as unknown as HistoryItem,
			child: {
				id: "child",
				totalCost: 0.5,
				linesAdded: 3,
				linesRemoved: 1,
				childIds: ["grandchild"],
			} as unknown as HistoryItem,
			grandchild: {
				id: "grandchild",
				totalCost: 0.25,
				linesAdded: 1,
				linesRemoved: 4,
				childIds: [],
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("parent", getTaskHistory)

		expect(result.ownCost).toBe(1.0)
		expect(result.childrenCost).toBe(0.75) // child (0.5) + grandchild (0.25)
		expect(result.totalCost).toBe(1.75)

		expect(result.ownAdded).toBe(2)
		expect(result.ownRemoved).toBe(2)
		// children totals include all descendants
		expect(result.childrenAdded).toBe(4) // child (3) + grandchild (1)
		expect(result.childrenRemoved).toBe(5) // child (1) + grandchild (4)
		expect(result.totalAdded).toBe(6)
		expect(result.totalRemoved).toBe(7)

		// Verify child breakdown
		const child = result.childBreakdown?.["child"]
		expect(child).toBeDefined()
		expect(child!.ownCost).toBe(0.5)
		expect(child!.childrenCost).toBe(0.25)
		expect(child!.totalCost).toBe(0.75)
		expect(child!.totalAdded).toBe(4)
		expect(child!.totalRemoved).toBe(5)

		// Verify grandchild breakdown
		const grandchild = child!.childBreakdown?.["grandchild"]
		expect(grandchild).toBeDefined()
		expect(grandchild!.ownCost).toBe(0.25)
		expect(grandchild!.childrenCost).toBe(0)
		expect(grandchild!.totalCost).toBe(0.25)
		expect(grandchild!.totalAdded).toBe(1)
		expect(grandchild!.totalRemoved).toBe(4)
	})

	it("should detect and prevent circular references", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			"task-a": {
				id: "task-a",
				totalCost: 1.0,
				linesAdded: 2,
				linesRemoved: 3,
				childIds: ["task-b"],
			} as unknown as HistoryItem,
			"task-b": {
				id: "task-b",
				totalCost: 0.5,
				linesAdded: 4,
				linesRemoved: 1,
				childIds: ["task-a"], // Circular reference back to task-a
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("task-a", getTaskHistory)

		// Should still process task-b but ignore the circular reference
		expect(result.ownCost).toBe(1.0)
		expect(result.childrenCost).toBe(0.5) // Only task-b's own cost, circular ref returns 0
		expect(result.totalCost).toBe(1.5)
		expect(result.totalAdded).toBe(6) // task-a (2) + task-b (4)
		expect(result.totalRemoved).toBe(4) // task-a (3) + task-b (1)

		// Verify warning was logged
		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Circular reference detected: task-a"))
	})

	it("should handle missing task gracefully", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			parent: {
				id: "parent",
				totalCost: 1.0,
				childIds: ["nonexistent-child"],
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("parent", getTaskHistory)

		expect(result.ownCost).toBe(1.0)
		expect(result.childrenCost).toBe(0) // Missing child contributes 0
		expect(result.totalCost).toBe(1.0)

		// Verify warning was logged
		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Task nonexistent-child not found"))
	})

	it("should return zero costs for completely missing task", async () => {
		const mockHistory: Record<string, HistoryItem> = {}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("nonexistent", getTaskHistory)

		expect(result.ownCost).toBe(0)
		expect(result.childrenCost).toBe(0)
		expect(result.totalCost).toBe(0)

		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Task nonexistent not found"))
	})

	it("should handle task with null totalCost", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			"task-1": {
				id: "task-1",
				totalCost: null as unknown as number, // Explicitly null (invalid type in prod)
				childIds: [],
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("task-1", getTaskHistory)

		expect(result.ownCost).toBe(0)
		expect(result.childrenCost).toBe(0)
		expect(result.totalCost).toBe(0)
	})

	it("should handle task with undefined totalCost", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			"task-1": {
				id: "task-1",
				// totalCost is undefined
				childIds: [],
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("task-1", getTaskHistory)

		expect(result.ownCost).toBe(0)
		expect(result.childrenCost).toBe(0)
		expect(result.totalCost).toBe(0)
	})

	it("should handle complex hierarchy with mixed costs", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			root: {
				id: "root",
				totalCost: 2.5,
				childIds: ["child-1", "child-2"],
			} as unknown as HistoryItem,
			"child-1": {
				id: "child-1",
				totalCost: 1.2,
				childIds: ["grandchild-1", "grandchild-2"],
			} as unknown as HistoryItem,
			"child-2": {
				id: "child-2",
				totalCost: 0.8,
				childIds: [],
			} as unknown as HistoryItem,
			"grandchild-1": {
				id: "grandchild-1",
				totalCost: 0.3,
				childIds: [],
			} as unknown as HistoryItem,
			"grandchild-2": {
				id: "grandchild-2",
				totalCost: 0.15,
				childIds: [],
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("root", getTaskHistory)

		expect(result.ownCost).toBe(2.5)
		// child-1: 1.2 + 0.3 + 0.15 = 1.65
		// child-2: 0.8
		// Total children: 2.45
		expect(result.childrenCost).toBe(2.45)
		expect(result.totalCost).toBe(4.95) // 2.5 + 2.45
	})

	it("should handle siblings without cross-contamination", async () => {
		const mockHistory: Record<string, HistoryItem> = {
			parent: {
				id: "parent",
				totalCost: 1.0,
				childIds: ["sibling-1", "sibling-2"],
			} as unknown as HistoryItem,
			"sibling-1": {
				id: "sibling-1",
				totalCost: 0.5,
				childIds: ["nephew"],
			} as unknown as HistoryItem,
			"sibling-2": {
				id: "sibling-2",
				totalCost: 0.3,
				childIds: ["nephew"], // Same child ID as sibling-1
			} as unknown as HistoryItem,
			nephew: {
				id: "nephew",
				totalCost: 0.1,
				childIds: [],
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("parent", getTaskHistory)

		// Both siblings should independently count nephew
		// sibling-1: 0.5 + 0.1 = 0.6
		// sibling-2: 0.3 + 0.1 = 0.4
		// Total: 1.0 + 0.6 + 0.4 = 2.0
		expect(result.totalCost).toBe(2.0)
	})
})

describe("buildSubtaskDetails", () => {
	it("should build subtask details from child breakdown", async () => {
		const childBreakdown: { [childId: string]: AggregatedCosts } = {
			"child-1": {
				ownCost: 0.5,
				childrenCost: 0,
				totalCost: 0.5,
				ownAdded: 0,
				ownRemoved: 0,
				childrenAdded: 0,
				childrenRemoved: 0,
				totalAdded: 10,
				totalRemoved: 5,
			},
			"child-2": {
				ownCost: 0.3,
				childrenCost: 0.2,
				totalCost: 0.5,
				ownAdded: 0,
				ownRemoved: 0,
				childrenAdded: 0,
				childrenRemoved: 0,
				totalAdded: 1,
				totalRemoved: 2,
			},
		}

		const mockHistory: Record<string, HistoryItem> = {
			"child-1": {
				id: "child-1",
				task: "First subtask",
				tokensIn: 100,
				tokensOut: 50,
				status: "completed",
			} as unknown as HistoryItem,
			"child-2": {
				id: "child-2",
				task: "Second subtask with nested children",
				tokensIn: 200,
				tokensOut: 100,
				status: "active",
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await buildSubtaskDetails(childBreakdown, getTaskHistory)

		expect(result).toHaveLength(2)

		const child1 = result.find((d) => d.id === "child-1")
		expect(child1).toBeDefined()
		expect(child1!.name).toBe("First subtask")
		expect(child1!.tokens).toBe(150) // 100 + 50
		expect(child1!.cost).toBe(0.5)
		expect(child1!.added).toBe(10)
		expect(child1!.removed).toBe(5)
		expect(child1!.status).toBe("completed")
		expect(child1!.hasNestedChildren).toBe(false)

		const child2 = result.find((d) => d.id === "child-2")
		expect(child2).toBeDefined()
		expect(child2!.name).toBe("Second subtask with nested children")
		expect(child2!.tokens).toBe(300) // 200 + 100
		expect(child2!.cost).toBe(0.5)
		expect(child2!.added).toBe(1)
		expect(child2!.removed).toBe(2)
		expect(child2!.status).toBe("active")
		expect(child2!.hasNestedChildren).toBe(true) // childrenCost > 0
	})

	it("should truncate long task names to 50 characters", async () => {
		const longTaskName =
			"This is a very long task name that exceeds fifty characters and should be truncated with ellipsis"
		const childBreakdown: { [childId: string]: AggregatedCosts } = {
			"child-1": {
				ownCost: 1.0,
				childrenCost: 0,
				totalCost: 1.0,
				ownAdded: 0,
				ownRemoved: 0,
				childrenAdded: 0,
				childrenRemoved: 0,
				totalAdded: 0,
				totalRemoved: 0,
			},
		}

		const mockHistory: Record<string, HistoryItem> = {
			"child-1": {
				id: "child-1",
				task: longTaskName,
				tokensIn: 100,
				tokensOut: 50,
				status: "completed",
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await buildSubtaskDetails(childBreakdown, getTaskHistory)

		expect(result).toHaveLength(1)
		expect(result[0].name).toBe("This is a very long task name that exceeds fift...")
		expect(result[0].name.length).toBe(50)
	})

	it("should not truncate task names at or under 50 characters", async () => {
		const exactlyFiftyChars = "12345678901234567890123456789012345678901234567890" // exactly 50 chars
		const childBreakdown: { [childId: string]: AggregatedCosts } = {
			"child-1": {
				ownCost: 1.0,
				childrenCost: 0,
				totalCost: 1.0,
				ownAdded: 0,
				ownRemoved: 0,
				childrenAdded: 0,
				childrenRemoved: 0,
				totalAdded: 0,
				totalRemoved: 0,
			},
		}

		const mockHistory: Record<string, HistoryItem> = {
			"child-1": {
				id: "child-1",
				task: exactlyFiftyChars,
				tokensIn: 100,
				tokensOut: 50,
				status: "completed",
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await buildSubtaskDetails(childBreakdown, getTaskHistory)

		expect(result[0].name).toBe(exactlyFiftyChars)
		expect(result[0].name.length).toBe(50)
	})

	it("should skip children with missing history", async () => {
		const childBreakdown: { [childId: string]: AggregatedCosts } = {
			"child-1": {
				ownCost: 0.5,
				childrenCost: 0,
				totalCost: 0.5,
				ownAdded: 0,
				ownRemoved: 0,
				childrenAdded: 0,
				childrenRemoved: 0,
				totalAdded: 0,
				totalRemoved: 0,
			},
			"missing-child": {
				ownCost: 0.3,
				childrenCost: 0,
				totalCost: 0.3,
				ownAdded: 0,
				ownRemoved: 0,
				childrenAdded: 0,
				childrenRemoved: 0,
				totalAdded: 0,
				totalRemoved: 0,
			},
		}

		const mockHistory: Record<string, HistoryItem> = {
			"child-1": {
				id: "child-1",
				task: "Existing subtask",
				tokensIn: 100,
				tokensOut: 50,
				status: "completed",
			} as unknown as HistoryItem,
			// missing-child has no history
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await buildSubtaskDetails(childBreakdown, getTaskHistory)

		expect(result).toHaveLength(1)
		expect(result[0].id).toBe("child-1")
	})

	it("should handle empty child breakdown", async () => {
		const childBreakdown: { [childId: string]: AggregatedCosts } = {}

		const getTaskHistory = vi.fn(async () => undefined)

		const result = await buildSubtaskDetails(childBreakdown, getTaskHistory)

		expect(result).toHaveLength(0)
	})

	it("should default status to completed when undefined", async () => {
		const childBreakdown: { [childId: string]: AggregatedCosts } = {
			"child-1": {
				ownCost: 0.5,
				childrenCost: 0,
				totalCost: 0.5,
				ownAdded: 0,
				ownRemoved: 0,
				childrenAdded: 0,
				childrenRemoved: 0,
				totalAdded: 0,
				totalRemoved: 0,
			},
		}

		const mockHistory: Record<string, HistoryItem> = {
			"child-1": {
				id: "child-1",
				task: "Subtask without status",
				tokensIn: 100,
				tokensOut: 50,
				// status is undefined
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await buildSubtaskDetails(childBreakdown, getTaskHistory)

		expect(result[0].status).toBe("completed")
	})

	it("should handle undefined token values", async () => {
		const childBreakdown: { [childId: string]: AggregatedCosts } = {
			"child-1": {
				ownCost: 0.5,
				childrenCost: 0,
				totalCost: 0.5,
				ownAdded: 0,
				ownRemoved: 0,
				childrenAdded: 0,
				childrenRemoved: 0,
				totalAdded: 0,
				totalRemoved: 0,
			},
		}

		const mockHistory: Record<string, HistoryItem> = {
			"child-1": {
				id: "child-1",
				task: "Subtask without tokens",
				// tokensIn and tokensOut are undefined
				status: "completed",
			} as unknown as HistoryItem,
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await buildSubtaskDetails(childBreakdown, getTaskHistory)

		expect(result[0].tokens).toBe(0)
	})
})
