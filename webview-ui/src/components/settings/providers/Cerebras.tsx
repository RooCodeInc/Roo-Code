import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { PasswordInputField } from "@src/components/ui/password-input"

import { inputEventTransform } from "../transforms"

type CerebrasProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Cerebras = ({ apiConfiguration, setApiConfigurationField }: CerebrasProps) => {
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
			<PasswordInputField
				value={apiConfiguration?.cerebrasApiKey || ""}
				onChange={handleInputChange("cerebrasApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				label={t("settings:providers.cerebrasApiKey")}
				className="w-full"></PasswordInputField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.cerebrasApiKey && (
				<VSCodeButtonLink href="https://cloud.cerebras.ai?utm_source=roocode" appearance="secondary">
					{t("settings:providers.getCerebrasApiKey")}
				</VSCodeButtonLink>
			)}
		</>
	)
}
