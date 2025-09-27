import { type ProviderSettings, type OrganizationAllowList, vercelAiGatewayDefaultModelId, API_KEYS } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ModelPicker } from "../ModelPicker"
import { ApiKey } from "../ApiKey"

type VercelAiGatewayProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const VercelAiGateway = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	organizationAllowList,
	modelValidationError,
}: VercelAiGatewayProps) => {
	const { t } = useAppTranslation()


	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.vercelAiGatewayApiKey || ""}
				apiKeyEnvVar={API_KEYS.VERCEL}
				configUseEnvVars={!!apiConfiguration?.vercelConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("vercelAiGatewayApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("vercelConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.vercelAiGatewayApiKey")}
				getApiKeyUrl="https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys&title=AI+Gateway+API+Key"
				getApiKeyLabel={t("settings:providers.getVercelAiGatewayApiKey")}
			/>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={vercelAiGatewayDefaultModelId}
				models={routerModels?.["vercel-ai-gateway"] ?? {}}
				modelIdKey="vercelAiGatewayModelId"
				serviceName="Vercel AI Gateway"
				serviceUrl="https://vercel.com/ai-gateway/models"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>
		</>
	)
}
