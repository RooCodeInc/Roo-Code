import { useCallback, useEffect, useState } from "react"

import { OrganizationAllowList, type ProviderSettings, deepInfraDefaultModelId } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"
import { PasswordInputField } from "@src/components/ui/password-input"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type DeepInfraProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const DeepInfra = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	refetchRouterModels,
	organizationAllowList,
	modelValidationError,
}: DeepInfraProps) => {
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

	useEffect(() => {
		// When base URL or API key changes, trigger a silent refresh of models
		// The outer ApiOptions debounces and sends requestRouterModels; this keeps UI responsive
	}, [apiConfiguration.deepInfraBaseUrl, apiConfiguration.deepInfraApiKey])

	return (
		<>
			<PasswordInputField
				value={apiConfiguration?.deepInfraApiKey || ""}
				onChange={handleInputChange("deepInfraApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				label={t("settings:providers.apiKey")}
				className="w-full"></PasswordInputField>

			<Button
				variant="outline"
				onClick={() => {
					vscode.postMessage({ type: "flushRouterModels", text: "deepinfra" })
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
				defaultModelId={deepInfraDefaultModelId}
				models={routerModels?.deepinfra ?? {}}
				modelIdKey="deepInfraModelId"
				serviceName="Deep Infra"
				serviceUrl="https://deepinfra.com/models"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>
		</>
	)
}
