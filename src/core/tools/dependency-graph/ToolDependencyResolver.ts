/**
 * ToolDependencyResolver
 *
 * Resolves tool dependencies and provides execution hints.
 * This is used by the executor to determine execution order and check if tools are ready to run.
 */

import type { DependencyGraph, ToolNode } from "./ToolDependencyGraphBuilder"

/**
 * Hints for tool execution
 */
export interface ExecutionHint {
	/** Whether this tool can execute now (all dependencies satisfied) */
	canExecuteNow: boolean
	/** IDs of tools we're waiting for */
	waitingFor: string[]
	/** IDs of tools blocking us */
	blockedBy: string[]
	/** Execution order (lower = earlier) */
	executionOrder: number
	/** Parallel group number (tools in same group can run together) */
	parallelGroup: number
}

/**
 * Resolves tool dependencies and provides execution helpers
 */
export class ToolDependencyResolver {
	/**
	 * Get execution hints for a specific tool
	 * @param toolId The ID of the tool to get hints for
	 * @param completedTools Set of tool IDs that have completed execution
	 * @param graph The dependency graph
	 * @returns Execution hints for the tool
	 */
	getExecutionHint(toolId: string, completedTools: Set<string>, graph: DependencyGraph): ExecutionHint {
		const node = graph.nodes.get(toolId)

		if (!node) {
			return {
				canExecuteNow: false,
				waitingFor: [],
				blockedBy: [],
				executionOrder: -1,
				parallelGroup: -1,
			}
		}

		const waitingFor = Array.from(node.dependencies).filter((depId) => !completedTools.has(depId))

		return {
			canExecuteNow: waitingFor.length === 0,
			waitingFor,
			blockedBy: waitingFor, // Same as waitingFor for now
			executionOrder: node.priority,
			parallelGroup: this.getParallelGroup(node, graph),
		}
	}

	/**
	 * Get the parallel group number for a node
	 */
	private getParallelGroup(node: ToolNode, graph: DependencyGraph): number {
		for (let i = 0; i < graph.executionGroups.length; i++) {
			if (graph.executionGroups[i].some((n) => n.id === node.id)) {
				return i
			}
		}
		return -1
	}

	/**
	 * Check if all dependencies are satisfied for a tool
	 * @param toolId The ID of the tool to check
	 * @param completedTools Set of tool IDs that have completed execution
	 * @param graph The dependency graph
	 * @returns true if all dependencies are satisfied
	 */
	areDependenciesSatisfied(toolId: string, completedTools: Set<string>, graph: DependencyGraph): boolean {
		const node = graph.nodes.get(toolId)
		if (!node) return false

		return Array.from(node.dependencies).every((depId) => completedTools.has(depId))
	}

	/**
	 * Get tools that are ready to execute
	 * @param graph The dependency graph
	 * @param completedTools Set of tool IDs that have completed execution
	 * @returns Array of tool IDs that are ready to execute
	 */
	getReadyTools(graph: DependencyGraph, completedTools: Set<string>): string[] {
		return Array.from(graph.nodes.values())
			.filter(
				(node) => !completedTools.has(node.id) && this.areDependenciesSatisfied(node.id, completedTools, graph),
			)
			.map((node) => node.id)
	}

	/**
	 * Get the next group of tools to execute
	 * @param graph The dependency graph
	 * @param completedTools Set of tool IDs that have completed execution
	 * @returns Array of tool nodes that can run in parallel
	 */
	getNextExecutionGroup(graph: DependencyGraph, completedTools: Set<string>): ToolNode[] {
		// Find the first group that has uncompleted tools
		for (const group of graph.executionGroups) {
			const uncompletedInGroup = group.filter((node) => !completedTools.has(node.id))
			if (uncompletedInGroup.length > 0) {
				// Return tools from this group whose dependencies are satisfied
				return uncompletedInGroup.filter((node) =>
					this.areDependenciesSatisfied(node.id, completedTools, graph),
				)
			}
		}
		return []
	}

	/**
	 * Check if all tools have completed execution
	 * @param graph The dependency graph
	 * @param completedTools Set of tool IDs that have completed execution
	 * @returns true if all tools are complete
	 */
	isComplete(graph: DependencyGraph, completedTools: Set<string>): boolean {
		return completedTools.size >= graph.totalTools
	}

	/**
	 * Get progress information
	 * @param graph The dependency graph
	 * @param completedTools Set of tool IDs that have completed execution
	 * @returns Progress information
	 */
	getProgress(
		graph: DependencyGraph,
		completedTools: Set<string>,
	): {
		completed: number
		total: number
		percentage: number
		currentGroup: number
		totalGroups: number
	} {
		const completed = completedTools.size
		const total = graph.totalTools

		// Find current group
		let currentGroup = 0
		for (let i = 0; i < graph.executionGroups.length; i++) {
			const group = graph.executionGroups[i]
			if (group.some((node) => !completedTools.has(node.id))) {
				currentGroup = i + 1
				break
			}
		}

		return {
			completed,
			total,
			percentage: total > 0 ? Math.round((completed / total) * 100) : 100,
			currentGroup,
			totalGroups: graph.executionGroups.length,
		}
	}
}
