import React from "react"
import { Button } from "@src/components/ui"
import type { OrchestratorPlan } from "./types"

interface PlanReviewPanelProps {
	plan: OrchestratorPlan
	onApprove: () => void
	onCancel: () => void
}

export const PlanReviewPanel: React.FC<PlanReviewPanelProps> = ({ plan, onApprove, onCancel }) => {
	return (
		<div className="p-3 border border-vscode-panel-border rounded-md">
			<div className="text-sm font-medium mb-2">⚡ Execution Plan</div>
			<div className="text-xs opacity-70 mb-3">
				{plan.tasks.length} parallel tasks · {plan.estimatedComplexity} complexity
				{plan.requiresMerge && " · merge required"}
			</div>

			<div className="space-y-2 mb-4">
				{plan.tasks.map((task, i) => (
					<div key={task.id} className="text-xs border-l-2 border-vscode-button-background pl-2">
						<div className="font-medium">
							Task {i + 1}: {task.title} → {task.mode}
						</div>
						<div className="opacity-70 mt-0.5 line-clamp-2">{task.description}</div>
						{task.assignedFiles && task.assignedFiles.length > 0 && (
							<div className="opacity-50 mt-0.5">
								Files: {task.assignedFiles.join(", ")}
							</div>
						)}
					</div>
				))}
			</div>

			<div className="flex gap-2">
				<Button variant="secondary" onClick={onCancel}>
					Cancel
				</Button>
				<Button variant="primary" onClick={onApprove}>
					Execute Plan
				</Button>
			</div>
		</div>
	)
}
