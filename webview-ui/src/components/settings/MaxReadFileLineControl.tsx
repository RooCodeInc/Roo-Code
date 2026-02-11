import { useAppTranslation } from "@/i18n/TranslationContext"

interface MaxReadFileLineControlProps {
	value: number | undefined
	onChange: (value: number | undefined) => void
}

export const MaxReadFileLineControl = ({ value, onChange }: MaxReadFileLineControlProps) => {
	const { t } = useAppTranslation()

	return (
		<div className="flex flex-col gap-1">
			<label className="block font-medium mb-1">{t("settings:providers.maxReadFileLine.label")}</label>
			<div className="flex items-center gap-2">
				<input
					type="number"
					className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
					value={value ?? ""}
					min={1}
					max={100000}
					placeholder="2000"
					onChange={(e) => {
						const raw = e.target.value
						if (raw === "") {
							onChange(undefined)
							return
						}
						const newValue = parseInt(raw, 10)
						if (!isNaN(newValue) && newValue >= 1) {
							onChange(newValue)
						}
					}}
				/>
				<span>{t("settings:providers.maxReadFileLine.unit")}</span>
			</div>
			<div className="text-sm text-vscode-descriptionForeground">
				{t("settings:providers.maxReadFileLine.description")}
			</div>
		</div>
	)
}
