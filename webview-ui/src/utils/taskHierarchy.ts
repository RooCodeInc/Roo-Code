import type { HistoryItem } from "@roo-code/types"

export interface TaskTreeNode {
	task: HistoryItem
	children: TaskTreeNode[]
	aggregatedCost: number
	descendantCount: number
}

/**
 * Builds a hierarchical tree structure from a flat list of history items
 * @param tasks - Flat list of history items
 * @returns Array of root task nodes with their children
 */
export function buildTaskTree(tasks: HistoryItem[]): TaskTreeNode[] {
	const taskMap = new Map<string, TaskTreeNode>()
	const rootNodes: TaskTreeNode[] = []

	// First pass: Create nodes for all tasks
	tasks.forEach((task) => {
		taskMap.set(task.id, {
			task,
			children: [],
			aggregatedCost: task.totalCost || 0,
			descendantCount: 0,
		})
	})

	// Second pass: Build the tree structure
	tasks.forEach((task) => {
		const node = taskMap.get(task.id)
		if (!node) return

		if (task.parentTaskId) {
			const parent = taskMap.get(task.parentTaskId)
			if (parent) {
				parent.children.push(node)
			} else {
				// Parent not found in current list, treat as root
				rootNodes.push(node)
			}
		} else {
			// No parent, this is a root node
			rootNodes.push(node)
		}
	})

	// Third pass: Calculate aggregated costs and descendant counts
	rootNodes.forEach((root) => calculateAggregatedMetrics(root))

	return rootNodes
}

/**
 * Recursively calculates aggregated cost and descendant count for a task node
 * @param node - Task node to calculate metrics for
 * @returns Object containing aggregated cost and descendant count
 */
function calculateAggregatedMetrics(node: TaskTreeNode): { cost: number; count: number } {
	let totalCost = node.task.totalCost || 0
	let totalCount = 0

	node.children.forEach((child) => {
		const childMetrics = calculateAggregatedMetrics(child)
		totalCost += childMetrics.cost
		totalCount += childMetrics.count + 1
	})

	node.aggregatedCost = totalCost
	node.descendantCount = totalCount

	return { cost: totalCost, count: totalCount }
}

/**
 * Gets all descendants of a task by its ID
 * @param tasks - Flat list of history items
 * @param rootTaskId - ID of the root task
 * @returns Array of descendant tasks
 */
export function getTaskDescendants(tasks: HistoryItem[], rootTaskId: string): HistoryItem[] {
	const descendants: HistoryItem[] = []
	const visited = new Set<string>()

	function collectDescendants(taskId: string) {
		if (visited.has(taskId)) return
		visited.add(taskId)

		tasks.forEach((task) => {
			if (task.parentTaskId === taskId) {
				descendants.push(task)
				collectDescendants(task.id)
			}
		})
	}

	collectDescendants(rootTaskId)
	return descendants
}

/**
 * Calculates the total cost for a task and all its descendants
 * @param tasks - Flat list of history items
 * @param rootTaskId - ID of the root task
 * @returns Total aggregated cost
 */
export function calculateAggregatedCost(tasks: HistoryItem[], rootTaskId: string): number {
	const rootTask = tasks.find((t) => t.id === rootTaskId)
	if (!rootTask) return 0

	const descendants = getTaskDescendants(tasks, rootTaskId)
	const totalCost = (rootTask.totalCost || 0) + descendants.reduce((sum, task) => sum + (task.totalCost || 0), 0)

	return totalCost
}

/**
 * Checks if a task is a top-level orchestrator task
 * @param task - Task to check
 * @param mode - Current mode of the task
 * @returns True if the task is a top-level orchestrator
 */
export function isTopLevelOrchestrator(task: HistoryItem | undefined, mode: string | undefined): boolean {
	if (!task || !mode) return false
	return mode === "orchestrator" && !task.parentTaskId
}

/**
 * Formats a task tree for display with indentation
 * @param node - Task tree node
 * @param depth - Current depth for indentation
 * @returns Array of formatted task items
 */
export function formatTaskTree(
	node: TaskTreeNode,
	depth: number = 0,
): Array<{
	task: HistoryItem
	depth: number
	aggregatedCost: number
	hasChildren: boolean
}> {
	const result = [
		{
			task: node.task,
			depth,
			aggregatedCost: node.aggregatedCost,
			hasChildren: node.children.length > 0,
		},
	]

	node.children.forEach((child) => {
		result.push(...formatTaskTree(child, depth + 1))
	})

	return result
}

/**
 * Filters a task tree based on search criteria while maintaining hierarchy
 * @param nodes - Array of task tree nodes
 * @param searchTerm - Search term to filter by
 * @returns Filtered tree nodes
 */
export function filterTaskTree(nodes: TaskTreeNode[], searchTerm: string): TaskTreeNode[] {
	if (!searchTerm) return nodes

	const lowerSearch = searchTerm.toLowerCase()

	function filterNode(node: TaskTreeNode): TaskTreeNode | null {
		const taskMatches = node.task.task?.toLowerCase().includes(lowerSearch)
		const filteredChildren = node.children
			.map((child) => filterNode(child))
			.filter((child): child is TaskTreeNode => child !== null)

		// Include node if it matches or has matching children
		if (taskMatches || filteredChildren.length > 0) {
			return {
				...node,
				children: filteredChildren,
			}
		}

		return null
	}

	return nodes.map((node) => filterNode(node)).filter((node): node is TaskTreeNode => node !== null)
}
