import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { useAppTranslation } from "@/i18n/TranslationContext"

interface ModelRoutingSettingsProps {
	enabled: boolean
	onChange: (enabled: boolean) => void
	modelRoutingLightModelId: string | undefined
	setModelRoutingLightModelId: (modelId: string) => void
}

export const ModelRoutingSettings = ({
	enabled,
	onChange,
	modelRoutingLightModelId,
	setModelRoutingLightModelId,
}: ModelRoutingSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className="space-y-4">
			<div>
				<div className="flex items-center gap-2">
					<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
						<span className="font-medium">{t("settings:experimental.MODEL_ROUTING.name")}</span>
					</VSCodeCheckbox>
				</div>
				<p className="text-vscode-descriptionForeground text-sm mt-0">
					{t("settings:experimental.MODEL_ROUTING.description")}
				</p>
			</div>

			{enabled && (
				<div className="ml-2 space-y-3">
					<div>
						<label className="block font-medium mb-1">
							{t("settings:experimental.MODEL_ROUTING.lightModelIdLabel")}
						</label>
						<VSCodeTextField
							value={modelRoutingLightModelId ?? ""}
							placeholder={t("settings:experimental.MODEL_ROUTING.lightModelIdPlaceholder")}
							onInput={(e: any) => setModelRoutingLightModelId(e.target.value)}
							className="w-full"
						/>
					</div>
				</div>
			)}
		</div>
	)
}
