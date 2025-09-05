import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Trans } from "react-i18next"

import { OrganizationAllowList, type ProviderSettings, cometApiDefaultModelId, cometApiModels } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"
import { filterModels } from "../utils/organizationFilters"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

type CometAPIProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const CometAPI = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	refetchRouterModels,
	organizationAllowList,
	modelValidationError,
}: CometAPIProps) => {
	const { t } = useAppTranslation()

	// Refresh status & error for inline feedback
	const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
	const [refreshError, setRefreshError] = useState<string | undefined>()
	const cometErrorJustReceived = useRef(false)

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

	// Listen for model fetch results to surface errors/success inline (mirrors LiteLLM behavior)
	useEffect(() => {
		const handleMessage = (event: MessageEvent<any>) => {
			const message = event.data
			if (message?.type === "singleRouterModelFetchResponse" && !message.success) {
				const providerName = message.values?.provider as string
				if (providerName === "cometapi") {
					cometErrorJustReceived.current = true
					setRefreshStatus("error")
					setRefreshError(message.error)
				}
			} else if (message?.type === "routerModels") {
				if (refreshStatus === "loading") {
					if (!cometErrorJustReceived.current) {
						setRefreshStatus("success")
					}
					// Reset flag for next cycle
					cometErrorJustReceived.current = false
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [refreshStatus])

	// When API key changes, outer ApiOptions already debounces requestRouterModels.
	// We do an explicit fetch on blur to give immediate feedback and clear cache.
	const handleApiKeyBlur = useCallback(() => {
		const key = apiConfiguration?.cometApiKey
		if (!key) return
		setRefreshStatus("loading")
		setRefreshError(undefined)
		cometErrorJustReceived.current = false

		vscode.postMessage({ type: "flushRouterModels", text: "cometapi" })
		// Trigger a global fetch for all dynamic providers (cheap) – models for cometapi will be included
		vscode.postMessage({ type: "requestRouterModels" })
		// Also ping the hook-driven refetch to update local state ASAP
		refetchRouterModels()
	}, [apiConfiguration?.cometApiKey, refetchRouterModels])

	// Build model list: dynamic first, fallback ensures non-empty; hide info by not exposing metadata anywhere
	const combinedModels = useMemo(() => {
		return { ...(cometApiModels as Record<string, any>), ...(routerModels?.cometapi ?? {}) }
	}, [routerModels])

	const filtered = filterModels(combinedModels, apiConfiguration.apiProvider, organizationAllowList)
	const modelIds = useMemo(() => Object.keys(filtered ?? {}).sort((a, b) => a.localeCompare(b)), [filtered])

	const selected = apiConfiguration.cometApiModelId || cometApiDefaultModelId

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.cometApiKey || ""}
				type="password"
				onInput={handleInputChange("cometApiKey")}
				onBlur={handleApiKeyBlur}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.apiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.cometApiKey && (
				<VSCodeButtonLink href="https://api.cometapi.com/console/token" appearance="secondary">
					Get CometAPI Key
				</VSCodeButtonLink>
			)}

			{refreshStatus === "error" && refreshError && (
				<div className="text-sm text-vscode-errorForeground">{refreshError}</div>
			)}
			<div className="flex flex-col gap-2 mt-2">
				<label className="block font-medium mb-1">{t("settings:modelPicker.label")}</label>
				<Select
					value={selected}
					onValueChange={(value) => setApiConfigurationField("cometApiModelId", value)}
					data-testid="model-picker-simple">
					<SelectTrigger className="w-full">
						<SelectValue placeholder={t("settings:common.select")} />
					</SelectTrigger>
					<SelectContent>
						{modelIds.map((id) => (
							<SelectItem key={id} value={id}>
								{id}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{modelValidationError && (
					<div className="text-sm text-vscode-errorForeground">{modelValidationError}</div>
				)}
				<div className="text-sm text-vscode-descriptionForeground">
					<Trans
						i18nKey="settings:modelPicker.automaticFetch"
						components={{
							serviceLink: <VSCodeLink href="https://api.cometapi.com/v1/models" className="text-sm" />,
							defaultModelLink: (
								<VSCodeLink
									onClick={() => setApiConfigurationField("cometApiModelId", cometApiDefaultModelId)}
									className="text-sm"
								/>
							),
						}}
						values={{ serviceName: "CometAPI", defaultModelId: cometApiDefaultModelId }}
					/>
				</div>
			</div>
		</>
	)
}
