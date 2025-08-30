import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"

interface CompactPromptControlProps {
	compactPromptMode?: boolean
	onChange: (value: boolean) => void
	providerName?: string
}

export const CompactPromptControl: React.FC<CompactPromptControlProps> = ({
	compactPromptMode = false,
	onChange,
	providerName,
}) => {
	const { t } = useAppTranslation()

	// Determine the correct translation key prefix based on provider
	const translationPrefix = providerName === "LM Studio" ? "providers.lmStudio" : "providers.ollama"

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<label htmlFor="compact-prompt-mode" className="font-medium">
					{t(`settings:${translationPrefix}.compactPrompt.title`)}
				</label>
				<input
					id="compact-prompt-mode"
					type="checkbox"
					checked={compactPromptMode}
					onChange={(e) => onChange(e.target.checked)}
					className="cursor-pointer"
				/>
			</div>
			<p className="text-sm text-vscode-descriptionForeground">
				{t(`settings:${translationPrefix}.compactPrompt.description`)}
			</p>
			{providerName && (
				<p className="text-xs text-vscode-descriptionForeground italic">
					{t(`settings:${translationPrefix}.compactPrompt.providerNote`, { provider: providerName })}
				</p>
			)}
		</div>
	)
}
