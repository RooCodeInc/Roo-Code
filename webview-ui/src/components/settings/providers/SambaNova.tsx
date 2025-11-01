import type { ProviderSettings } from "@roo-code/types"
import { API_KEYS } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ApiKey } from "../ApiKey"

type SambaNovaProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const SambaNova = ({ apiConfiguration, setApiConfigurationField }: SambaNovaProps) => {
	const { t } = useAppTranslation()


	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.sambaNovaApiKey || ""}
				apiKeyEnvVar={API_KEYS.SAMBA_NOVA}
				configUseEnvVars={!!apiConfiguration?.sambaNovaConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("sambaNovaApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("sambaNovaConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.sambaNovaApiKey")}
				getApiKeyUrl="https://cloud.sambanova.ai/?utm_source=roocode&utm_medium=external&utm_campaign=cloud_signup"
				getApiKeyLabel={t("settings:providers.getSambaNovaApiKey")}
			/>
		</>
	)
}
