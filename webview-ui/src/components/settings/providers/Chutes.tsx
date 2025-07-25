import { useCallback } from "react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { inputEventTransform } from "../transforms"
import { ApiKey } from "../ApiKey"

type ChutesProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Chutes = ({ apiConfiguration, setApiConfigurationField }: ChutesProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.chutesApiKey || ""}
				apiKeyEnvVar="CHUTES_API_KEY"
				apiKeyUseEnvVar={!!apiConfiguration?.chutesApiKeyUseEnvVar}
				setApiKey={(value: string) => setApiConfigurationField("apiKey", value)}
				setApiKeyUseEnvVar={(value: boolean) => setApiConfigurationField("chutesApiKeyUseEnvVar", value)}
				apiKeyLabel={t("settings:providers.chutesApiKey")}
				getApiKeyUrl="https://chutes.ai/app/api"
				getApiKeyLabel={t("settings:providers.getchutesApiKey")}
			/>
		</>
	)
}
