import { useCallback, useState } from "react"
import { useEvent } from "react-use"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings, OrganizationAllowList } from "@roo-code/types"
import { xaiDefaultModelId, xaiModels } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { Button } from "@src/components/ui"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"
import { vscode } from "@src/utils/vscode"

type XAIProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels?: () => void
	organizationAllowList?: OrganizationAllowList
	modelValidationError?: string
}

export const XAI = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	refetchRouterModels,
	organizationAllowList,
	modelValidationError,
}: XAIProps) => {
	const { t } = useAppTranslation()
	const [didRefetch, setDidRefetch] = useState<boolean>()
	const [refreshError, setRefreshError] = useState<string>()

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

	const handleRefresh = useCallback(() => {
		// Reset status and request fresh models
		setDidRefetch(false)
		setRefreshError(undefined)

		// Flush xAI cache and request fresh models
		vscode.postMessage({ type: "flushRouterModels", text: "xai" })
		vscode.postMessage({ type: "requestRouterModels" })

		// Allow consumer to refetch react-query if provided
		refetchRouterModels?.()
	}, [refetchRouterModels])

	// Listen for router responses to determine success/failure
	useEvent(
		"message",
		useCallback(
			(event: MessageEvent) => {
				const message: any = event.data
				// Error channel: single provider failure
				if (message?.type === "singleRouterModelFetchResponse" && message?.values?.provider === "xai") {
					if (!message.success) {
						setDidRefetch(false)
						setRefreshError(
							t("settings:providers.refreshModels.error") ||
								"Failed to fetch xAI models. Please verify your API key and try again.",
						)
					}
				}

				// Success path: routerModels set with non-empty xai models
				if (message?.type === "routerModels") {
					const models = message.routerModels?.xai ?? {}
					if (models && Object.keys(models).length > 0) {
						setRefreshError(undefined)
						setDidRefetch(true)
					} else if (apiConfiguration?.xaiApiKey) {
						// With a key provided, an empty set indicates failure/unavailable
						setDidRefetch(false)
						setRefreshError(
							t("settings:providers.refreshModels.error") ||
								"No xAI models found for this API key. Please verify your API key and try again.",
						)
					}
				}
			},
			[apiConfiguration?.xaiApiKey, t],
		),
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.xaiApiKey || ""}
				type="password"
				onInput={handleInputChange("xaiApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.xaiApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.xaiApiKey && (
				<VSCodeButtonLink href="https://docs.x.ai/docs/models" appearance="secondary">
					{t("settings:providers.getXaiApiKey")}
				</VSCodeButtonLink>
			)}

			{/* Refresh button is disabled without API key */}
			<div className="flex justify-end mt-2">
				<Button
					variant="outline"
					onClick={handleRefresh}
					className="w-1/2 max-w-xs"
					data-testid="xai-refresh-models"
					disabled={!apiConfiguration?.xaiApiKey}>
					<div className="flex items-center gap-2 justify-center">
						<span className="codicon codicon-refresh" />
						{t("settings:providers.refreshModels.label")}
					</div>
				</Button>
			</div>

			{/* Status messaging */}
			{refreshError && <div className="flex items-center text-vscode-errorForeground mt-2">{refreshError}</div>}
			{!refreshError && didRefetch && (
				<div className="flex items-center text-vscode-charts-green mt-2">
					{t("settings:providers.refreshModels.success")}
				</div>
			)}

			{/* Hide ModelPicker until an API key is provided */}
			{apiConfiguration?.xaiApiKey ? (
				<>
					<ModelPicker
						apiConfiguration={apiConfiguration}
						defaultModelId={xaiDefaultModelId}
						models={routerModels?.xai ?? {}}
						modelIdKey="apiModelId"
						serviceName="xAI (Grok)"
						serviceUrl="https://docs.x.ai/docs/models"
						setApiConfigurationField={setApiConfigurationField}
						organizationAllowList={organizationAllowList as OrganizationAllowList}
						errorMessage={modelValidationError}
					/>

					{/* Context Window Override - only show for models not in static registry or with undefined contextWindow */}
					{(() => {
						const selectedModelId = apiConfiguration?.apiModelId || xaiDefaultModelId
						const staticModel = xaiModels[selectedModelId as keyof typeof xaiModels]
						const hasStaticContextWindow = staticModel?.contextWindow !== undefined

						if (!hasStaticContextWindow) {
							return (
								<>
									<VSCodeTextField
										value={apiConfiguration?.xaiModelContextWindow?.toString() || ""}
										onInput={handleInputChange("xaiModelContextWindow", (e) => {
											const v = (e.target as HTMLInputElement).value.trim()
											const n = Number(v)
											return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
										})}
										placeholder="e.g., 256000"
										className="w-full mt-4">
										<label className="block font-medium mb-1">
											Context Window Override (tokens)
										</label>
									</VSCodeTextField>
									<div className="text-sm text-vscode-descriptionForeground -mt-2">
										This model&apos;s context window is not known. Please enter it manually.
									</div>
								</>
							)
						}
						return null
					})()}
				</>
			) : (
				<div className="text-sm text-vscode-descriptionForeground mt-2">
					{t("settings:providers.refreshModels.missingConfig")}
				</div>
			)}
		</>
	)
}
