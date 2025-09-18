import React, { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, Calculator } from "lucide-react"
import type { HistoryItem } from "@roo-code/types"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { calculateAggregatedCost, getTaskDescendants } from "@src/utils/taskHierarchy"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui"
import { useTranslation } from "react-i18next"

interface AggregatedCostDisplayProps {
	currentTask: HistoryItem
	className?: string
}

interface CostBreakdownItem {
	id: string
	task: string
	cost: number
	isParent?: boolean
	depth: number
}

export const AggregatedCostDisplay: React.FC<AggregatedCostDisplayProps> = ({ currentTask, className }) => {
	const { t } = useTranslation()
	const { taskHistory } = useExtensionState()
	const [isExpanded, setIsExpanded] = useState(false)

	// Calculate aggregated cost and get breakdown
	const { aggregatedCost, breakdown, hasDescendants } = useMemo(() => {
		if (!currentTask || !taskHistory) {
			return { aggregatedCost: 0, breakdown: [], hasDescendants: false }
		}

		// Get all descendants
		const descendants = getTaskDescendants(taskHistory, currentTask.id)
		const hasDesc = descendants.length > 0

		// Calculate total cost
		const totalCost = calculateAggregatedCost(taskHistory, currentTask.id)

		// Build breakdown for display
		const items: CostBreakdownItem[] = []

		// Add parent task
		items.push({
			id: currentTask.id,
			task: currentTask.task || t("chat:task.unnamed"),
			cost: currentTask.totalCost || 0,
			isParent: true,
			depth: 0,
		})

		// Build a tree structure for proper indentation
		const childrenByParent = new Map<string, HistoryItem[]>()
		descendants.forEach((desc) => {
			const parentId = desc.parentTaskId || currentTask.id
			if (!childrenByParent.has(parentId)) {
				childrenByParent.set(parentId, [])
			}
			childrenByParent.get(parentId)!.push(desc)
		})

		// Recursively add children with proper indentation
		function addChildren(parentId: string, depth: number) {
			const children = childrenByParent.get(parentId) || []
			children.forEach((child) => {
				items.push({
					id: child.id,
					task: child.task || t("chat:task.unnamed"),
					cost: child.totalCost || 0,
					depth,
				})
				// Recursively add this child's children
				addChildren(child.id, depth + 1)
			})
		}

		addChildren(currentTask.id, 1)

		return {
			aggregatedCost: totalCost,
			breakdown: items,
			hasDescendants: hasDesc,
		}
	}, [currentTask, taskHistory, t])

	// Don't show if no descendants
	if (!hasDescendants) {
		return null
	}

	return (
		<div className={cn("text-sm", className)}>
			<div className="flex items-center gap-2">
				<StandardTooltip
					content={
						<div className="space-y-1">
							<div className="font-semibold">{t("chat:task.aggregatedCost")}</div>
							<div>{t("chat:task.aggregatedCostDescription")}</div>
						</div>
					}>
					<div
						className="flex items-center gap-1 cursor-pointer hover:text-vscode-foreground/90"
						onClick={() => setIsExpanded(!isExpanded)}>
						<Calculator size={14} className="opacity-70" />
						<span className="font-medium">${aggregatedCost.toFixed(2)}</span>
						<span className="text-xs text-vscode-descriptionForeground">
							({t("chat:task.withSubtasks")})
						</span>
						{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
					</div>
				</StandardTooltip>
			</div>

			{isExpanded && (
				<div className="mt-2 ml-2 border-l-2 border-vscode-panel-border pl-3 space-y-1">
					{breakdown.map((item) => (
						<div
							key={item.id}
							className={cn(
								"flex justify-between items-center text-xs",
								item.isParent
									? "font-semibold text-vscode-foreground"
									: "text-vscode-descriptionForeground",
							)}
							style={{ paddingLeft: `${item.depth * 12}px` }}>
							<div className="flex-1 truncate pr-2" title={item.task}>
								{item.isParent && (
									<span className="mr-1 text-vscode-textLink-foreground">
										{t("chat:task.parent")}:
									</span>
								)}
								{item.task.length > 50 ? `${item.task.substring(0, 50)}...` : item.task}
							</div>
							<div className="shrink-0 font-mono">${item.cost.toFixed(2)}</div>
						</div>
					))}
					<div className="border-t border-vscode-panel-border pt-1 mt-2">
						<div className="flex justify-between items-center text-xs font-semibold">
							<span>{t("chat:task.total")}</span>
							<span className="font-mono">${aggregatedCost.toFixed(2)}</span>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
