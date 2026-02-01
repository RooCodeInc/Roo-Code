// npx vitest src/core/tools/dependency-graph/__tests__/ToolDependencyResolver.spec.ts

import { describe, it, expect } from "vitest"

import { ToolDependencyResolver } from "../ToolDependencyResolver"
import type { DependencyGraph, ToolNode } from "../ToolDependencyGraphBuilder"

/**
 * Helper to create a mock ToolNode
 */
function createNode(id: string, toolName: string, dependencies: string[] = []): ToolNode {
	return {
		id,
		toolUseId: id,
		toolName,
		params: {},
		dependencies: new Set(dependencies),
		dependents: new Set(),
		canRunInParallel: true,
		priority: parseInt(id),
		isExclusive: false,
		toolUse: {
			type: "tool_use",
			id,
			name: toolName as any,
			params: {},
			partial: false,
		},
	}
}

/**
 * Helper to create a mock DependencyGraph
 */
function createGraph(nodes: ToolNode[][], hasExclusive = false): DependencyGraph {
	const nodeMap = new Map<string, ToolNode>()
	for (const group of nodes) {
		for (const node of group) {
			nodeMap.set(node.id, node)
		}
	}

	return {
		nodes: nodeMap,
		executionGroups: nodes,
		totalTools: nodeMap.size,
		hasExclusiveTools: hasExclusive,
		requiresSequentialExecution: hasExclusive,
	}
}

describe("ToolDependencyResolver", () => {
	const resolver = new ToolDependencyResolver()

	describe("getExecutionHint", () => {
		it("should return canExecuteNow true if no dependencies", () => {
			const graph = createGraph([[createNode("1", "read_file")]])

			const hint = resolver.getExecutionHint("1", new Set(), graph)

			expect(hint.canExecuteNow).toBe(true)
			expect(hint.waitingFor).toEqual([])
		})

		it("should return canExecuteNow false if dependencies not met", () => {
			const node = createNode("2", "read_file", ["1"])
			const graph = createGraph([[createNode("1", "write_to_file")], [node]])

			const hint = resolver.getExecutionHint("2", new Set(), graph)

			expect(hint.canExecuteNow).toBe(false)
			expect(hint.waitingFor).toContain("1")
		})

		it("should return canExecuteNow true if dependencies are met", () => {
			const node = createNode("2", "read_file", ["1"])
			const graph = createGraph([[createNode("1", "write_to_file")], [node]])

			const hint = resolver.getExecutionHint("2", new Set(["1"]), graph)

			expect(hint.canExecuteNow).toBe(true)
			expect(hint.waitingFor).toEqual([])
		})

		it("should return correct parallel group", () => {
			const node1 = createNode("1", "read_file")
			const node2 = createNode("2", "read_file")
			const node3 = createNode("3", "read_file", ["1", "2"])
			const graph = createGraph([[node1, node2], [node3]])

			expect(resolver.getExecutionHint("1", new Set(), graph).parallelGroup).toBe(0)
			expect(resolver.getExecutionHint("2", new Set(), graph).parallelGroup).toBe(0)
			expect(resolver.getExecutionHint("3", new Set(), graph).parallelGroup).toBe(1)
		})

		it("should return -1 for unknown tool", () => {
			const graph = createGraph([[createNode("1", "read_file")]])

			const hint = resolver.getExecutionHint("unknown", new Set(), graph)

			expect(hint.canExecuteNow).toBe(false)
			expect(hint.parallelGroup).toBe(-1)
		})
	})

	describe("areDependenciesSatisfied", () => {
		it("should return true for tool with no dependencies", () => {
			const graph = createGraph([[createNode("1", "read_file")]])

			expect(resolver.areDependenciesSatisfied("1", new Set(), graph)).toBe(true)
		})

		it("should return false if dependencies not satisfied", () => {
			const node = createNode("2", "read_file", ["1"])
			const graph = createGraph([[createNode("1", "write_to_file")], [node]])

			expect(resolver.areDependenciesSatisfied("2", new Set(), graph)).toBe(false)
		})

		it("should return true if all dependencies satisfied", () => {
			const node = createNode("2", "read_file", ["1"])
			const graph = createGraph([[createNode("1", "write_to_file")], [node]])

			expect(resolver.areDependenciesSatisfied("2", new Set(["1"]), graph)).toBe(true)
		})
	})

	describe("getReadyTools", () => {
		it("should return all tools if none have dependencies", () => {
			const graph = createGraph([
				[createNode("1", "read_file"), createNode("2", "read_file"), createNode("3", "read_file")],
			])

			const ready = resolver.getReadyTools(graph, new Set())

			expect(ready).toHaveLength(3)
		})

		it("should return only tools with satisfied dependencies", () => {
			const node1 = createNode("1", "read_file")
			const node2 = createNode("2", "read_file", ["1"])
			const graph = createGraph([[node1], [node2]])

			const ready = resolver.getReadyTools(graph, new Set())

			expect(ready).toEqual(["1"])
		})

		it("should not return already completed tools", () => {
			const graph = createGraph([[createNode("1", "read_file"), createNode("2", "read_file")]])

			const ready = resolver.getReadyTools(graph, new Set(["1"]))

			expect(ready).toEqual(["2"])
		})
	})

	describe("getNextExecutionGroup", () => {
		it("should return first group if nothing completed", () => {
			const node1 = createNode("1", "read_file")
			const node2 = createNode("2", "read_file")
			const graph = createGraph([[node1, node2]])

			const group = resolver.getNextExecutionGroup(graph, new Set())

			expect(group).toHaveLength(2)
		})

		it("should return second group if first is completed", () => {
			const node1 = createNode("1", "read_file")
			const node2 = createNode("2", "read_file", ["1"])
			const graph = createGraph([[node1], [node2]])

			const group = resolver.getNextExecutionGroup(graph, new Set(["1"]))

			expect(group).toHaveLength(1)
			expect(group[0].id).toBe("2")
		})

		it("should return empty array if all completed", () => {
			const graph = createGraph([[createNode("1", "read_file")]])

			const group = resolver.getNextExecutionGroup(graph, new Set(["1"]))

			expect(group).toHaveLength(0)
		})
	})

	describe("isComplete", () => {
		it("should return true if all tools completed", () => {
			const graph = createGraph([[createNode("1", "read_file"), createNode("2", "read_file")]])

			expect(resolver.isComplete(graph, new Set(["1", "2"]))).toBe(true)
		})

		it("should return false if not all tools completed", () => {
			const graph = createGraph([[createNode("1", "read_file"), createNode("2", "read_file")]])

			expect(resolver.isComplete(graph, new Set(["1"]))).toBe(false)
		})
	})

	describe("getProgress", () => {
		it("should return correct progress info", () => {
			const graph = createGraph([
				[createNode("1", "read_file"), createNode("2", "read_file")],
				[createNode("3", "read_file", ["1", "2"])],
			])

			const progress = resolver.getProgress(graph, new Set(["1"]))

			expect(progress.completed).toBe(1)
			expect(progress.total).toBe(3)
			expect(progress.percentage).toBe(33)
			expect(progress.currentGroup).toBe(1)
			expect(progress.totalGroups).toBe(2)
		})

		it("should return 100% when complete", () => {
			const graph = createGraph([[createNode("1", "read_file")]])

			const progress = resolver.getProgress(graph, new Set(["1"]))

			expect(progress.percentage).toBe(100)
		})
	})
})
