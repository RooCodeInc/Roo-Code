import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import {
	type ProviderSettings,
	type OrganizationAllowList,
	type RouterModels,
	unboundDefaultModelId,
} from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type UnboundProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

export const Unbound = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	organizationAllowList,
	modelValidationError,
	simplifySettings,
}: UnboundProps) => {
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
				value={apiConfiguration?.unboundApiKey || ""}
				type="password"
				onInput={handleInputChange("unboundApiKey")}
				placeholder={t("settings:providers.unboundApiKey")}
				className="w-full">
				<div className="flex justify-between items-center mb-1">
					<label className="block font-medium">{t("settings:providers.unboundApiKey")}</label>
				</div>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			<a
				href="https://gateway.getunbound.ai"
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 rounded-md px-3 w-full"
				style={{
					width: "100%",
					textDecoration: "none",
					color: "var(--vscode-button-foreground)",
					backgroundColor: "var(--vscode-button-background)",
				}}>
				{t("settings:providers.getUnboundApiKey")}
			</a>
			<Button
				variant="outline"
				onClick={() => {
					vscode.postMessage({ type: "requestRouterModels", values: { provider: "unbound", refresh: true } })
				}}>
				<div className="flex items-center gap-2">
					<span className="codicon codicon-refresh" />
					{t("settings:providers.refreshModels.label")}
				</div>
			</Button>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={unboundDefaultModelId}
				models={routerModels?.unbound ?? {}}
				modelIdKey="unboundModelId"
				serviceName="Unbound"
				serviceUrl="https://api.getunbound.ai/models"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>
		</>
	)
}
