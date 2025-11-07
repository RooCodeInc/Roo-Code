import { memo } from "react"
import type { HistoryItem } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { StandardTooltip } from "@/components/ui/standard-tooltip"

import TaskItemFooter from "./TaskItemFooter"

interface DisplayHistoryItem extends HistoryItem {
	highlight?: string
}

interface TaskItemProps {
	item: DisplayHistoryItem
	variant: "compact" | "full"
	showWorkspace?: boolean
	isSelectionMode?: boolean
	isSelected?: boolean
	onToggleSelection?: (taskId: string, isSelected: boolean) => void
	onDelete?: (taskId: string) => void
	className?: string
	isFocused?: boolean
}

const TaskItem = ({
	item,
	variant,
	showWorkspace = false,
	isSelectionMode = false,
	isSelected = false,
	onToggleSelection,
	onDelete,
	className,
	isFocused = false,
}: TaskItemProps) => {
	const handleClick = () => {
		if (isSelectionMode && onToggleSelection) {
			onToggleSelection(item.id, !isSelected)
		} else {
			vscode.postMessage({ type: "showTaskWithId", text: item.id })
		}
	}

	const { t } = useAppTranslation()

	const isCompact = variant === "compact"
	const isDelegated = item.status === "delegated"
	const childLinkId = item.awaitingChildId || item.delegatedToId
	const awaiting = !!item.awaitingChildId
	const hasDelegationCompleted = !!item.completedByChildId && !!item.completionResultSummary
	const summary = (item.completionResultSummary || "").trim()

	return (
		<div
			key={item.id}
			data-testid={`task-item-${item.id}`}
			data-focused={isFocused ? "true" : "false"}
			className={cn(
				"cursor-pointer group bg-vscode-editor-background rounded-xl relative overflow-hidden border hover:bg-vscode-editor-foreground/10 transition-colors",
				isFocused ? "border-vscode-focusBorder" : "border-transparent",
				className,
			)}
			onClick={handleClick}>
			<div className={(!isCompact && isSelectionMode ? "pl-3 pb-3" : "pl-4") + " flex gap-3 px-3 pt-3 pb-1"}>
				{/* Selection checkbox - only in full variant */}
				{!isCompact && isSelectionMode && (
					<div
						className="task-checkbox mt-1"
						onClick={(e) => {
							e.stopPropagation()
						}}>
						<Checkbox
							checked={isSelected}
							onCheckedChange={(checked: boolean) => onToggleSelection?.(item.id, checked === true)}
							variant="description"
						/>
					</div>
				)}

				<div className="flex-1 min-w-0">
					<div
						className={cn(
							"overflow-hidden whitespace-pre-wrap font-light text-vscode-foreground text-ellipsis line-clamp-3",
							{
								"text-base": !isCompact,
							},
							!isCompact && isSelectionMode ? "mb-1" : "",
						)}
						data-testid="task-content"
						{...(item.highlight ? { dangerouslySetInnerHTML: { __html: item.highlight } } : {})}>
						{item.highlight ? undefined : item.task}
					</div>

					<div className="mt-1 flex flex-row flex-wrap items-center gap-2 text-xs">
						{isDelegated && (
							<span
								data-testid="delegated-badge"
								className="px-1.5 py-0.5 rounded bg-vscode-badge-background text-vscode-badge-foreground">
								{t("common:tasks.delegated")}
							</span>
						)}
						{childLinkId && (
							<button
								type="button"
								data-testid="open-child-link"
								className="text-vscode-textLink-foreground hover:underline"
								onClick={(e) => {
									e.stopPropagation()
									vscode.postMessage({ type: "showTaskWithId", text: childLinkId })
								}}>
								{awaiting
									? t("common:tasks.awaiting_child", { childId: childLinkId })
									: t("common:tasks.delegated_to", { childId: childLinkId })}
							</button>
						)}
						{hasDelegationCompleted && (
							<StandardTooltip content={summary} side="top">
								<span
									data-testid="delegation-completed-indicator"
									className="flex items-center gap-1 text-vscode-descriptionForeground">
									<span className="codicon codicon-check" />
									{t("common:tasks.delegation_completed")}
								</span>
							</StandardTooltip>
						)}
					</div>

					<TaskItemFooter
						item={item}
						variant={variant}
						isSelectionMode={isSelectionMode}
						onDelete={onDelete}
					/>

					{showWorkspace && item.workspace && (
						<div className="flex flex-row gap-1 text-vscode-descriptionForeground text-xs mt-1">
							<span className="codicon codicon-folder scale-80" />
							<span>{item.workspace}</span>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default memo(TaskItem)
