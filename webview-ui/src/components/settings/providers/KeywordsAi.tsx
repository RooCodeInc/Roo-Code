import { useCallback, useEffect, useState } from "react"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import {
	type ProviderSettings,
	type OrganizationAllowList,
	type RouterModels,
	keywordsAiDefaultModelId,
} from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type KeywordsAiProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

export const KeywordsAi = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	organizationAllowList,
	modelValidationError,
	simplifySettings,
}: KeywordsAiProps) => {
	const { t } = useAppTranslation()

	const [keywordsAiEndpointSelected, setKeywordsAiEndpointSelected] = useState(!!apiConfiguration.keywordsAiBaseUrl)

	// This ensures that the "Use custom URL" checkbox is hidden when the user deletes the URL.
	useEffect(() => {
		setKeywordsAiEndpointSelected(!!apiConfiguration?.keywordsAiBaseUrl)
	}, [apiConfiguration?.keywordsAiBaseUrl])

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
				value={apiConfiguration?.keywordsAiApiKey || ""}
				type="password"
				onInput={handleInputChange("keywordsAiApiKey")}
				placeholder={t("settings:providers.keywordsAi.getApiKey")}
				className="w-full">
				<div className="flex justify-between items-center mb-1">
					<label className="block font-medium">{t("settings:providers.keywordsAi.apiKey")}</label>
				</div>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			<a
				href="https://platform.keywordsai.co/platform/api/api-keys"
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 rounded-md px-3 w-full"
				style={{
					width: "100%",
					textDecoration: "none",
					color: "var(--vscode-button-foreground)",
					backgroundColor: "var(--vscode-button-background)",
				}}>
				{t("settings:providers.keywordsAi.getApiKey")}
			</a>

			<VSCodeCheckbox
				checked={apiConfiguration.keywordsAiEnableLogging !== false}
				onChange={(e: any) => {
					const isChecked = e.target.checked === true
					setApiConfigurationField("keywordsAiEnableLogging", isChecked)
				}}>
				{t("settings:providers.keywordsAi.enableLogging")}
			</VSCodeCheckbox>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.keywordsAi.enableLoggingDescription")}
			</div>

			<VSCodeCheckbox
				checked={keywordsAiEndpointSelected}
				onChange={(e: any) => {
					const isChecked = e.target.checked === true
					if (!isChecked) {
						setApiConfigurationField("keywordsAiBaseUrl", undefined)
					}

					setKeywordsAiEndpointSelected(isChecked)
				}}>
				{t("settings:providers.keywordsAi.useCustomBaseUrl")}
			</VSCodeCheckbox>
			{keywordsAiEndpointSelected && (
				<VSCodeTextField
					value={apiConfiguration?.keywordsAiBaseUrl || ""}
					type="text"
					onInput={handleInputChange("keywordsAiBaseUrl")}
					placeholder="https://api.keywordsai.co/api"
					className="w-full">
					<div className="flex justify-between items-center mb-1">
						<label className="block font-medium">{t("settings:providers.keywordsAi.baseUrl")}</label>
					</div>
				</VSCodeTextField>
			)}
			<Button
				variant="outline"
				onClick={() => {
					vscode.postMessage({
						type: "requestRouterModels",
						values: { provider: "keywords-ai", refresh: true },
					})
				}}>
				<div className="flex items-center gap-2">
					<span className="codicon codicon-refresh" />
					{t("settings:providers.refreshModels.label")}
				</div>
			</Button>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={keywordsAiDefaultModelId}
				models={routerModels?.["keywords-ai"] ?? {}}
				modelIdKey="keywordsAiModelId"
				serviceName="Keywords AI"
				serviceUrl="https://keywordsai.co"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>
		</>
	)
}
