import { memo } from "react"
import { ChevronRight } from "lucide-react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"

interface SubtaskCollapsibleRowProps {
	/** Number of subtasks */
	count: number
	/** Whether the subtask list is expanded */
	isExpanded: boolean
	/** Callback when the row is clicked to toggle expand/collapse */
	onToggle: () => void
	/** Optional className for styling */
	className?: string
}

/**
 * A clickable row that displays the subtask count with an expand/collapse chevron.
 * Clicking this row toggles the visibility of the subtask list.
 */
const SubtaskCollapsibleRow = ({ count, isExpanded, onToggle, className }: SubtaskCollapsibleRowProps) => {
	const { t } = useAppTranslation()

	if (count === 0) {
		return null
	}

	return (
		<div
			data-testid="subtask-collapsible-row"
			className={cn(
				"flex items-center gap-1 px-3 py-1.5 -mt-1 cursor-pointer text-xs",
				"text-vscode-descriptionForeground/60 hover:text-vscode-descriptionForeground",
				"hover:bg-vscode-editor-foreground/10",
				"transition-colors",
				className,
			)}
			onClick={(e) => {
				e.stopPropagation()
				onToggle()
			}}
			role="button"
			aria-expanded={isExpanded}
			aria-label={isExpanded ? t("history:collapseSubtasks") : t("history:expandSubtasks")}>
			<ChevronRight className={`size-3 transition-transform ${isExpanded && "rotate-90"}`} />
			{t("history:subtasks", { count })}
		</div>
	)
}

export default memo(SubtaskCollapsibleRow)
