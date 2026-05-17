import { memo, useCallback, useState } from "react"
import { ArrowLeft } from "lucide-react"

import { useExtensionState } from "@src/context/ExtensionStateContext"

import BackgroundTasksList from "./BackgroundTasksList"
import BackgroundTaskReplayView from "./BackgroundTaskReplayView"
import BackgroundTaskLiveView from "./BackgroundTaskLiveView"

type BackgroundTaskSubView = "list" | "replay" | "live"

export interface BackgroundTaskViewProps {
	onClose: () => void
}

/**
 * Full-tab container for the background tasks feature (Phase 6b/6c).
 * Manages navigation between BackgroundTasksList, BackgroundTaskReplayView,
 * and BackgroundTaskLiveView.
 */
const BackgroundTaskView = memo(({ onClose }: BackgroundTaskViewProps) => {
	const [subView, setSubView] = useState<BackgroundTaskSubView>("list")
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
	const { taskHistory } = useExtensionState()

	const handleSelectTask = useCallback(
		(taskId: string) => {
			setSelectedTaskId(taskId)
			// Route to live view for active tasks, replay for completed
			const task = taskHistory.find((t) => t.id === taskId)
			if (task?.status === "active") {
				setSubView("live")
			} else {
				setSubView("replay")
			}
		},
		[taskHistory],
	)

	const handleBackToList = useCallback(() => {
		setSelectedTaskId(null)
		setSubView("list")
	}, [])

	return (
		<div className="flex flex-col h-full" data-testid="background-task-view">
			{/* Top header bar -- only shown in list view since replay has its own header */}
			{subView === "list" && (
				<div
					className="flex items-center gap-2 px-4 py-2 border-b"
					style={{
						borderColor: "var(--vscode-panel-border)",
						backgroundColor: "var(--vscode-sideBar-background)",
					}}
					data-testid="background-task-view-header">
					<button
						onClick={onClose}
						className="flex items-center gap-1 text-vscode-textLink-foreground hover:underline cursor-pointer bg-transparent border-none p-0"
						data-testid="background-task-view-back">
						<ArrowLeft size={16} />
						<span>Back to chat</span>
					</button>
					<span className="text-vscode-descriptionForeground text-sm ml-2 font-medium">Background Tasks</span>
				</div>
			)}

			{/* Sub-view content */}
			<div className="flex-1 overflow-hidden">
				{subView === "list" && <BackgroundTasksList onSelectTask={handleSelectTask} />}
				{subView === "replay" && selectedTaskId && (
					<BackgroundTaskReplayView taskId={selectedTaskId} onClose={handleBackToList} />
				)}
				{subView === "live" && selectedTaskId && (
					<BackgroundTaskLiveView taskId={selectedTaskId} onClose={handleBackToList} />
				)}
			</div>
		</div>
	)
})

BackgroundTaskView.displayName = "BackgroundTaskView"

export default BackgroundTaskView
