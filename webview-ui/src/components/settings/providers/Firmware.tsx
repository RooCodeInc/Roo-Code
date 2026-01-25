import { useCallback, useState } from "react"
import { VSCodeTextField, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { type OrganizationAllowList, type ProviderSettings, type RouterModels } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"
import { FirmwareQuotaDisplay } from "./FirmwareQuotaDisplay"

const FIRMWARE_DEFAULT_MODEL_ID = "claude-sonnet-4-5"

type FirmwareProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

export const Firmware = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	refetchRouterModels,
	organizationAllowList,
	modelValidationError,
	simplifySettings,
}: FirmwareProps) => {
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
			<div className="flex flex-col gap-1">
				<div className="flex items-center justify-between">
					<label className="block font-medium">{t("settings:providers.apiKey")}</label>
					<div className="flex items-center gap-3">
						<FirmwareQuotaDisplay />
						<VSCodeLink href="https://app.firmware.ai/api-keys">
							{t("settings:providers.getApiKey")}
						</VSCodeLink>
					</div>
				</div>
				<VSCodeTextField
					value={apiConfiguration?.firmwareApiKey || ""}
					type="password"
					onInput={handleInputChange("firmwareApiKey")}
					placeholder={t("settings:placeholders.apiKey")}
					className="w-full"
				/>
			</div>

			<Button
				variant="outline"
				onClick={() => {
					vscode.postMessage({ type: "flushRouterModels", text: "firmware" })
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
				defaultModelId={FIRMWARE_DEFAULT_MODEL_ID}
				models={routerModels?.firmware ?? {}}
				modelIdKey="firmwareModelId"
				serviceName="Firmware"
				serviceUrl="https://app.firmware.ai/models"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>
		</>
	)
}
