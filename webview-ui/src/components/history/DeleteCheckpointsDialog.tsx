import { useCallback, useEffect } from "react"
import { useKeyPress } from "react-use"
import { AlertDialogProps } from "@radix-ui/react-alert-dialog"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"

import { vscode } from "@/utils/vscode"

interface DeleteCheckpointsDialogProps extends AlertDialogProps {
	taskId: string
}

export const DeleteCheckpointsDialog = ({ taskId, ...props }: DeleteCheckpointsDialogProps) => {
	const { t } = useAppTranslation()
	const [isEnterPressed] = useKeyPress("Enter")

	const { onOpenChange } = props

	const onDeleteCheckpoints = useCallback(() => {
		if (taskId) {
			vscode.postMessage({ type: "deleteTaskCheckpointsWithId", text: taskId })
			onOpenChange?.(false)
		}
	}, [taskId, onOpenChange])

	useEffect(() => {
		if (taskId && isEnterPressed) {
			onDeleteCheckpoints()
		}
	}, [taskId, isEnterPressed, onDeleteCheckpoints])

	return (
		<AlertDialog {...props}>
			<AlertDialogContent onEscapeKeyDown={() => onOpenChange?.(false)}>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("history:deleteCheckpoints")}</AlertDialogTitle>
					<AlertDialogDescription>{t("history:deleteCheckpointsMessage")}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button variant="secondary">{t("history:cancel")}</Button>
					</AlertDialogCancel>
					<AlertDialogAction asChild>
						<Button variant="destructive" onClick={onDeleteCheckpoints}>
							{t("history:deleteCheckpointsConfirm")}
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
