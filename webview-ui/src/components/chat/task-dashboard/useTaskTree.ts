import { useMemo } from "react"
import type { HistoryItem } from "@roo-code/types"

/**
 * A node in the task delegation tree.
 */
export interface TaskTreeNode {
	/** The history item for this task */
	item: HistoryItem
	/** Child tasks that were delegated from this task */
	children: TaskTreeNode[]
}

/**
 * Result from the useTaskTree hook.
 */
export interface TaskTreeResult {
	/** The root node of the task tree (null if no delegation hierarchy exists) */
	rootNode: TaskTreeNode | null
	/** Whether the current task is part of a delegation hierarchy */
	hasDelegationHierarchy: boolean
}

/**
 * Given the full taskHistory and the current task item, build a tree
 * of tasks belonging to the current delegation session.
 *
 * A "session" is identified by the rootTaskId: the top-level orchestrator
 * task that started the delegation chain. All tasks sharing the same
 * rootTaskId (or whose id IS the rootTaskId) belong to the same session.
 */
export function buildTaskTree(taskHistory: HistoryItem[], currentTaskItem?: HistoryItem): TaskTreeResult {
	if (!currentTaskItem) {
		return { rootNode: null, hasDelegationHierarchy: false }
	}

	// Determine the root task ID for the current session.
	// If the current task has a rootTaskId, use that. Otherwise,
	// if the current task itself has children, it IS the root.
	const rootId = currentTaskItem.rootTaskId ?? currentTaskItem.id

	// Collect all tasks belonging to this session
	const sessionTasks = taskHistory.filter((item) => item.id === rootId || item.rootTaskId === rootId)

	// Need at least 2 tasks for a delegation hierarchy
	if (sessionTasks.length < 2) {
		return { rootNode: null, hasDelegationHierarchy: false }
	}

	// Build lookup by id
	const taskMap = new Map<string, HistoryItem>()
	for (const task of sessionTasks) {
		taskMap.set(task.id, task)
	}

	// Build tree nodes recursively
	const buildNode = (item: HistoryItem, visited: Set<string>): TaskTreeNode => {
		// Prevent circular references
		if (visited.has(item.id)) {
			return { item, children: [] }
		}
		visited.add(item.id)

		const children: TaskTreeNode[] = []
		if (item.childIds) {
			for (const childId of item.childIds) {
				const childItem = taskMap.get(childId)
				if (childItem) {
					children.push(buildNode(childItem, visited))
				}
			}
		}

		return { item, children }
	}

	const rootItem = taskMap.get(rootId)
	if (!rootItem) {
		return { rootNode: null, hasDelegationHierarchy: false }
	}

	const rootNode = buildNode(rootItem, new Set())
	return { rootNode, hasDelegationHierarchy: true }
}

/**
 * Hook that builds a task delegation tree for the current session.
 *
 * @param taskHistory - Full task history from extension state
 * @param currentTaskItem - The currently active task's history item
 * @returns The delegation tree for the current session
 */
export function useTaskTree(taskHistory: HistoryItem[], currentTaskItem?: HistoryItem): TaskTreeResult {
	return useMemo(() => buildTaskTree(taskHistory, currentTaskItem), [taskHistory, currentTaskItem])
}
