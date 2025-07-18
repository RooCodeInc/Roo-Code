import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"
import { ApiKey } from "../ApiKey"

type OpenAIProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const OpenAI = ({ apiConfiguration, setApiConfigurationField }: OpenAIProps) => {
	const { t } = useAppTranslation()

	const [openAiNativeBaseUrlSelected, setOpenAiNativeBaseUrlSelected] = useState(
		!!apiConfiguration?.openAiNativeBaseUrl,
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
			<Checkbox
				checked={openAiNativeBaseUrlSelected}
				onChange={(checked: boolean) => {
					setOpenAiNativeBaseUrlSelected(checked)

					if (!checked) {
						setApiConfigurationField("openAiNativeBaseUrl", "")
					}
				}}>
				{t("settings:providers.useCustomBaseUrl")}
			</Checkbox>
			{openAiNativeBaseUrlSelected && (
				<>
					<VSCodeTextField
						value={apiConfiguration?.openAiNativeBaseUrl || ""}
						type="url"
						onInput={handleInputChange("openAiNativeBaseUrl")}
						placeholder="https://api.openai.com/v1"
						className="w-full mt-1"
					/>
				</>
			)}
			<ApiKey
				apiKey={apiConfiguration?.openAiNativeApiKey || ""}
				apiKeyEnvVar="OPEN_AI_NATIVE_API_KEY"
				apiKeyUseEnvVar={!!apiConfiguration?.openAiNativeApiKeyUseEnvVar}
				setApiKey={(value: string) => setApiConfigurationField("openAiNativeApiKey", value)}
				setApiKeyUseEnvVar={(value: boolean) => setApiConfigurationField("openAiNativeApiKeyUseEnvVar", value)}
				apiKeyLabel={t("settings:providers.openAiNativeApiKey")}
				getApiKeyUrl="https://platform.openai.com/api-keys"
				getApiKeyLabel={t("settings:providers.getopenAiNativeApiKey")}
			/>
		</>
	)
}
