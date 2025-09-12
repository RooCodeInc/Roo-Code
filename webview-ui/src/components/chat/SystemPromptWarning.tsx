import React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"

export const SystemPromptWarning: React.FC = () => {
	const { t } = useAppTranslation()

	return (
		<div className="flex items-center px-4 py-1 mb-2 mt-1 text-sm font-medium rounded-xl bg-vscode-editorWarning-foreground text-vscode-editor-background">
			<div className="flex items-center justify-center w-5 h-5 mr-2">
				<span className="codicon codicon-warning" />
			</div>
			<span>{t("chat:systemPromptWarning")}</span>
		</div>
	)
}

export default SystemPromptWarning
