import React from "react"
import type { OrchestratorState } from "./types"

interface MultiOrchStatusPanelProps {
	state: OrchestratorState
	onAbort: () => void
}

const STATUS_ICONS: Record<string, string> = {
	completed: "✅",
	failed: "❌",
	running: "🔄",
	merging: "🔀",
	pending: "⏳",
}

export const MultiOrchStatusPanel: React.FC<MultiOrchStatusPanelProps> = ({ state, onAbort }) => {
	const completedCount = state.agents.filter((a) => a.status === "completed").length
	const failedCount = state.agents.filter((a) => a.status === "failed").length

	return (
		<div className="p-3 border border-vscode-panel-border rounded-md">
			<div className="text-sm font-medium mb-2">⚡ Multi-Orchestration: {state.phase}</div>
			<div className="text-xs opacity-70 mb-3">
				{completedCount + failedCount}/{state.agents.length} agents complete
			</div>

			<div className="space-y-1.5">
				{state.agents.map((agent) => (
					<div key={agent.taskId} className="flex items-center gap-2 text-xs">
						<span>{STATUS_ICONS[agent.status] ?? "⏳"}</span>
						<span className="truncate flex-1">{agent.title}</span>
						<span className="opacity-50">{agent.mode}</span>
					</div>
				))}
			</div>

			{state.phase !== "complete" && (
				<button
					onClick={onAbort}
					className="mt-3 text-xs text-vscode-errorForeground hover:underline">
					Abort
				</button>
			)}

			{state.finalReport && (
				<div className="mt-3 text-xs whitespace-pre-wrap opacity-80 border-t border-vscode-panel-border pt-2">
					{state.finalReport}
				</div>
			)}
		</div>
	)
}
