import type { HistoryItem } from "@roo-code/types"

/**
 * Detailed information about a subtask for UI display
 */
export interface SubtaskDetail {
	id: string // Task ID
	name: string // First 50 chars of task description
	tokens: number // tokensIn + tokensOut
	cost: number // Aggregated total cost
	added: number // Aggregated total lines added
	removed: number // Aggregated total lines removed
	status: "active" | "completed" | "delegated"
	hasNestedChildren: boolean // Has its own subtasks
}

export interface AggregatedCosts {
	ownCost: number // This task's own API costs
	childrenCost: number // Sum of all direct children costs (recursive)
	totalCost: number // ownCost + childrenCost
	ownAdded: number // This task's own lines added
	ownRemoved: number // This task's own lines removed
	childrenAdded: number // Sum of all descendant lines added
	childrenRemoved: number // Sum of all descendant lines removed
	totalAdded: number // ownAdded + childrenAdded
	totalRemoved: number // ownRemoved + childrenRemoved
	childBreakdown?: {
		// Optional detailed breakdown
		[childId: string]: AggregatedCosts
	}
	childDetails?: SubtaskDetail[] // Detailed subtask info for UI display
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
	// Prevent infinite loops
	if (visited.has(taskId)) {
		console.warn(`[aggregateTaskCostsRecursive] Circular reference detected: ${taskId}`)
		return {
			ownCost: 0,
			childrenCost: 0,
			totalCost: 0,
			ownAdded: 0,
			ownRemoved: 0,
			childrenAdded: 0,
			childrenRemoved: 0,
			totalAdded: 0,
			totalRemoved: 0,
		}
	}
	visited.add(taskId)

	// Load this task's history
	const history = await getTaskHistory(taskId)
	if (!history) {
		console.warn(`[aggregateTaskCostsRecursive] Task ${taskId} not found`)
		return {
			ownCost: 0,
			childrenCost: 0,
			totalCost: 0,
			ownAdded: 0,
			ownRemoved: 0,
			childrenAdded: 0,
			childrenRemoved: 0,
			totalAdded: 0,
			totalRemoved: 0,
		}
	}

	const ownCost = history.totalCost || 0
	const ownAdded = history.linesAdded || 0
	const ownRemoved = history.linesRemoved || 0
	let childrenCost = 0
	let childrenAdded = 0
	let childrenRemoved = 0
	const childBreakdown: { [childId: string]: AggregatedCosts } = {}

	// Recursively aggregate child costs
	if (history.childIds && history.childIds.length > 0) {
		for (const childId of history.childIds) {
			const childAggregated = await aggregateTaskCostsRecursive(
				childId,
				getTaskHistory,
				new Set(visited), // Create new Set to allow sibling traversal
			)
			childrenCost += childAggregated.totalCost
			childrenAdded += childAggregated.totalAdded
			childrenRemoved += childAggregated.totalRemoved
			childBreakdown[childId] = childAggregated
		}
	}

	const result: AggregatedCosts = {
		ownCost,
		childrenCost,
		totalCost: ownCost + childrenCost,
		ownAdded,
		ownRemoved,
		childrenAdded,
		childrenRemoved,
		totalAdded: ownAdded + childrenAdded,
		totalRemoved: ownRemoved + childrenRemoved,
		childBreakdown,
	}

	return result
}

/**
 * Truncate a task name to a maximum length, adding ellipsis if needed
 */
function truncateTaskName(task: string, maxLength: number): string {
	if (task.length <= maxLength) return task
	return task.substring(0, maxLength - 3) + "..."
}

/**
 * Build subtask details from child breakdown and history items
 * for displaying in the UI's expandable subtask list
 */
export async function buildSubtaskDetails(
	childBreakdown: { [childId: string]: AggregatedCosts },
	getTaskHistory: (id: string) => Promise<HistoryItem | undefined>,
): Promise<SubtaskDetail[]> {
	const details: SubtaskDetail[] = []

	for (const [childId, costs] of Object.entries(childBreakdown)) {
		const history = await getTaskHistory(childId)

		if (history) {
			details.push({
				id: childId,
				name: truncateTaskName(history.task, 50),
				tokens: (history.tokensIn || 0) + (history.tokensOut || 0),
				cost: costs.totalCost,
				added: costs.totalAdded,
				removed: costs.totalRemoved,
				status: history.status || "completed",
				hasNestedChildren: costs.childrenCost > 0,
			})
		}
	}

	return details
}
