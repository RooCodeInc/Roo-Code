import { memo } from "react"
import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import type { DisplayHistoryItem } from "./types"
import { StandardTooltip } from "../ui"

interface SubtaskRowProps {
	/** The subtask to display */
	item: DisplayHistoryItem
	/** Optional className for styling */
	className?: string
}

/**
 * Displays an individual subtask row when the parent's subtask list is expanded.
 * Shows the task name and token/cost info in an indented format.
 */
const SubtaskRow = ({ item, className }: SubtaskRowProps) => {
	const handleClick = () => {
		vscode.postMessage({ type: "showTaskWithId", text: item.id })
	}

	return (
		<div
			data-testid={`subtask-row-${item.id}`}
			className={cn(
				"flex items-center justify-between gap-2 pl-2 pr-3 p-1.5 ml-6 cursor-pointer",
				"text-vscode-descriptionForeground/60 hover:text-foreground transition-colors",
				className,
			)}
			onClick={handleClick}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault()
					handleClick()
				}
			}}>
			<StandardTooltip content={item.task} delay={600}>
				<span className="line-clamp-1">{item.task}</span>
			</StandardTooltip>
		</div>
	)
}

export default memo(SubtaskRow)
