import { useCallback, useEffect, useState } from "react"
import { VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import {
	type OrganizationAllowList,
	type ProviderSettings,
	dialDefaultApiVersion,
	dialDefaultBaseUrl,
	dialDefaultModelId,
} from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type DialProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const Dial = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	refetchRouterModels,
	organizationAllowList,
	modelValidationError,
}: DialProps) => {
	const { t } = useAppTranslation()
	const [didRefetch, setDidRefetch] = useState(false)

	useEffect(() => {
		if (typeof apiConfiguration?.dialBaseUrl === "undefined") {
			setApiConfigurationField("dialBaseUrl", dialDefaultBaseUrl, false)
		}
	}, [apiConfiguration?.dialBaseUrl, setApiConfigurationField])

	useEffect(() => {
		if (typeof apiConfiguration?.dialAzureApiVersion === "undefined") {
			setApiConfigurationField("dialAzureApiVersion", dialDefaultApiVersion, false)
		}
	}, [apiConfiguration?.dialAzureApiVersion, setApiConfigurationField])

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
				value={apiConfiguration?.dialBaseUrl || ""}
				type="url"
				onInput={handleInputChange("dialBaseUrl")}
				placeholder={dialDefaultBaseUrl}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.openAiBaseUrl")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2 mb-2">
				<VSCodeLink href="https://dialx.ai/dial_api" target="_blank" rel="noreferrer">
					{t("settings:providers.providerDocumentation", { provider: "DIAL" })}
				</VSCodeLink>
			</div>
			<VSCodeTextField
				value={apiConfiguration?.dialApiKey || ""}
				type="password"
				onInput={handleInputChange("dialApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.apiKey")}</label>
			</VSCodeTextField>
			<VSCodeTextField
				value={apiConfiguration?.dialAzureApiVersion || ""}
				onInput={handleInputChange("dialAzureApiVersion")}
				placeholder={dialDefaultApiVersion}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:modelInfo.azureApiVersion")}</label>
			</VSCodeTextField>

			<Button
				variant="outline"
				onClick={() => {
					vscode.postMessage({ type: "flushRouterModels", text: "dial" })
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
				defaultModelId={dialDefaultModelId}
				models={routerModels?.dial ?? {}}
				modelIdKey="dialModelId"
				serviceName="EPAM DIAL"
				serviceUrl="https://dialx.ai/dial_api"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>
		</>
	)
}
