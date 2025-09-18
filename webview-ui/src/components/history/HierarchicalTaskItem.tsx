import React, { useState } from "react"
import { ChevronRight, ChevronDown, FolderTree, Calculator } from "lucide-react"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import TaskItem from "./TaskItem"
import { TaskTreeNode } from "@src/utils/taskHierarchy"

interface HierarchicalTaskItemProps {
	node: TaskTreeNode
	variant: "compact" | "full"
	showWorkspace?: boolean
	isSelectionMode?: boolean
	isSelected?: boolean
	onToggleSelection?: (taskId: string, isSelected: boolean) => void
	onDelete?: (taskId: string) => void
	depth?: number
	searchQuery?: string
}

export const HierarchicalTaskItem: React.FC<HierarchicalTaskItemProps> = ({
	node,
	variant,
	showWorkspace = false,
	isSelectionMode = false,
	isSelected = false,
	onToggleSelection,
	onDelete,
	depth = 0,
	searchQuery: _searchQuery,
}) => {
	const { t } = useAppTranslation()
	const [isExpanded, setIsExpanded] = useState(true)
	const hasChildren = node.children.length > 0
	const isOrchestrator = node.task.mode === "orchestrator"

	return (
		<div className="relative">
			{/* Indentation guide lines */}
			{depth > 0 && (
				<div
					className="absolute left-0 top-0 bottom-0 border-l border-vscode-panel-border/30"
					style={{ left: `${(depth - 1) * 24 + 12}px` }}
				/>
			)}

			<div
				className={cn("relative flex items-start gap-1", depth > 0 && "ml-6")}
				style={{ paddingLeft: depth > 0 ? `${(depth - 1) * 24}px` : 0 }}>
				{/* Expand/Collapse button for parent tasks */}
				{hasChildren && (
					<button
						onClick={() => setIsExpanded(!isExpanded)}
						className="shrink-0 p-0.5 mt-3 hover:bg-vscode-list-hoverBackground rounded"
						aria-label={isExpanded ? t("history:collapse") : t("history:expand")}>
						{isExpanded ? (
							<ChevronDown size={16} className="text-vscode-foreground/60" />
						) : (
							<ChevronRight size={16} className="text-vscode-foreground/60" />
						)}
					</button>
				)}

				{/* Spacer for leaf nodes */}
				{!hasChildren && depth > 0 && <div className="w-5 shrink-0" />}

				<div className="flex-1 min-w-0">
					{/* Task item with aggregated cost indicator */}
					<div className="relative">
						<TaskItem
							item={node.task}
							variant={variant}
							showWorkspace={showWorkspace}
							isSelectionMode={isSelectionMode}
							isSelected={isSelected}
							onToggleSelection={onToggleSelection}
							onDelete={onDelete}
							className="m-2"
						/>

						{/* Aggregated cost badge for orchestrator parents */}
						{isOrchestrator && hasChildren && node.aggregatedCost > (node.task.totalCost || 0) && (
							<div className="absolute top-2 right-2">
								<StandardTooltip
									content={
										<div className="space-y-1">
											<div className="font-semibold">{t("history:aggregatedCost")}</div>
											<div>
												{t("history:aggregatedCostDescription", {
													total: node.aggregatedCost.toFixed(2),
													count: node.descendantCount,
												})}
											</div>
										</div>
									}>
									<div className="flex items-center gap-1 px-2 py-0.5 bg-vscode-badge-background text-vscode-badge-foreground rounded text-xs">
										<Calculator size={12} />
										<span>${node.aggregatedCost.toFixed(2)}</span>
										<span className="text-[10px] opacity-70">(+{node.descendantCount})</span>
									</div>
								</StandardTooltip>
							</div>
						)}

						{/* Hierarchy indicator */}
						{hasChildren && (
							<div className="absolute top-2 left-2">
								<StandardTooltip content={t("history:hasSubtasks", { count: node.descendantCount })}>
									<FolderTree size={14} className="text-vscode-textLink-foreground opacity-60" />
								</StandardTooltip>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Render children recursively */}
			{isExpanded && hasChildren && (
				<div className="relative">
					{node.children.map((child) => (
						<HierarchicalTaskItem
							key={child.task.id}
							node={child}
							variant={variant}
							showWorkspace={showWorkspace}
							isSelectionMode={isSelectionMode}
							isSelected={isSelected}
							onToggleSelection={onToggleSelection}
							onDelete={onDelete}
							depth={depth + 1}
							searchQuery={_searchQuery}
						/>
					))}
				</div>
			)}
		</div>
	)
}
