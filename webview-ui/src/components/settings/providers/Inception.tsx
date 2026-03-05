import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type InceptionProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const Inception = ({ apiConfiguration, setApiConfigurationField }: InceptionProps) => {
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
			<div>
				<VSCodeTextField
					value={apiConfiguration?.inceptionBaseUrl || ""}
					onInput={handleInputChange("inceptionBaseUrl")}
					placeholder="https://api.inceptionlabs.ai/v1"
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.inceptionBaseUrl")}</label>
				</VSCodeTextField>
			</div>
			<div>
				<VSCodeTextField
					value={apiConfiguration?.inceptionApiKey || ""}
					type="password"
					onInput={handleInputChange("inceptionApiKey")}
					placeholder={t("settings:placeholders.apiKey")}
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.inceptionApiKey")}</label>
				</VSCodeTextField>
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.apiKeyStorageNotice")}
				</div>
				{!apiConfiguration?.inceptionApiKey && (
					<VSCodeButtonLink href="https://app.inceptionlabs.ai/" appearance="secondary">
						{t("settings:providers.getInceptionApiKey")}
					</VSCodeButtonLink>
				)}
			</div>
		</>
	)
}
