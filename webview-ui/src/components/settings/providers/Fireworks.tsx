import type { ProviderSettings } from "@roo-code/types"
import { API_KEYS } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ApiKey } from "../ApiKey"

type FireworksProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Fireworks = ({ apiConfiguration, setApiConfigurationField }: FireworksProps) => {
	const { t } = useAppTranslation()


	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.fireworksApiKey || ""}
				apiKeyEnvVar={API_KEYS.FIREWORKS}
				configUseEnvVars={!!apiConfiguration?.fireworksConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("fireworksApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("fireworksConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.fireworksApiKey")}
				getApiKeyUrl="https://fireworks.ai/"
				getApiKeyLabel={t("settings:providers.getFireworksApiKey")}
			/>
		</>
	)
}
