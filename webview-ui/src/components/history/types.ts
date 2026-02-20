import type { HistoryItem } from "@roo-code/types"

/**
 * Extended HistoryItem with display-related fields for search highlighting and subtask indication
 */
export interface DisplayHistoryItem extends HistoryItem {
	/** HTML string with search match highlighting */
	highlight?: string
	/** Whether this task is a subtask (has a parent in the current task list) */
	isSubtask?: boolean
}

/**
 * A node in the subtask tree, representing a task and its recursively nested children.
 */
export interface SubtaskTreeNode {
	/** The task at this tree node */
	item: DisplayHistoryItem
	/** Recursively nested child subtasks */
	children: SubtaskTreeNode[]
	/** Whether this node's children are expanded in the UI */
	isExpanded: boolean
}

/**
 * Recursively counts all subtasks in a tree of SubtaskTreeNodes.
 */
export function countAllSubtasks(nodes: SubtaskTreeNode[]): number {
	let count = 0
	for (const node of nodes) {
		count += 1 + countAllSubtasks(node.children)
	}
	return count
}

/**
 * A group of tasks consisting of a parent task and its nested subtask tree
 */
export interface TaskGroup {
	/** The parent task */
	parent: DisplayHistoryItem
	/** Tree of subtasks (supports arbitrary nesting depth) */
	subtasks: SubtaskTreeNode[]
	/** Whether the subtask list is expanded */
	isExpanded: boolean
}

/**
 * Result from the useGroupedTasks hook
 */
export interface GroupedTasksResult {
	/** Groups of tasks (parent + subtasks) - used in normal view */
	groups: TaskGroup[]
	/** Flat list of tasks with isSubtask flag - used in search mode */
	flatTasks: DisplayHistoryItem[] | null
	/** Function to toggle expand/collapse state of a group */
	toggleExpand: (taskId: string) => void
	/** Whether search mode is active */
	isSearchMode: boolean
}
