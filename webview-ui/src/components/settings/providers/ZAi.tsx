import { useCallback } from "react"
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"

import { zaiApiLineConfigs, zaiApiLineSchema, type ProviderSettings, API_KEYS } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { inputEventTransform } from "../transforms"
import { cn } from "@/lib/utils"
import { ApiKey } from "../ApiKey"

type ZAiProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const ZAi = ({ apiConfiguration, setApiConfigurationField }: ZAiProps) => {
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
				<label className="block font-medium mb-1">{t("settings:providers.zaiEntrypoint")}</label>
				<VSCodeDropdown
					value={apiConfiguration.zaiApiLine || zaiApiLineSchema.enum.international_coding}
					onChange={handleInputChange("zaiApiLine")}
					className={cn("w-full")}>
					{zaiApiLineSchema.options.map((zaiApiLine) => {
						const config = zaiApiLineConfigs[zaiApiLine]
						return (
							<VSCodeOption key={zaiApiLine} value={zaiApiLine} className="p-2">
								{config.name} ({config.baseUrl})
							</VSCodeOption>
						)
					})}
				</VSCodeDropdown>
				<div className="text-xs text-vscode-descriptionForeground mt-1">
					{t("settings:providers.zaiEntrypointDescription")}
				</div>
			</div>
			<ApiKey
				apiKey={apiConfiguration?.zaiApiKey || ""}
				apiKeyEnvVar={API_KEYS.ZAI}
				configUseEnvVars={!!apiConfiguration?.zaiConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("zaiApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("zaiConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.zaiApiKey")}
				getApiKeyUrl={
					zaiApiLineConfigs[apiConfiguration.zaiApiLine ?? "international_coding"].isChina
						? "https://open.bigmodel.cn/console/overview"
						: "https://z.ai/manage-apikey/apikey-list"
				}
				getApiKeyLabel={t("settings:providers.getZaiApiKey")}
			/>
		</>
	)
}
