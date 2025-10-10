import { useAppTranslation } from "@/i18n/TranslationContext"
import { Checkbox } from "@/components/ui/checkbox"

interface ExperimentalFeatureProps {
	enabled: boolean
	onChange: (value: boolean) => void
	// Additional property to identify the experiment
	experimentKey?: string
}

export const ExperimentalFeature = ({ enabled, onChange, experimentKey }: ExperimentalFeatureProps) => {
	const { t } = useAppTranslation()

	// Generate translation keys based on experiment key
	const nameKey = experimentKey ? `settings:experimental.${experimentKey}.name` : ""
	const descriptionKey = experimentKey ? `settings:experimental.${experimentKey}.description` : ""

	return (
		<div>
			<div className="flex items-center gap-2">
				<Checkbox checked={enabled} onCheckedChange={onChange} />
				<span className="font-medium">{t(nameKey)}</span>
			</div>
			<p className="text-vscode-descriptionForeground text-sm mt-0">{t(descriptionKey)}</p>
		</div>
	)
}
