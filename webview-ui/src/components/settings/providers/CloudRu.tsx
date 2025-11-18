import { useCallback, useEffect, useRef } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings, OrganizationAllowList } from "@roo-code/types"
import { cloudRuDefaultModelId, cloudRuDefaultModelInfo } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import type { RouterModels } from "@roo/api"
import { useExtensionState } from "@src/context/ExtensionStateContext"

import { ModelPicker } from "../ModelPicker"
import { inputEventTransform } from "../transforms"

type CloudRuProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const CloudRu = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	organizationAllowList,
	modelValidationError,
}: CloudRuProps) => {
	const { t } = useAppTranslation()
	const { routerModels: extensionRouterModels } = useExtensionState()

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

	// Note: Model fetching is handled by ApiOptions.tsx useDebounce
	// which already triggers requestRouterModels for cloudru provider

	// Use routerModels from props or extension state
	const cloudruModels = routerModels?.cloudru ?? extensionRouterModels?.cloudru ?? {}

	// Selected model info to drive sensible defaults
	const selectedModelId = apiConfiguration.apiModelId || cloudRuDefaultModelId
	const selectedModelInfo = cloudruModels[selectedModelId] ?? cloudRuDefaultModelInfo

	// Automatically toggle legacy format when switching between GigaChat and other models:
	// - For GigaChat: legacy format is enabled by default (unless explicitly turned off).
	// - When switching from GigaChat to another model: legacy format is turned off, but user can turn it back on.
	const wasGigaChatRef = useRef<boolean | undefined>(undefined)
	useEffect(() => {
		const isGigaChat = selectedModelId.startsWith("GigaChat/")

		if (wasGigaChatRef.current === undefined) {
			// Initial mount: ensure GigaChat has legacy format enabled if not explicitly configured.
			if (isGigaChat && apiConfiguration.cloudRuLegacyFormat === undefined) {
				setApiConfigurationField("cloudRuLegacyFormat", true)
			}
		} else {
			// Switched away from GigaChat -> disable legacy format by default.
			if (wasGigaChatRef.current && !isGigaChat) {
				setApiConfigurationField("cloudRuLegacyFormat", false)
			}

			// Switched to GigaChat -> enable legacy format by default.
			if (!wasGigaChatRef.current && isGigaChat) {
				setApiConfigurationField("cloudRuLegacyFormat", true)
			}
		}

		wasGigaChatRef.current = isGigaChat
	}, [selectedModelId, apiConfiguration.cloudRuLegacyFormat, setApiConfigurationField])

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.cloudRuApiKey || ""}
				type="password"
				onInput={handleInputChange("cloudRuApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.cloudRuApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={cloudRuDefaultModelId}
				models={cloudruModels}
				modelIdKey="apiModelId"
				serviceName="Cloud.ru Foundation Models"
				serviceUrl="https://foundation-models.api.cloud.ru/v1/models"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>
			<div className="mt-2">
				<Checkbox
					checked={apiConfiguration?.cloudRuStreamingEnabled ?? true}
					onChange={(checked: boolean) => {
						setApiConfigurationField("cloudRuStreamingEnabled", checked)
					}}>
					{t("settings:modelInfo.enableStreaming")}
				</Checkbox>
			</div>
			<div className="mt-2">
				<Checkbox
					checked={apiConfiguration?.enableReasoningEffort ?? false}
					onChange={(checked: boolean) => {
						setApiConfigurationField("enableReasoningEffort", checked)
					}}>
					{t("settings:providers.setReasoningLevel")}
				</Checkbox>
			</div>
			<div className="mt-4 space-y-3">
				<VSCodeTextField
					value={
						apiConfiguration?.modelMaxTokens?.toString() ?? selectedModelInfo.maxTokens?.toString() ?? ""
					}
					type="text"
					onInput={handleInputChange("modelMaxTokens", (e: any) => {
						const raw = (e.target as HTMLInputElement).value
						const parsed = parseInt(raw, 10)
						return Number.isNaN(parsed) ? undefined : parsed
					})}
					placeholder={t("settings:placeholders.numbers.maxTokens")}
					className="w-full">
					<label className="block font-medium mb-1">
						{t("settings:providers.customModel.maxTokens.label")}
					</label>
				</VSCodeTextField>
				<VSCodeTextField
					value={
						apiConfiguration?.cloudRuContextWindow?.toString() ??
						selectedModelInfo.contextWindow?.toString() ??
						""
					}
					type="text"
					onInput={handleInputChange("cloudRuContextWindow", (e: any) => {
						const raw = (e.target as HTMLInputElement).value
						const parsed = parseInt(raw, 10)
						return Number.isNaN(parsed) ? undefined : parsed
					})}
					placeholder={t("settings:placeholders.numbers.contextWindow")}
					className="w-full">
					<label className="block font-medium mb-1">
						{t("settings:providers.customModel.contextWindow.label")}
					</label>
				</VSCodeTextField>
			</div>
			<div className="mt-2">
				<Checkbox
					checked={apiConfiguration?.cloudRuLegacyFormat ?? true}
					onChange={(checked: boolean) => {
						setApiConfigurationField("cloudRuLegacyFormat", checked)
					}}>
					{t("settings:providers.useLegacyFormat")}
				</Checkbox>
			</div>
		</>
	)
}
