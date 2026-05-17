import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useEvent } from "react-use"
import { ArrowLeft, Play, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

import type { BackgroundTaskUpdate, ExtensionMessage } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"

const MAX_UPDATES = 20

export interface BackgroundTaskLiveViewProps {
	taskId: string
	onClose: () => void
}

function getUpdateIcon(update: BackgroundTaskUpdate) {
	if (update.kind === "error") {
		return <AlertCircle size={14} className="text-vscode-errorForeground" />
	}
	if (update.status === "started") {
		return <Play size={14} className="text-vscode-charts-green" />
	}
	if (update.status === "completed") {
		return <CheckCircle2 size={14} className="text-vscode-descriptionForeground" />
	}
	return <Loader2 size={14} className="animate-spin text-vscode-descriptionForeground" />
}

function formatUpdateLabel(update: BackgroundTaskUpdate): string {
	const tool = update.toolName ?? "unknown"
	if (update.kind === "error") {
		return `${tool} -- errored${update.errorMessage ? `: ${update.errorMessage}` : ""}`
	}
	if (update.kind === "tool_call") {
		return `${tool} -- started`
	}
	if (update.kind === "tool_result") {
		return `${tool} -- completed`
	}
	if (update.kind === "status_change") {
		return `Status: ${update.status ?? "unknown"}`
	}
	return tool
}

/**
 * Compact live view that streams real-time progress updates for an active
 * background task. Shows a rolling window of the last 20 tool-call updates
 * with status icons.
 */
const BackgroundTaskLiveView = memo(({ taskId, onClose }: BackgroundTaskLiveViewProps) => {
	const [updates, setUpdates] = useState<BackgroundTaskUpdate[]>([])
	const scrollRef = useRef<HTMLDivElement>(null)

	// Subscribe to background task progress on mount, unsubscribe on unmount
	useEffect(() => {
		vscode.postMessage({ type: "subscribeToBackgroundTask", text: taskId })
		return () => {
			vscode.postMessage({ type: "unsubscribeFromBackgroundTask" })
		}
	}, [taskId])

	// Listen for progress updates
	const handleMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data
			if (
				message.type === "backgroundTaskProgress" &&
				message.backgroundTaskId === taskId &&
				message.backgroundTaskProgress
			) {
				setUpdates((prev) => {
					const next = [...prev, message.backgroundTaskProgress!]
					// Keep only the last N updates (rolling window)
					if (next.length > MAX_UPDATES) {
						return next.slice(next.length - MAX_UPDATES)
					}
					return next
				})
			}
		},
		[taskId],
	)

	useEvent("message", handleMessage)

	// Auto-scroll to bottom when new updates arrive
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}, [updates])

	return (
		<div className="flex flex-col h-full" data-testid="background-task-live-view">
			{/* Header */}
			<div
				className="flex items-center gap-2 px-4 py-2 border-b"
				style={{
					borderColor: "var(--vscode-panel-border)",
					backgroundColor: "var(--vscode-sideBar-background)",
				}}>
				<button
					onClick={onClose}
					className="flex items-center gap-1 text-vscode-textLink-foreground hover:underline cursor-pointer bg-transparent border-none p-0"
					data-testid="live-back-button">
					<ArrowLeft size={16} />
					<span>Back</span>
				</button>
				<span className="text-vscode-descriptionForeground text-sm ml-2">
					Live progress &middot; {updates.length} updates
				</span>
				<Loader2 size={14} className="animate-spin text-vscode-charts-green ml-auto" />
			</div>

			{/* Update list */}
			<div
				ref={scrollRef}
				className="flex-1 overflow-y-auto"
				style={{ padding: "8px 16px" }}
				data-testid="live-update-list">
				{updates.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full" data-testid="live-empty-state">
						<Loader2 size={24} className="animate-spin text-vscode-descriptionForeground" />
						<p className="text-vscode-descriptionForeground text-sm mt-2">
							Waiting for updates from background task...
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-1">
						{updates.map((update, index) => (
							<div
								key={`${update.timestamp}-${index}`}
								className="flex items-center gap-2 py-1 text-sm"
								data-testid="live-update-item">
								{getUpdateIcon(update)}
								<span className="text-vscode-foreground">{formatUpdateLabel(update)}</span>
								<span className="text-vscode-descriptionForeground text-xs ml-auto">
									{new Date(update.timestamp).toLocaleTimeString()}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
})

BackgroundTaskLiveView.displayName = "BackgroundTaskLiveView"

export default BackgroundTaskLiveView
