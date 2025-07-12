import React, { useCallback } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

interface TodoListSettingsControlProps {
	enableTodoList?: boolean
	onChange: (field: "enableTodoList", value: boolean) => void
}

export const TodoListSettingsControl: React.FC<TodoListSettingsControlProps> = ({
	enableTodoList = true,
	onChange,
}) => {
	const { t } = useAppTranslation()

	const handleTodoListEnabledChange = useCallback(
		(e: any) => {
			onChange("enableTodoList", e.target.checked)
		},
		[onChange],
	)

	return (
		<div className="flex flex-col gap-1">
			<div>
				<VSCodeCheckbox checked={enableTodoList} onChange={handleTodoListEnabledChange}>
					<span className="font-medium">{t("settings:advanced.todoList.label")}</span>
				</VSCodeCheckbox>
				<div className="text-vscode-descriptionForeground text-sm">
					{t("settings:advanced.todoList.description")}
				</div>
			</div>
		</div>
	)
}
