import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@src/components/ui"

interface MessageModificationConfirmationDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: () => void
	type: "edit" | "delete"
}

export const MessageModificationConfirmationDialog: React.FC<MessageModificationConfirmationDialogProps> = ({
	open,
	onOpenChange,
	onConfirm,
	type,
}) => {
	const { t } = useAppTranslation()

	const isEdit = type === "edit"
	const title = isEdit ? t("common:confirmation.edit_message") : t("common:confirmation.delete_message")
	const description = isEdit ? t("common:confirmation.edit_warning") : t("common:confirmation.delete_warning")

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
					<AlertDialogDescription className="text-base">{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="flex-col gap-2">
					<AlertDialogCancel className="bg-vscode-button-secondaryBackground hover:bg-vscode-button-secondaryHoverBackground text-vscode-button-secondaryForeground border-vscode-button-border">
						{t("common:answers.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground border-vscode-button-border">
						{t("common:confirmation.proceed")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

// Export convenience components for backward compatibility
export const EditMessageDialog: React.FC<Omit<MessageModificationConfirmationDialogProps, "type">> = (props) => (
	<MessageModificationConfirmationDialog {...props} type="edit" />
)

export const DeleteMessageDialog: React.FC<Omit<MessageModificationConfirmationDialogProps, "type">> = (props) => (
	<MessageModificationConfirmationDialog {...props} type="delete" />
)
