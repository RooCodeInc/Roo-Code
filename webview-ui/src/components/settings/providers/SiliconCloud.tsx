import { useCallback } from "react"
import { VSCodeTextField, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, siliconCloudApiLineSchema, siliconCloudApiLineConfigs } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"
import { cn } from "@/lib/utils"

type SiliconCloudProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const SiliconCloud = ({ apiConfiguration, setApiConfigurationField }: SiliconCloudProps) => {
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
				<label className="block font-medium mb-1">{t("settings:providers.siliconCloudEntrypoint")}</label>
				<VSCodeDropdown
					value={apiConfiguration.siliconCloudApiLine || "china"}
					onChange={handleInputChange("siliconCloudApiLine")}
					className={cn("w-full")}>
					{siliconCloudApiLineSchema.options.map((apiLine) => {
						const config = siliconCloudApiLineConfigs[apiLine]
						return (
							<VSCodeOption key={apiLine} value={apiLine} className="p-2">
								{config.name} ({config.baseUrl})
							</VSCodeOption>
						)
					})}
				</VSCodeDropdown>
				<div className="text-xs text-vscode-descriptionForeground mt-1">
					{t("settings:providers.siliconCloudEntrypointDescription")}
				</div>
			</div>
			<VSCodeTextField
				value={apiConfiguration?.siliconCloudApiKey || ""}
				type="password"
				onInput={handleInputChange("siliconCloudApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.siliconCloudApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.siliconCloudApiKey && (
				<VSCodeButtonLink href="https://siliconflow.cn/" appearance="secondary">
					{t("settings:providers.getSiliconCloudApiKey")}
				</VSCodeButtonLink>
			)}
		</>
	)
}
