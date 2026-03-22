import { DEFAULT_MAX_FOLLOW_UP_SUGGESTIONS } from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"

import { Slider } from "@/components/ui"

interface MaxFollowUpSuggestionsControlProps {
	value: number
	onChange: (value: number) => void
}

export const MaxFollowUpSuggestionsControl = ({ value, onChange }: MaxFollowUpSuggestionsControlProps) => {
	const { t } = useAppTranslation()

	return (
		<div className="flex flex-col gap-1">
			<label className="block font-medium mb-1">{t("settings:providers.maxFollowUpSuggestions.label")}</label>
			<div className="flex items-center gap-2">
				<Slider
					value={[value ?? DEFAULT_MAX_FOLLOW_UP_SUGGESTIONS]}
					min={1}
					max={10}
					step={1}
					onValueChange={(newValue) => onChange(Math.max(1, newValue[0]))}
				/>
				<span className="w-10">{Math.max(1, value ?? DEFAULT_MAX_FOLLOW_UP_SUGGESTIONS)}</span>
			</div>
			<div className="text-sm text-vscode-descriptionForeground">
				{t("settings:providers.maxFollowUpSuggestions.description", {
					value: value ?? DEFAULT_MAX_FOLLOW_UP_SUGGESTIONS,
				})}
			</div>
		</div>
	)
}
