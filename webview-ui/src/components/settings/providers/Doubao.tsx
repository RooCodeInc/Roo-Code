import { useCallback } from "react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { PasswordInputField } from "@src/components/ui/password-input"

import { inputEventTransform } from "../transforms"

type DoubaoProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Doubao = ({ apiConfiguration, setApiConfigurationField }: DoubaoProps) => {
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
				value={apiConfiguration?.doubaoApiKey || ""}
				onChange={handleInputChange("doubaoApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				label={t("settings:providers.doubaoApiKey")}
				className="w-full"></PasswordInputField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.doubaoApiKey && (
				<VSCodeButtonLink
					href="https://www.volcengine.com/experience/ark?model=doubao-1-5-thinking-vision-pro-250428"
					appearance="secondary">
					{t("settings:providers.getDoubaoApiKey")}
				</VSCodeButtonLink>
			)}
		</>
	)
}
