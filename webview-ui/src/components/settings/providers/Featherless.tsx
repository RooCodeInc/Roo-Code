import type { ProviderSettings } from "@roo-code/types"
import { API_KEYS } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ApiKey } from "../ApiKey"

type FeatherlessProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Featherless = ({ apiConfiguration, setApiConfigurationField }: FeatherlessProps) => {
	const { t } = useAppTranslation()


	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.featherlessApiKey || ""}
				apiKeyEnvVar={API_KEYS.FEATHERLESS}
				configUseEnvVars={!!apiConfiguration?.featherlessConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("featherlessApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("featherlessConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.featherlessApiKey")}
				getApiKeyUrl="https://featherless.ai/account/api-keys"
				getApiKeyLabel={t("settings:providers.getFeatherlessApiKey")}
			/>
		</>
	)
}
