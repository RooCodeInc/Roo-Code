import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatLargeNumber } from "@/utils/format"

export interface SubtaskDetail {
	id: string
	name: string
	tokens: number
	cost: number
	status: "active" | "completed" | "delegated"
	hasNestedChildren: boolean
}

export interface SubtaskCostListProps {
	subtasks: SubtaskDetail[]
	onSubtaskClick?: (subtaskId: string) => void
}

interface SubtaskRowProps {
	subtask: SubtaskDetail
	isLast: boolean
	onClick?: () => void
	t: (key: string, options?: Record<string, unknown>) => string
}

const statusColors: Record<SubtaskDetail["status"], string> = {
	active: "bg-vscode-testing-iconQueued",
	completed: "bg-vscode-testing-iconPassed",
	delegated: "bg-vscode-testing-iconSkipped",
}

const SubtaskRow = memo(({ subtask, isLast, onClick, t }: SubtaskRowProps) => {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex items-center gap-2 w-full text-left py-1 px-2 rounded",
				"text-xs text-vscode-descriptionForeground",
				"hover:bg-vscode-list-hoverBackground transition-colors",
			)}>
			{/* Tree indicator */}
			<span className="text-vscode-descriptionForeground opacity-50 font-mono">{isLast ? "└─" : "├─"}</span>

			{/* Status indicator */}
			<span
				className={cn("size-2 rounded-full shrink-0", statusColors[subtask.status])}
				title={t(`subtasks.status.${subtask.status}`)}
			/>

			{/* Subtask name */}
			<span className="flex-1 truncate" title={subtask.name}>
				&quot;{subtask.name}&quot;
			</span>

			{/* Nested indicator */}
			{subtask.hasNestedChildren && (
				<span className="text-vscode-descriptionForeground opacity-50" title={t("subtasks.hasNestedChildren")}>
					+
				</span>
			)}

			{/* Token count */}
			<span className="text-vscode-descriptionForeground opacity-70 tabular-nums">
				{formatLargeNumber(subtask.tokens)}
			</span>

			{/* Cost */}
			<span className="min-w-[60px] text-right tabular-nums">${subtask.cost.toFixed(2)}</span>
		</button>
	)
})

SubtaskRow.displayName = "SubtaskRow"

export const SubtaskCostList = memo(({ subtasks, onSubtaskClick }: SubtaskCostListProps) => {
	const { t } = useTranslation("chat")
	const [isExpanded, setIsExpanded] = useState(false)

	if (!subtasks || subtasks.length === 0) {
		return null
	}

	return (
		<div className="mt-2 border-t border-vscode-sideBar-background pt-2">
			{/* Collapsible Header */}
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className={cn(
					"flex items-center gap-1 w-full text-left",
					"text-sm text-vscode-descriptionForeground",
					"hover:text-vscode-foreground transition-colors",
				)}
				aria-expanded={isExpanded}>
				{isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
				<span>{t("subtasks.count", { count: subtasks.length })}</span>
			</button>

			{/* Expanded Subtask List */}
			{isExpanded && (
				<div className="mt-2 ml-2 space-y-1">
					{subtasks.map((subtask, index) => (
						<SubtaskRow
							key={subtask.id}
							subtask={subtask}
							isLast={index === subtasks.length - 1}
							onClick={() => onSubtaskClick?.(subtask.id)}
							t={t}
						/>
					))}
				</div>
			)}
		</div>
	)
})

SubtaskCostList.displayName = "SubtaskCostList"

export default SubtaskCostList
