import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, azureOpenAiDefaultApiVersion } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { inputEventTransform } from "../transforms"

type AzureProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const Azure = ({ apiConfiguration, setApiConfigurationField }: AzureProps) => {
	const { t } = useAppTranslation()

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
				value={apiConfiguration?.azureResourceName || ""}
				onInput={handleInputChange("azureResourceName")}
				placeholder={t("settings:placeholders.azureResourceName")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.azureResourceName")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.azureResourceNameDescription")}
			</div>
			<VSCodeTextField
				value={apiConfiguration?.azureDeploymentName || ""}
				onInput={handleInputChange("azureDeploymentName")}
				placeholder={t("settings:placeholders.azureDeploymentName")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.azureDeploymentName")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.azureDeploymentNameDescription")}
			</div>
			<VSCodeTextField
				value={apiConfiguration?.azureApiKey || ""}
				type="password"
				onInput={handleInputChange("azureApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.azureApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			<VSCodeTextField
				value={apiConfiguration?.azureApiVersion || ""}
				onInput={handleInputChange("azureApiVersion")}
				placeholder={`Default: ${azureOpenAiDefaultApiVersion}`}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.azureApiVersion")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.azureApiVersionDescription")}
			</div>
		</>
	)
}
