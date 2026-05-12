import { memo, useMemo } from "react"
import { Clock, CheckCircle2, AlertCircle, Play } from "lucide-react"

import type { HistoryItem } from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"

export interface BackgroundTasksListProps {
	onSelectTask: (taskId: string) => void
}

type TaskStatus = "active" | "completed" | "delegated" | "unknown"

function getTaskStatus(item: HistoryItem): TaskStatus {
	return item.status ?? "unknown"
}

function getStatusIcon(status: TaskStatus) {
	switch (status) {
		case "active":
			return <Play size={14} className="text-vscode-charts-green" />
		case "completed":
			return <CheckCircle2 size={14} className="text-vscode-descriptionForeground" />
		case "delegated":
			return <Clock size={14} className="text-vscode-charts-yellow" />
		default:
			return <AlertCircle size={14} className="text-vscode-descriptionForeground" />
	}
}

function getStatusLabel(status: TaskStatus): string {
	switch (status) {
		case "active":
			return "Running"
		case "completed":
			return "Completed"
		case "delegated":
			return "Delegated"
		default:
			return "Unknown"
	}
}

function formatTimestamp(ts: number): string {
	const date = new Date(ts)
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60000)

	if (diffMins < 1) {
		return "just now"
	}
	if (diffMins < 60) {
		return `${diffMins}m ago`
	}
	const diffHours = Math.floor(diffMins / 60)
	if (diffHours < 24) {
		return `${diffHours}h ago`
	}
	const diffDays = Math.floor(diffHours / 24)
	return `${diffDays}d ago`
}

function truncateTask(task: string, maxLen: number = 80): string {
	if (task.length <= maxLen) {
		return task
	}
	return task.slice(0, maxLen) + "..."
}

/**
 * Displays a list of background tasks (subtasks / child tasks) from the task history.
 * Each item shows status, task description, mode, and timestamp.
 * Clicking a task navigates to its replay view.
 */
const BackgroundTasksList = memo(({ onSelectTask }: BackgroundTasksListProps) => {
	const { taskHistory, currentTaskItem } = useExtensionState()

	// Filter to show tasks that have a parentTaskId (i.e., subtasks / background tasks)
	// Exclude the current foreground task
	const backgroundTasks = useMemo(() => {
		return taskHistory
			.filter((item) => item.parentTaskId && item.id !== currentTaskItem?.id)
			.sort((a, b) => b.ts - a.ts)
	}, [taskHistory, currentTaskItem?.id])

	const activeTasks = useMemo(() => backgroundTasks.filter((t) => t.status === "active"), [backgroundTasks])

	if (backgroundTasks.length === 0) {
		return (
			<div
				className="flex flex-col items-center justify-center h-full"
				style={{ padding: "40px 20px" }}
				data-testid="background-tasks-empty">
				<p className="text-vscode-descriptionForeground text-sm text-center">No background tasks yet.</p>
				<p className="text-vscode-descriptionForeground text-xs text-center mt-2">
					Background tasks will appear here when subtasks are spawned via the new_task tool.
				</p>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full" data-testid="background-tasks-list">
			{/* Summary header */}
			<div
				className="flex items-center gap-2 px-4 py-2 text-xs text-vscode-descriptionForeground border-b"
				style={{ borderColor: "var(--vscode-panel-border)" }}>
				{activeTasks.length > 0 && (
					<span className="flex items-center gap-1">
						<Play size={12} className="text-vscode-charts-green" />
						{activeTasks.length} active
					</span>
				)}
				<span>{backgroundTasks.length} total</span>
			</div>

			{/* Task list */}
			<div className="flex-1 overflow-y-auto">
				{backgroundTasks.map((item) => {
					const status = getTaskStatus(item)
					return (
						<button
							key={item.id}
							className="w-full text-left px-4 py-3 border-b cursor-pointer bg-transparent hover:bg-vscode-list-hoverBackground transition-colors"
							style={{
								borderColor: "var(--vscode-panel-border)",
								color: "var(--vscode-foreground)",
							}}
							onClick={() => onSelectTask(item.id)}
							data-testid={`background-task-item-${item.id}`}>
							<div className="flex items-center gap-2 mb-1">
								{getStatusIcon(status)}
								<span className="text-xs font-medium">{getStatusLabel(status)}</span>
								{item.mode && (
									<span
										className="text-xs px-1.5 py-0.5 rounded"
										style={{
											backgroundColor: "var(--vscode-badge-background)",
											color: "var(--vscode-badge-foreground)",
										}}>
										{item.mode}
									</span>
								)}
								<span className="text-xs text-vscode-descriptionForeground ml-auto">
									{formatTimestamp(item.ts)}
								</span>
							</div>
							<div className="text-sm">{truncateTask(item.task)}</div>
							{item.totalCost > 0 && (
								<div className="text-xs text-vscode-descriptionForeground mt-1">
									Cost: ${item.totalCost.toFixed(4)}
								</div>
							)}
						</button>
					)
				})}
			</div>
		</div>
	)
})

BackgroundTasksList.displayName = "BackgroundTasksList"

export default BackgroundTasksList
