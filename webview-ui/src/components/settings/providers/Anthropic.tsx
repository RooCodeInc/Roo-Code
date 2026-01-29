import { useCallback, useState, useEffect } from "react"
import { Checkbox } from "vscrui"
import { VSCodeButton, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"
import { StandardTooltip } from "@src/components/ui"

import { convertHeadersToObject } from "../utils/headers"
import { inputEventTransform, noTransform } from "../transforms"

type AnthropicProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const Anthropic = ({ apiConfiguration, setApiConfigurationField }: AnthropicProps) => {
	const { t } = useAppTranslation()
	const selectedModel = useSelectedModel(apiConfiguration)

	const [anthropicBaseUrlSelected, setAnthropicBaseUrlSelected] = useState(!!apiConfiguration?.anthropicBaseUrl)

	const [customHeaders, setCustomHeaders] = useState<[string, string][]>(() => {
		const headers = apiConfiguration?.anthropicHeaders || {}
		return Object.entries(headers)
	})

	// Check if the current model supports 1M context beta
	const supports1MContextBeta =
		selectedModel?.id === "claude-sonnet-4-20250514" || selectedModel?.id === "claude-sonnet-4-5"

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

	const handleAddCustomHeader = useCallback(() => {
		// Only update the local state to show the new row in the UI.
		setCustomHeaders((prev) => [...prev, ["", ""]])
		// Do not update the main configuration yet, wait for user input.
	}, [])

	const handleUpdateHeaderKey = useCallback((index: number, newKey: string) => {
		setCustomHeaders((prev) => {
			const updated = [...prev]

			if (updated[index]) {
				updated[index] = [newKey, updated[index][1]]
			}

			return updated
		})
	}, [])

	const handleUpdateHeaderValue = useCallback((index: number, newValue: string) => {
		setCustomHeaders((prev) => {
			const updated = [...prev]

			if (updated[index]) {
				updated[index] = [updated[index][0], newValue]
			}

			return updated
		})
	}, [])

	const handleRemoveCustomHeader = useCallback((index: number) => {
		setCustomHeaders((prev) => prev.filter((_, i) => i !== index))
	}, [])

	// Add effect to update the parent component's state when local headers change
	useEffect(() => {
		const timer = setTimeout(() => {
			const headerObject = convertHeadersToObject(customHeaders)
			setApiConfigurationField("anthropicHeaders", headerObject)
		}, 300)

		return () => clearTimeout(timer)
	}, [customHeaders, setApiConfigurationField])

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.apiKey || ""}
				type="password"
				onInput={handleInputChange("apiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.anthropicApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.apiKey && (
				<VSCodeButtonLink href="https://console.anthropic.com/settings/keys" appearance="secondary">
					{t("settings:providers.getAnthropicApiKey")}
				</VSCodeButtonLink>
			)}
			<div>
				<Checkbox
					checked={anthropicBaseUrlSelected}
					onChange={(checked: boolean) => {
						setAnthropicBaseUrlSelected(checked)

						if (!checked) {
							setApiConfigurationField("anthropicBaseUrl", "")
							setApiConfigurationField("anthropicUseAuthToken", false)
						}
					}}>
					{t("settings:providers.useCustomBaseUrl")}
				</Checkbox>
				{anthropicBaseUrlSelected && (
					<>
						<VSCodeTextField
							value={apiConfiguration?.anthropicBaseUrl || ""}
							type="url"
							onInput={handleInputChange("anthropicBaseUrl")}
							placeholder="https://api.anthropic.com"
							className="w-full mt-1"
						/>
						<Checkbox
							checked={apiConfiguration?.anthropicUseAuthToken ?? false}
							onChange={handleInputChange("anthropicUseAuthToken", noTransform)}
							className="w-full mt-1">
							{t("settings:providers.anthropicUseAuthToken")}
						</Checkbox>
					</>
				)}
			</div>

			{/* Custom Headers UI */}
			<div className="mb-4">
				<div className="flex justify-between items-center mb-2">
					<label className="block font-medium">{t("settings:providers.customHeaders")}</label>
					<StandardTooltip content={t("settings:common.add")}>
						<VSCodeButton appearance="icon" onClick={handleAddCustomHeader}>
							<span className="codicon codicon-add"></span>
						</VSCodeButton>
					</StandardTooltip>
				</div>
				{!customHeaders.length ? (
					<div className="text-sm text-vscode-descriptionForeground">
						{t("settings:providers.noCustomHeaders")}
					</div>
				) : (
					customHeaders.map(([key, value], index) => (
						<div key={index} className="flex items-center mb-2">
							<VSCodeTextField
								value={key}
								className="flex-1 mr-2"
								placeholder={t("settings:providers.headerName")}
								onInput={(e: any) => handleUpdateHeaderKey(index, e.target.value)}
							/>
							<VSCodeTextField
								value={value}
								className="flex-1 mr-2"
								placeholder={t("settings:providers.headerValue")}
								onInput={(e: any) => handleUpdateHeaderValue(index, e.target.value)}
							/>
							<StandardTooltip content={t("settings:common.remove")}>
								<VSCodeButton appearance="icon" onClick={() => handleRemoveCustomHeader(index)}>
									<span className="codicon codicon-trash"></span>
								</VSCodeButton>
							</StandardTooltip>
						</div>
					))
				)}
			</div>

			{supports1MContextBeta && (
				<div>
					<Checkbox
						checked={apiConfiguration?.anthropicBeta1MContext ?? false}
						onChange={(checked: boolean) => {
							setApiConfigurationField("anthropicBeta1MContext", checked)
						}}>
						{t("settings:providers.anthropic1MContextBetaLabel")}
					</Checkbox>
					<div className="text-sm text-vscode-descriptionForeground mt-1 ml-6">
						{t("settings:providers.anthropic1MContextBetaDescription")}
					</div>
				</div>
			)}
		</>
	)
}
