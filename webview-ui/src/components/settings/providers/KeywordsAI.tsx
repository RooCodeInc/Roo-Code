import { useCallback, useState } from "react"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { OrganizationAllowList, ProviderSettings, RouterModels } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type KeywordsAIProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

export const KeywordsAI = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	refetchRouterModels,
	organizationAllowList,
	modelValidationError,
	simplifySettings,
}: KeywordsAIProps) => {
	const { t } = useAppTranslation()
	const [didRefetch, setDidRefetch] = useState<boolean>()

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
				value={apiConfiguration?.keywordsaiBaseUrl || "https://api.keywordsai.co/api/"}
				type="url"
				onInput={handleInputChange("keywordsaiBaseUrl")}
				placeholder="https://api.keywordsai.co/api/"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.baseUrl")}</label>
			</VSCodeTextField>
			<VSCodeTextField
				value={apiConfiguration?.keywordsaiApiKey || ""}
				type="password"
				onInput={handleInputChange("keywordsaiApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.apiKey")}</label>
			</VSCodeTextField>

			<VSCodeCheckbox
				checked={apiConfiguration?.keywordsaiEnableLogging !== false}
				onChange={(e: any) => {
					setApiConfigurationField("keywordsaiEnableLogging", e.target.checked)
				}}>
				<span className="font-medium">Enable Logging</span>
			</VSCodeCheckbox>
			<div className="text-sm text-vscode-descriptionForeground ml-6 mt-1 mb-2">
				Controls whether request/response data is logged. When disabled, only performance metrics are recorded.
			</div>

			<Button
				variant="outline"
				onClick={() => {
					vscode.postMessage({
						type: "requestRouterModels",
						values: { provider: "keywordsai", refresh: true },
					})
					refetchRouterModels()
					setDidRefetch(true)
				}}>
				<div className="flex items-center gap-2">
					<span className="codicon codicon-refresh" />
					{t("settings:providers.refreshModels.label")}
				</div>
			</Button>
			{didRefetch && (
				<div className="flex items-center text-vscode-errorForeground">
					{t("settings:providers.refreshModels.hint")}
				</div>
			)}

			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId="gpt-4o"
				models={routerModels?.keywordsai ?? {}}
				modelIdKey="apiModelId"
				serviceName="Keywords AI"
				serviceUrl="https://keywordsai.co"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>
		</>
	)
}
