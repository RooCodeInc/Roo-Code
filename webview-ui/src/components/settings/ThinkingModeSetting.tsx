import { Checkbox } from "vscrui"

import { useAppTranslation } from "@/i18n/TranslationContext"

interface ThinkingModeSettingProps {
	onChange: (value: boolean) => void
	openAiThinkingModeEnabled?: boolean
}

export const ThinkingModeSetting = ({ onChange, openAiThinkingModeEnabled }: ThinkingModeSettingProps) => {
	const { t } = useAppTranslation()

	return (
		<div>
			<div className="flex items-center gap-2">
				<Checkbox checked={openAiThinkingModeEnabled} onChange={onChange}>
					<span className="font-medium">{t("settings:modelInfo.enableThinkingMode")}</span>
				</Checkbox>
			</div>
			<p className="text-vscode-descriptionForeground text-sm mt-0">
				{t("settings:modelInfo.enableThinkingModeTips")}
			</p>
		</div>
	)
}
