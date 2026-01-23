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

export const RestoreTaskDialog = ({ ...props }: AlertDialogProps) => {
	const { t } = useAppTranslation()
	const [isEnterPressed] = useKeyPress("Enter")

	const { onOpenChange } = props

	const onRestore = useCallback(() => {
		vscode.postMessage({ type: "restoreToTaskStart" })
		onOpenChange?.(false)
	}, [onOpenChange])

	useEffect(() => {
		if (props.open && isEnterPressed) {
			onRestore()
		}
	}, [props.open, isEnterPressed, onRestore])

	return (
		<AlertDialog {...props}>
			<AlertDialogContent onEscapeKeyDown={() => onOpenChange?.(false)}>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("chat:task.restoreToStart")}</AlertDialogTitle>
					<AlertDialogDescription>{t("chat:task.restoreToStartConfirm")}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button variant="secondary">{t("common:answers.cancel")}</Button>
					</AlertDialogCancel>
					<AlertDialogAction asChild>
						<Button variant="destructive" onClick={onRestore}>
							{t("chat:task.restoreToStartButton")}
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
