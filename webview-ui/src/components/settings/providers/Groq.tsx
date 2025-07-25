import { useCallback } from "react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { inputEventTransform } from "../transforms"
import { ApiKey } from "../ApiKey"

type GroqProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Groq = ({ apiConfiguration, setApiConfigurationField }: GroqProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.groqApiKey || ""}
				apiKeyEnvVar="GROQ_API_KEY"
				apiKeyUseEnvVar={!!apiConfiguration?.groqApiKeyUseEnvVar}
				setApiKey={(value: string) => setApiConfigurationField("groqApiKey", value)}
				setApiKeyUseEnvVar={(value: boolean) => setApiConfigurationField("groqApiKeyUseEnvVar", value)}
				apiKeyLabel={t("settings:providers.groqApiKey")}
				getApiKeyUrl="https://console.groq.com/keys"
				getApiKeyLabel={t("settings:providers.getGroqApiKey")}
			/>
		</>
	)
}
