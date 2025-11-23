import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"

import { inputEventTransform } from "../transforms"

type AzureProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Azure = ({ apiConfiguration, setApiConfigurationField }: AzureProps) => {
	const { t } = useAppTranslation()
	const selectedModel = useSelectedModel(apiConfiguration)

	const [showAdvanced, setShowAdvanced] = useState(
		!!(apiConfiguration?.azureDeploymentName || apiConfiguration?.azureApiVersion),
	)

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
				value={apiConfiguration?.azureApiKey || apiConfiguration?.apiKey || ""}
				type="password"
				onInput={handleInputChange("azureApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.azureApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.azureApiKey && !apiConfiguration?.apiKey && (
				<VSCodeButtonLink href="https://portal.azure.com" appearance="secondary">
					{t("settings:providers.getAzureApiKey")}
				</VSCodeButtonLink>
			)}

			<VSCodeTextField
				value={apiConfiguration?.azureBaseUrl || ""}
				type="url"
				onInput={handleInputChange("azureBaseUrl")}
				placeholder="https://your-endpoint.cognitiveservices.azure.com/"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.azureBaseUrl")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionNote -mt-2">{t("settings:providers.azureBaseUrlHint")}</div>

			<div>
				<Checkbox
					checked={showAdvanced}
					onChange={(checked: boolean) => {
						setShowAdvanced(checked)
						if (!checked) {
							setApiConfigurationField("azureDeploymentName", "")
							setApiConfigurationField("azureApiVersion", "")
						}
					}}>
					{t("settings:providers.azureShowAdvanced")}
				</Checkbox>
				{showAdvanced && (
					<>
						<VSCodeTextField
							value={apiConfiguration?.azureDeploymentName || ""}
							type="text"
							onInput={handleInputChange("azureDeploymentName")}
							placeholder={selectedModel?.id || "claude-sonnet-4-5"}
							className="w-full mt-2">
							<label className="block font-medium mb-1">
								{t("settings:providers.azureDeploymentName")}
							</label>
						</VSCodeTextField>
						<div className="text-sm text-vscode-descriptionForeground -mt-2">
							{t("settings:providers.azureDeploymentNameHint")}
						</div>

						<VSCodeTextField
							value={apiConfiguration?.azureApiVersion || ""}
							type="text"
							onInput={handleInputChange("azureApiVersion")}
							placeholder="2024-12-01-preview"
							className="w-full mt-2">
							<label className="block font-medium mb-1">{t("settings:providers.azureApiVersion")}</label>
						</VSCodeTextField>
						<div className="text-sm text-vscode-descriptionForeground -mt-2">
							{t("settings:providers.azureApiVersionHint")}
						</div>
					</>
				)}
			</div>
		</>
	)
}
