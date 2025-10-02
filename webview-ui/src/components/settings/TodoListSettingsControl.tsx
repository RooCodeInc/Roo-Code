import React, { useCallback } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Checkbox } from "@/components/ui/checkbox"

interface TodoListSettingsControlProps {
	todoListEnabled?: boolean
	onChange: (field: "todoListEnabled", value: any) => void
}

export const TodoListSettingsControl: React.FC<TodoListSettingsControlProps> = ({
	todoListEnabled = true,
	onChange,
}) => {
	const { t } = useAppTranslation()

	const handleTodoListEnabledChange = useCallback(
		(checked: boolean) => {
			onChange("todoListEnabled", checked)
		},
		[onChange],
	)

	return (
		<div className="flex flex-col gap-1">
			<div>
				<div className="flex items-center space-x-2">
					<Checkbox checked={todoListEnabled} onCheckedChange={handleTodoListEnabledChange} />
					<span className="font-medium">{t("settings:advanced.todoList.label")}</span>
				</div>
				<div className="text-vscode-descriptionForeground text-sm">
					{t("settings:advanced.todoList.description")}
				</div>
			</div>
		</div>
	)
}
