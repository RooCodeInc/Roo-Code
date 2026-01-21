import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type AzureFoundryProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const AzureFoundry = ({ apiConfiguration, setApiConfigurationField }: AzureFoundryProps) => {
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
				value={apiConfiguration?.azureFoundryBaseUrl || ""}
				type="text"
				onInput={handleInputChange("azureFoundryBaseUrl")}
				placeholder={t("settings:placeholders.azureFoundryBaseUrl")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.azureFoundry.baseUrl")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.azureFoundry.baseUrlDescription")}
			</div>

			<VSCodeTextField
				value={apiConfiguration?.azureFoundryApiKey || ""}
				type="password"
				onInput={handleInputChange("azureFoundryApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.azureFoundry.apiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>

			<VSCodeTextField
				value={apiConfiguration?.azureFoundryModelId || ""}
				type="text"
				onInput={handleInputChange("azureFoundryModelId")}
				placeholder={t("settings:placeholders.azureFoundryModelId")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.azureFoundry.modelId")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.azureFoundry.modelIdDescription")}
			</div>

			{!apiConfiguration?.azureFoundryApiKey && (
				<VSCodeButtonLink href="https://ai.azure.com/" appearance="secondary">
					{t("settings:providers.azureFoundry.getStarted")}
				</VSCodeButtonLink>
			)}
		</>
	)
}
