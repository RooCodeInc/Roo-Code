import { useEffect, useState } from "react"

import { OrganizationAllowList, type ProviderSettings, deepInfraDefaultModelId, API_KEYS } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { ModelPicker } from "../ModelPicker"
import { ApiKey } from "../ApiKey"

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


	useEffect(() => {
		// When base URL or API key changes, trigger a silent refresh of models
		// The outer ApiOptions debounces and sends requestRouterModels; this keeps UI responsive
	}, [apiConfiguration.deepInfraBaseUrl, apiConfiguration.deepInfraApiKey])

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.deepInfraApiKey || ""}
				apiKeyEnvVar={API_KEYS.DEEP_INFRA}
				configUseEnvVars={!!apiConfiguration?.deepInfraConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("deepInfraApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("deepInfraConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.apiKey")}
			/>

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
