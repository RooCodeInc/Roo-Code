import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type NvidiaProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Nvidia = ({ apiConfiguration, setApiConfigurationField }: NvidiaProps) => {
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
			<VSCodeTextField
				value={apiConfiguration?.nvidiaApiKey || ""}
				type="password"
				onInput={handleInputChange("nvidiaApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.nvidiaApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>

			{/* Optional: Custom base URL for self-hosted NVIDIA NIM deployments */}
			<VSCodeTextField
				value={apiConfiguration?.nvidiaBaseUrl || ""}
				onInput={handleInputChange("nvidiaBaseUrl")}
				placeholder="https://integrate.api.nvidia.com/v1"
				className="w-full mt-3">
				<label className="block font-medium mb-1">{t("settings:providers.nvidiaBaseUrl")}</label>
			</VSCodeTextField>

			{!apiConfiguration?.nvidiaApiKey && (
				<VSCodeButtonLink href="https://build.nvidia.com/" appearance="secondary">
					{t("settings:providers.getNvidiaApiKey")}
				</VSCodeButtonLink>
			)}
		</>
	)
}
