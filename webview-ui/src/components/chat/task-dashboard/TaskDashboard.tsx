import { memo, useState, useCallback, useMemo } from "react"
import { ChevronDown, ChevronRight, GitBranch } from "lucide-react"

import type { ModeConfig } from "@roo-code/types"

import { getAllModes } from "@roo/modes"

import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"

import type { TaskTreeNode } from "./useTaskTree"
import { useTaskTree } from "./useTaskTree"

/**
 * Status badge colors for task states.
 */
const statusConfig: Record<string, { label: string; className: string }> = {
	active: { label: "Active", className: "bg-vscode-charts-green text-white" },
	delegated: { label: "Delegated", className: "bg-vscode-charts-blue text-white" },
	completed: {
		label: "Completed",
		className: "bg-vscode-descriptionForeground/30 text-vscode-descriptionForeground",
	},
}

interface TaskNodeRowProps {
	node: TaskTreeNode
	depth: number
	currentTaskId?: string
	modeMap: Map<string, ModeConfig>
}

/**
 * A single row in the task tree, showing mode name, status badge,
 * and active indicator. Supports click-to-navigate.
 */
const TaskNodeRow = memo(({ node, depth, currentTaskId, modeMap }: TaskNodeRowProps) => {
	const { item, children } = node
	const isCurrentTask = item.id === currentTaskId
	const modeConfig = item.mode ? modeMap.get(item.mode) : undefined
	const modeName = modeConfig?.name ?? item.mode ?? "Unknown"
	const status = item.status ?? "active"
	const statusInfo = statusConfig[status] ?? statusConfig.active

	const handleClick = useCallback(() => {
		vscode.postMessage({ type: "showTaskWithId", text: item.id })
	}, [item.id])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault()
				handleClick()
			}
		},
		[handleClick],
	)

	// Truncate task description for display
	const taskSummary = item.task.length > 60 ? item.task.slice(0, 57) + "..." : item.task

	return (
		<div data-testid={`task-node-${item.id}`}>
			<div
				className={cn(
					"group flex items-center gap-2 py-1.5 px-2 cursor-pointer rounded-sm transition-colors",
					"hover:bg-vscode-list-hoverBackground",
					isCurrentTask &&
						"bg-vscode-list-activeSelectionBackground/20 border-l-2 border-vscode-charts-green",
					!isCurrentTask && "border-l-2 border-transparent",
				)}
				style={{ paddingLeft: `${depth * 16 + 8}px` }}
				onClick={handleClick}
				role="button"
				tabIndex={0}
				onKeyDown={handleKeyDown}>
				{/* Mode icon/indicator */}
				<span
					className={cn(
						"shrink-0 size-2 rounded-full",
						status === "active" && "bg-vscode-charts-green",
						status === "delegated" && "bg-vscode-charts-blue",
						status === "completed" && "bg-vscode-descriptionForeground/50",
					)}
				/>

				{/* Mode name */}
				<span
					className={cn(
						"text-xs font-medium shrink-0",
						isCurrentTask ? "text-vscode-foreground" : "text-vscode-descriptionForeground",
					)}>
					{modeName}
				</span>

				{/* Status badge */}
				<span
					className={cn(
						"text-[10px] px-1.5 py-0.5 rounded-full leading-none shrink-0",
						statusInfo.className,
					)}>
					{statusInfo.label}
				</span>

				{/* Task summary (truncated) */}
				<span className="text-xs text-vscode-descriptionForeground truncate min-w-0" title={item.task}>
					{taskSummary}
				</span>
			</div>

			{/* Render children */}
			{children.map((child) => (
				<TaskNodeRow
					key={child.item.id}
					node={child}
					depth={depth + 1}
					currentTaskId={currentTaskId}
					modeMap={modeMap}
				/>
			))}
		</div>
	)
})

TaskNodeRow.displayName = "TaskNodeRow"

/**
 * The Task Coordination Dashboard component.
 *
 * Displays a collapsible tree view of the current delegation session,
 * showing each task's mode, status, and delegation relationships.
 * Only visible when the current task is part of a multi-task delegation hierarchy.
 */
const TaskDashboard = () => {
	const { taskHistory, currentTaskItem, currentTaskId, customModes } = useExtensionState()
	const { rootNode, hasDelegationHierarchy } = useTaskTree(taskHistory, currentTaskItem)
	const [isExpanded, setIsExpanded] = useState(true)

	// Build a mode lookup map
	const modeMap = useMemo(() => {
		const allModes = getAllModes(customModes)
		const map = new Map<string, ModeConfig>()
		for (const mode of allModes) {
			map.set(mode.slug, mode)
		}
		return map
	}, [customModes])

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => !prev)
	}, [])

	// Don't render if there's no delegation hierarchy
	if (!hasDelegationHierarchy || !rootNode) {
		return null
	}

	return (
		<div
			data-testid="task-dashboard"
			className="border-b border-vscode-panel-border bg-vscode-sideBar-background/50">
			{/* Header */}
			<button
				className={cn(
					"w-full flex items-center gap-2 px-3 py-2 text-xs font-medium",
					"text-vscode-descriptionForeground hover:text-vscode-foreground",
					"transition-colors cursor-pointer select-none",
				)}
				onClick={toggleExpanded}
				data-testid="task-dashboard-toggle">
				{isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
				<GitBranch className="size-3.5" />
				<span>Task Delegation</span>
			</button>

			{/* Tree content */}
			{isExpanded && (
				<div className="pb-2" data-testid="task-dashboard-content">
					<TaskNodeRow node={rootNode} depth={0} currentTaskId={currentTaskId} modeMap={modeMap} />
				</div>
			)}
		</div>
	)
}

export default memo(TaskDashboard)
