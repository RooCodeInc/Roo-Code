import { useEffect, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useDebounce } from "react-use"

import { Slider } from "@/components/ui"
import { Checkbox } from "@/components/ui/checkbox"

interface TemperatureControlProps {
	value: number | undefined | null
	onChange: (value: number | undefined | null) => void
	maxValue?: number // Some providers like OpenAI use 0-2 range.
}

export const TemperatureControl = ({ value, onChange, maxValue = 1 }: TemperatureControlProps) => {
	const { t } = useAppTranslation()
	const [isCustomTemperature, setIsCustomTemperature] = useState(value !== undefined)
	const [inputValue, setInputValue] = useState(value)

	useDebounce(() => onChange(inputValue), 50, [onChange, inputValue])

	// Sync internal state with prop changes when switching profiles.
	useEffect(() => {
		const hasCustomTemperature = value !== undefined && value !== null
		setIsCustomTemperature(hasCustomTemperature)
		setInputValue(value)
	}, [value])

	return (
		<>
			<div>
				<div className="flex items-center space-x-2">
					<Checkbox
						checked={isCustomTemperature}
						onCheckedChange={(checked) => {
							const isChecked = checked === true
							setIsCustomTemperature(isChecked)

							if (!isChecked) {
								setInputValue(null) // Unset the temperature, note that undefined is unserializable.
							} else {
								setInputValue(value ?? 0) // Use the value from apiConfiguration, if set.
							}
						}}
					/>
					<label className="block font-medium mb-1">{t("settings:temperature.useCustom")}</label>
				</div>
				<div className="text-sm text-vscode-descriptionForeground mt-1">
					{t("settings:temperature.description")}
				</div>
			</div>

			{isCustomTemperature && (
				<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
					<div>
						<div className="flex items-center gap-2">
							<Slider
								min={0}
								max={maxValue}
								step={0.01}
								value={[inputValue ?? 0]}
								onValueChange={([value]) => setInputValue(value)}
							/>
							<span className="w-10">{inputValue}</span>
						</div>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							{t("settings:temperature.rangeDescription")}
						</div>
					</div>
				</div>
			)}
		</>
	)
}
