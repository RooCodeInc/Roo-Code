import type { ProviderSettings } from "@roo-code/types"
import { API_KEYS } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ApiKey } from "../ApiKey"

type DoubaoProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Doubao = ({ apiConfiguration, setApiConfigurationField }: DoubaoProps) => {
	const { t } = useAppTranslation()


	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.doubaoApiKey || ""}
				apiKeyEnvVar={API_KEYS.DOUBAO}
				configUseEnvVars={!!apiConfiguration?.doubaoConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("doubaoApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("doubaoConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.doubaoApiKey")}
				getApiKeyUrl="https://www.volcengine.com/experience/ark?model=doubao-1-5-thinking-vision-pro-250428"
				getApiKeyLabel={t("settings:providers.getDoubaoApiKey")}
			/>
		</>
	)
}
