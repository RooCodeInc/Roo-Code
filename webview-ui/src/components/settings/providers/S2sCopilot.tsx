import { useCallback, useState } from "react"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import {
	type ProviderSettings,
	type OrganizationAllowList,
	type RouterModels,
	s2scopilotDefaultModelId,
} from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type S2sCopilotProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

export const S2sCopilot = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	organizationAllowList,
	modelValidationError,
	simplifySettings,
}: S2sCopilotProps) => {
	const { t } = useAppTranslation()

	const [showCaCertPath, setShowCaCertPath] = useState(!!apiConfiguration.s2scopilotCaCertPath)

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
				value={apiConfiguration?.s2scopilotBaseUrl || ""}
				type="url"
				onInput={handleInputChange("s2scopilotBaseUrl")}
				placeholder="https://gpt4ifx.icp.infineon.com"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.s2scopilot.baseUrl")}</label>
				<div className="text-xs text-vscode-descriptionForeground mt-1">
					{t("settings:providers.s2scopilot.baseUrlHelp")}
				</div>
			</VSCodeTextField>

			<VSCodeTextField
				value={apiConfiguration?.s2scopilotApiKey || ""}
				type="password"
				onInput={handleInputChange("s2scopilotApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.s2scopilot.apiKey")}</label>
				<div className="text-xs text-vscode-descriptionForeground mt-1">
					{t("settings:providers.s2scopilot.apiKeyHelp")}
				</div>
			</VSCodeTextField>

			<VSCodeCheckbox
				checked={showCaCertPath}
				onChange={(e: any) => {
					const isChecked = e.target.checked === true
					if (!isChecked) {
						setApiConfigurationField("s2scopilotCaCertPath", undefined)
					}
					setShowCaCertPath(isChecked)
				}}>
				{t("settings:providers.s2scopilot.useCaCert")}
			</VSCodeCheckbox>

			{showCaCertPath && (
				<VSCodeTextField
					value={apiConfiguration?.s2scopilotCaCertPath || ""}
					type="text"
					onInput={handleInputChange("s2scopilotCaCertPath")}
					placeholder="/path/to/ca-bundle.crt"
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.s2scopilot.caCertPath")}</label>
					<div className="text-xs text-vscode-descriptionForeground mt-1">
						{t("settings:providers.s2scopilot.caCertPathHelp")}
					</div>
				</VSCodeTextField>
			)}

			<Button
				variant="outline"
				onClick={() => {
					vscode.postMessage({
						type: "requestRouterModels",
						values: { provider: "s2scopilot", refresh: true },
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
				defaultModelId={s2scopilotDefaultModelId}
				models={routerModels?.s2scopilot ?? {}}
				modelIdKey="s2scopilotModelId"
				serviceName="s2sCopilot"
				serviceUrl="https://gpt4ifx.icp.infineon.com"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>

			<div className="text-sm text-vscode-descriptionForeground mt-2">
				<p className="font-semibold mb-1">{t("settings:providers.s2scopilot.info.title")}</p>
				<p>{t("settings:providers.s2scopilot.info.description")}</p>
			</div>
		</>
	)
}
