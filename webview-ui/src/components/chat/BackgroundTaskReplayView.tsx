import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useEvent } from "react-use"
import { ArrowLeft, Loader2 } from "lucide-react"

import type { ClineMessage, ExtensionMessage } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"

import ChatRow from "./ChatRow"

export interface BackgroundTaskReplayViewProps {
	taskId: string
	onClose: () => void
}

/**
 * A read-only view that displays the full message history of a background task.
 * This is a thin wrapper around ChatRow components -- it loads messages from disk
 * via the extension and renders them without any input controls or approval buttons.
 */
const BackgroundTaskReplayView = memo(({ taskId, onClose }: BackgroundTaskReplayViewProps) => {
	const [messages, setMessages] = useState<ClineMessage[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set())
	const scrollContainerRef = useRef<HTMLDivElement>(null)

	// Request messages from the extension on mount
	useEffect(() => {
		setLoading(true)
		setError(null)
		vscode.postMessage({ type: "requestBackgroundTaskMessages", text: taskId })
	}, [taskId])

	// Listen for the response
	const handleMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data
			if (message.type === "backgroundTaskMessages" && message.backgroundTaskId === taskId) {
				setMessages(message.backgroundTaskMessages ?? [])
				setLoading(false)
			}
		},
		[taskId],
	)

	useEvent("message", handleMessage)

	const handleToggleExpand = useCallback((ts: number) => {
		setExpandedMessages((prev) => {
			const next = new Set(prev)
			if (next.has(ts)) {
				next.delete(ts)
			} else {
				next.add(ts)
			}
			return next
		})
	}, [])

	if (loading) {
		return (
			<div
				className="flex flex-col items-center justify-center h-full"
				style={{ padding: "20px" }}
				data-testid="replay-loading">
				<Loader2 className="animate-spin" size={24} />
				<p className="text-vscode-descriptionForeground mt-2">Loading task messages...</p>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center h-full" style={{ padding: "20px" }}>
				<p className="text-vscode-errorForeground">{error}</p>
				<button
					className="mt-2 text-vscode-textLink-foreground hover:underline cursor-pointer"
					onClick={onClose}>
					Go back
				</button>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full" data-testid="background-task-replay-view">
			{/* Header bar */}
			<div
				className="flex items-center gap-2 px-4 py-2 border-b"
				style={{
					borderColor: "var(--vscode-panel-border)",
					backgroundColor: "var(--vscode-sideBar-background)",
				}}>
				<button
					onClick={onClose}
					className="flex items-center gap-1 text-vscode-textLink-foreground hover:underline cursor-pointer bg-transparent border-none p-0"
					data-testid="replay-back-button">
					<ArrowLeft size={16} />
					<span>Back</span>
				</button>
				<span className="text-vscode-descriptionForeground text-sm ml-2">
					Task replay (read-only) &middot; {messages.length} messages
				</span>
			</div>

			{/* Message list */}
			<div
				ref={scrollContainerRef}
				className="flex-1 overflow-y-auto"
				style={{ padding: "0 20px" }}
				data-testid="replay-message-list">
				{messages.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<p className="text-vscode-descriptionForeground" data-testid="replay-empty-state">
							No messages found for this task.
						</p>
					</div>
				) : (
					messages.map((msg, index) => (
						<ChatRow
							key={msg.ts}
							message={msg}
							isExpanded={expandedMessages.has(msg.ts)}
							isLast={index === messages.length - 1}
							isStreaming={false}
							onToggleExpand={handleToggleExpand}
							onHeightChange={() => {}}
						/>
					))
				)}
			</div>
		</div>
	)
})

BackgroundTaskReplayView.displayName = "BackgroundTaskReplayView"

export default BackgroundTaskReplayView
