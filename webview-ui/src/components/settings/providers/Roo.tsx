import {
	type ProviderSettings,
	type OrganizationAllowList,
	type RouterModels,
	rooDefaultModelId,
} from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ModelPicker } from "../ModelPicker"

type RooProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	cloudIsAuthenticated: boolean
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

export const Roo = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	cloudIsAuthenticated,
	organizationAllowList,
	modelValidationError,
	simplifySettings,
}: RooProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			{cloudIsAuthenticated && (
				<div className="flex justify-between items-center mb-2">
					<div className="text-sm text-vscode-descriptionForeground">
						{t("settings:providers.roo.authenticatedMessage")}
					</div>
				</div>
			)}
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={rooDefaultModelId}
				models={routerModels?.roo ?? {}}
				modelIdKey="apiModelId"
				serviceName="Roo Code Router"
				serviceUrl="https://app.roocode.com"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>
		</>
	)
}
