import { useCallback } from "react"
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"
import { API_KEYS } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { inputEventTransform } from "../transforms"
import { cn } from "@/lib/utils"
import { ApiKey } from "../ApiKey"

type MoonshotProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Moonshot = ({ apiConfiguration, setApiConfigurationField }: MoonshotProps) => {
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
			<div>
				<label className="block font-medium mb-1">{t("settings:providers.moonshotBaseUrl")}</label>
				<VSCodeDropdown
					value={apiConfiguration.moonshotBaseUrl}
					onChange={handleInputChange("moonshotBaseUrl")}
					className={cn("w-full")}>
					<VSCodeOption value="https://api.moonshot.ai/v1" className="p-2">
						api.moonshot.ai
					</VSCodeOption>
					<VSCodeOption value="https://api.moonshot.cn/v1" className="p-2">
						api.moonshot.cn
					</VSCodeOption>
				</VSCodeDropdown>
			</div>
			<ApiKey
				apiKey={apiConfiguration?.moonshotApiKey || ""}
				apiKeyEnvVar={API_KEYS.MOONSHOT}
				configUseEnvVars={!!apiConfiguration?.moonshotConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("moonshotApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("moonshotConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.moonshotApiKey")}
				getApiKeyUrl={
					apiConfiguration.moonshotBaseUrl === "https://api.moonshot.cn/v1"
						? "https://platform.moonshot.cn/console/api-keys"
						: "https://platform.moonshot.ai/console/api-keys"
				}
				getApiKeyLabel={t("settings:providers.getMoonshotApiKey")}
			/>
		</>
	)
}
