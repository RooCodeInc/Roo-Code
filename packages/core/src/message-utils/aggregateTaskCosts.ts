import type { HistoryItem } from "@roo-code/types"

export interface AggregatedCosts {
	ownCost: number // This task's own API costs
	childrenCost: number // Sum of all direct children costs (recursive)
	totalCost: number // ownCost + childrenCost
	childBreakdown?: {
		// Optional detailed breakdown
		[childId: string]: AggregatedCosts
	}
}

/**
 * Recursively aggregate costs for a task and all its subtasks.
 *
 * @param taskId - The task ID to aggregate costs for
 * @param getTaskHistory - Function to load HistoryItem by task ID
 * @param visited - Set to prevent circular references
 * @returns Aggregated cost information
 */
export async function aggregateTaskCostsRecursive(
	taskId: string,
	getTaskHistory: (id: string) => Promise<HistoryItem | undefined>,
	visited: Set<string> = new Set(),
): Promise<AggregatedCosts> {
	console.log("[Aggregated Costs][CORE] aggregateTaskCostsRecursive enter", {
		taskId,
		visitedSize: visited.size,
		visited: Array.from(visited),
	})
	// Prevent infinite loops
	if (visited.has(taskId)) {
		console.warn(`[aggregateTaskCostsRecursive] Circular reference detected: ${taskId}`)
		console.log("[Aggregated Costs][CORE] aggregateTaskCostsRecursive circular", { taskId })
		return { ownCost: 0, childrenCost: 0, totalCost: 0 }
	}
	visited.add(taskId)

	// Load this task's history
	const history = await getTaskHistory(taskId)
	if (!history) {
		console.warn(`[aggregateTaskCostsRecursive] Task ${taskId} not found`)
		console.log("[Aggregated Costs][CORE] aggregateTaskCostsRecursive missing history", { taskId })
		return { ownCost: 0, childrenCost: 0, totalCost: 0 }
	}

	const ownCost = history.totalCost || 0
	let childrenCost = 0
	const childBreakdown: { [childId: string]: AggregatedCosts } = {}
	console.log("[Aggregated Costs][CORE] aggregateTaskCostsRecursive loaded history", {
		taskId,
		ownCost,
		childIds: history.childIds,
	})

	// Recursively aggregate child costs
	if (history.childIds && history.childIds.length > 0) {
		for (const childId of history.childIds) {
			console.log("[Aggregated Costs][CORE] aggregateTaskCostsRecursive recurse child", {
				parentTaskId: taskId,
				childId,
			})
			const childAggregated = await aggregateTaskCostsRecursive(
				childId,
				getTaskHistory,
				new Set(visited), // Create new Set to allow sibling traversal
			)
			console.log("[Aggregated Costs][CORE] aggregateTaskCostsRecursive child result", {
				parentTaskId: taskId,
				childId,
				childAggregated,
			})
			childrenCost += childAggregated.totalCost
			childBreakdown[childId] = childAggregated
		}
	}

	const result: AggregatedCosts = {
		ownCost,
		childrenCost,
		totalCost: ownCost + childrenCost,
		childBreakdown,
	}

	console.log("[Aggregated Costs][CORE] aggregateTaskCostsRecursive exit", {
		taskId,
		ownCost: result.ownCost,
		childrenCost: result.childrenCost,
		totalCost: result.totalCost,
	})

	return {
		...result,
	}
}

/**
 * Get aggregated costs for display, handling incomplete tasks gracefully.
 */
export async function getDisplayCosts(
	taskId: string,
	getTaskHistory: (id: string) => Promise<HistoryItem | undefined>,
): Promise<{
	displayCost: number
	showAggregated: boolean
	breakdown?: string
}> {
	const aggregated = await aggregateTaskCostsRecursive(taskId, getTaskHistory)

	const hasChildren = aggregated.childrenCost > 0
	const displayCost = aggregated.totalCost

	let breakdown: string | undefined
	if (hasChildren) {
		breakdown = `Own: $${aggregated.ownCost.toFixed(2)} + Subtasks: $${aggregated.childrenCost.toFixed(2)}`
	}

	return {
		displayCost,
		showAggregated: hasChildren,
		breakdown,
	}
}
