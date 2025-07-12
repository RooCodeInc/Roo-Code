import React, { useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { DiffSettingsControl } from "./DiffSettingsControl"
import { TodoListSettingsControl } from "./TodoListSettingsControl"

interface AdvancedSettingsSectionProps {
	diffEnabled?: boolean
	fuzzyMatchThreshold?: number
	enableTodoList?: boolean
	onChange: (field: "diffEnabled" | "fuzzyMatchThreshold" | "enableTodoList", value: any) => void
	children?: React.ReactNode
}

export const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
	diffEnabled,
	fuzzyMatchThreshold,
	enableTodoList,
	onChange,
	children,
}) => {
	const { t } = useAppTranslation()
	const [isExpanded, setIsExpanded] = useState(false)

	const toggleExpanded = () => {
		setIsExpanded(!isExpanded)
	}

	return (
		<div className="flex flex-col gap-3">
			<VSCodeButton
				appearance="secondary"
				onClick={toggleExpanded}
				className="flex items-center justify-between w-full text-left">
				{`${t("settings:advanced.section.label")} ${isExpanded ? "▼" : "▶"}`}
			</VSCodeButton>

			{isExpanded && (
				<div className="flex flex-col gap-4">
					<DiffSettingsControl
						diffEnabled={diffEnabled}
						fuzzyMatchThreshold={fuzzyMatchThreshold}
						onChange={onChange}
					/>
					<TodoListSettingsControl enableTodoList={enableTodoList} onChange={onChange} />
					{children}
				</div>
			)}
		</div>
	)
}
