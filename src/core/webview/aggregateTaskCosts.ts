import type { HistoryItem } from "@roo-code/types"
import { t } from "../../i18n"

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
 * Format a cost breakdown string for display.
 * This is the centralized function for generating breakdown strings.
 *
 * @param ownCost - The task's own cost
 * @param childrenCost - The sum of subtask costs
 * @param labels - Optional custom labels for "Own" and "Subtasks" (for i18n in webview)
 * @returns Formatted breakdown string like "Own: $1.00 + Subtasks: $0.50"
 */
export function formatCostBreakdown(
	ownCost: number,
	childrenCost: number,
	labels?: { own: string; subtasks: string },
): string {
	const ownLabel = labels?.own ?? t("common:costs.own")
	const subtasksLabel = labels?.subtasks ?? t("common:costs.subtasks")
	return `${ownLabel}: $${ownCost.toFixed(2)} + ${subtasksLabel}: $${childrenCost.toFixed(2)}`
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
		return { ownCost: 0, childrenCost: 0, totalCost: 0 }
	}
	visited.add(taskId)

	// Load this task's history
	const history = await getTaskHistory(taskId)
	if (!history) {
		console.warn(`[aggregateTaskCostsRecursive] Task ${taskId} not found`)
		return { ownCost: 0, childrenCost: 0, totalCost: 0 }
	}

	const ownCost = history.totalCost || 0
	let childrenCost = 0
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
			childBreakdown[childId] = childAggregated
		}
	}

	const result: AggregatedCosts = {
		ownCost,
		childrenCost,
		totalCost: ownCost + childrenCost,
		childBreakdown,
	}

	return result
}

/**
 * Get aggregated costs for display, handling incomplete tasks gracefully.
 * Consumers can check if `breakdown` exists to determine if costs are aggregated.
 */
export async function getDisplayCosts(
	taskId: string,
	getTaskHistory: (id: string) => Promise<HistoryItem | undefined>,
): Promise<{
	displayCost: number
	breakdown?: string
}> {
	const aggregated = await aggregateTaskCostsRecursive(taskId, getTaskHistory)

	const hasChildren = aggregated.childrenCost > 0
	const displayCost = aggregated.totalCost

	let breakdown: string | undefined
	if (hasChildren) {
		breakdown = formatCostBreakdown(aggregated.ownCost, aggregated.childrenCost)
	}

	return {
		displayCost,
		breakdown,
	}
}
