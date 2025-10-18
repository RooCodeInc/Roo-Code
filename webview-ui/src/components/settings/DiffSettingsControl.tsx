import React, { useCallback } from "react"
import { Slider } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Checkbox } from "@/components/ui/checkbox"

interface DiffSettingsControlProps {
	diffEnabled?: boolean
	fuzzyMatchThreshold?: number
	onChange: (field: "diffEnabled" | "fuzzyMatchThreshold", value: any) => void
}

export const DiffSettingsControl: React.FC<DiffSettingsControlProps> = ({
	diffEnabled = true,
	fuzzyMatchThreshold = 1.0,
	onChange,
}) => {
	const { t } = useAppTranslation()

	const handleDiffEnabledChange = useCallback(
		(checked: boolean) => {
			onChange("diffEnabled", checked)
		},
		[onChange],
	)

	const handleThresholdChange = useCallback(
		(newValue: number[]) => {
			onChange("fuzzyMatchThreshold", newValue[0])
		},
		[onChange],
	)

	return (
		<div className="flex flex-col gap-1">
			<div>
				<div className="flex items-center space-x-2">
					<Checkbox checked={diffEnabled} onCheckedChange={handleDiffEnabledChange} />
					<span className="font-medium">{t("settings:advanced.diff.label")}</span>
				</div>
				<div className="text-vscode-descriptionForeground text-sm">
					{t("settings:advanced.diff.description")}
				</div>
			</div>

			{diffEnabled && (
				<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
					<div>
						<label className="block font-medium mb-1">
							{t("settings:advanced.diff.matchPrecision.label")}
						</label>
						<div className="flex items-center gap-2">
							<Slider
								min={0.8}
								max={1}
								step={0.005}
								value={[fuzzyMatchThreshold]}
								onValueChange={handleThresholdChange}
							/>
							<span className="w-10">{Math.round(fuzzyMatchThreshold * 100)}%</span>
						</div>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							{t("settings:advanced.diff.matchPrecision.description")}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
