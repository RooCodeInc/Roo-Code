import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { HistoryItem } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { useCopyToClipboard } from "@/utils/clipboard"
import { useExtensionState } from "@/context/ExtensionStateContext"

import { DeleteTaskDialog } from "../history/DeleteTaskDialog"
import { IconButton } from "./IconButton"
import { ShareButton } from "./ShareButton"
import { CloudTaskButton } from "./CloudTaskButton"

interface TaskActionsProps {
	item?: HistoryItem
	buttonsDisabled: boolean
}

export const TaskActions = ({ item, buttonsDisabled }: TaskActionsProps) => {
	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const { t } = useTranslation()
	const { copyWithFeedback, showCopyFeedback } = useCopyToClipboard()
	const { enableCheckpoints } = useExtensionState()

	const handleCustomCheckpoint = () => {
		const message = prompt(t("chat:checkpoint.custom_prompt"), t("chat:checkpoint.custom_default"))
		if (message !== null) {
			vscode.postMessage({ type: "saveCustomCheckpoint", text: message })
		}
	}

	return (
		<div className="flex flex-row items-center">
			{enableCheckpoints && (
				<IconButton
					iconClass="codicon-save"
					title={t("chat:checkpoint.save_custom")}
					disabled={buttonsDisabled}
					onClick={handleCustomCheckpoint}
				/>
			)}
			<IconButton
				iconClass="codicon-desktop-download"
				title={t("chat:task.export")}
				onClick={() => vscode.postMessage({ type: "exportCurrentTask" })}
			/>
			{item?.task && (
				<IconButton
					iconClass={showCopyFeedback ? "codicon-check" : "codicon-copy"}
					title={t("history:copyPrompt")}
					onClick={(e) => copyWithFeedback(item.task, e)}
				/>
			)}
			{!!item?.size && item.size > 0 && (
				<>
					<div className="flex items-center">
						<IconButton
							iconClass="codicon-trash"
							title={t("chat:task.delete")}
							disabled={buttonsDisabled}
							onClick={(e) => {
								e.stopPropagation()

								if (e.shiftKey) {
									vscode.postMessage({ type: "deleteTaskWithId", text: item.id })
								} else {
									setDeleteTaskId(item.id)
								}
							}}
						/>
					</div>
					{deleteTaskId && (
						<DeleteTaskDialog
							taskId={deleteTaskId}
							onOpenChange={(open) => !open && setDeleteTaskId(null)}
							open
						/>
					)}
				</>
			)}
			<ShareButton item={item} disabled={false} showLabel={false} />
			<CloudTaskButton item={item} disabled={buttonsDisabled} />
		</div>
	)
}
