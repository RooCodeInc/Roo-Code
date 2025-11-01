import type { ProviderSettings } from "@roo-code/types"
import { API_KEYS } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ApiKey } from "../ApiKey"

type CerebrasProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Cerebras = ({ apiConfiguration, setApiConfigurationField }: CerebrasProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.cerebrasApiKey || ""}
				apiKeyEnvVar={API_KEYS.CEREBRAS}
				configUseEnvVars={!!apiConfiguration?.cerebrasConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("cerebrasApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("cerebrasConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.cerebrasApiKey")}
				getApiKeyUrl="https://cloud.cerebras.ai?utm_source=roocode"
				getApiKeyLabel={t("settings:providers.getCerebrasApiKey")}
			/>
		</>
	)
}
