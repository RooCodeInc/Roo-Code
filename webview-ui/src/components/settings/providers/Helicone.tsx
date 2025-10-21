import { useCallback, useState } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, heliconeDefaultModelId } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { inputEventTransform } from "../transforms"

type HeliconeProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

// TODO [HELICONE]: add model selection for model registry
export const Helicone = ({ apiConfiguration, setApiConfigurationField }: HeliconeProps) => {
	const { t } = useAppTranslation()
	const [baseUrlSelected, setBaseUrlSelected] = useState(!!apiConfiguration?.heliconeBaseUrl)

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.heliconeApiKey || ""}
				type="password"
				onInput={handleInputChange("heliconeApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium">{t("settings:providers.apiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>

			<div className="mt-2">
				<label className="block font-medium mb-1">{t("settings:providers.useCustomBaseUrl")}</label>
				<input
					type="checkbox"
					checked={baseUrlSelected}
					onChange={(e) => {
						const checked = (e.target as HTMLInputElement).checked
						setBaseUrlSelected(checked)
						if (!checked) setApiConfigurationField("heliconeBaseUrl", "")
					}}
				/>
				{baseUrlSelected && (
					<VSCodeTextField
						value={apiConfiguration?.heliconeBaseUrl || ""}
						type="url"
						onInput={handleInputChange("heliconeBaseUrl")}
						placeholder="Default: https://ai-gateway.helicone.ai/v1"
						className="w-full mt-1"
					/>
				)}
			</div>

			<div className="mt-3">
				<label className="block font-medium mb-1">{t("settings:providers.model")}</label>
				<div className="text-sm text-vscode-descriptionForeground p-2 border border-vscode-input-border rounded">
					{heliconeDefaultModelId}
				</div>
				<div className="text-xs text-vscode-descriptionForeground mt-1">
					Using GPT-4o via Helicone AI Gateway
				</div>
			</div>
		</>
	)
}
