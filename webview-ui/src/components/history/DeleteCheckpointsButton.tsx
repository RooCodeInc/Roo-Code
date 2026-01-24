import { useCallback } from "react"

import { Button, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"

type DeleteCheckpointsButtonProps = {
	itemId: string
	onDeleteCheckpoints?: (taskId: string) => void
}

export const DeleteCheckpointsButton = ({ itemId, onDeleteCheckpoints }: DeleteCheckpointsButtonProps) => {
	const { t } = useAppTranslation()

	const handleDeleteCheckpointsClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			if (e.shiftKey) {
				vscode.postMessage({ type: "deleteTaskCheckpointsWithId", text: itemId })
			} else if (onDeleteCheckpoints) {
				onDeleteCheckpoints(itemId)
			}
		},
		[itemId, onDeleteCheckpoints],
	)

	return (
		<StandardTooltip content={t("history:deleteCheckpointsTitle")}>
			<Button
				variant="ghost"
				size="icon"
				data-testid="delete-checkpoints-button"
				onClick={handleDeleteCheckpointsClick}
				className="opacity-70">
				<span className="codicon codicon-discard size-4 align-middle text-vscode-descriptionForeground" />
			</Button>
		</StandardTooltip>
	)
}
