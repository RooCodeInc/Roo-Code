import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

import { inputEventTransform, noTransform } from "../transforms"

type AnthropicProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const Anthropic = ({ apiConfiguration, setApiConfigurationField }: AnthropicProps) => {
	const { t } = useAppTranslation()
	const selectedModel = useSelectedModel(apiConfiguration)
	const endpointMode =
		apiConfiguration?.anthropicEndpointMode ||
		(apiConfiguration?.anthropicMessagesUrlOverride ? "azure-ai-foundry" : "anthropic")
	const isAzureAiFoundryMode = endpointMode === "azure-ai-foundry"
	const anthropicAuthHeaderMode =
		apiConfiguration?.anthropicAuthHeaderMode || (apiConfiguration?.anthropicUseAuthToken ? "bearer" : "x-api-key")

	const [anthropicBaseUrlSelected, setAnthropicBaseUrlSelected] = useState(!!apiConfiguration?.anthropicBaseUrl)

	// Check if the current model supports 1M context beta
	const supports1MContextBeta =
		selectedModel?.id === "claude-sonnet-4-20250514" ||
		selectedModel?.id === "claude-sonnet-4-5" ||
		selectedModel?.id === "claude-opus-4-6"

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
			<div className="flex flex-col gap-1">
				<label className="block font-medium mb-1">Endpoint Mode</label>
				<Select
					value={endpointMode}
					onValueChange={(value) =>
						setApiConfigurationField(
							"anthropicEndpointMode",
							value as ProviderSettings["anthropicEndpointMode"],
						)
					}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="anthropic">Anthropic (default)</SelectItem>
						<SelectItem value="azure-ai-foundry">Azure AI Foundry (Anthropic-compatible)</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div>
				{isAzureAiFoundryMode ? (
					<div className="flex flex-col gap-2">
						<VSCodeTextField
							value={apiConfiguration?.anthropicMessagesUrlOverride || ""}
							type="url"
							onInput={handleInputChange("anthropicMessagesUrlOverride")}
							placeholder="https://<resource>.services.ai.azure.com/models/<deployment>/messages?api-version=2024-05-01-preview"
							className="w-full mt-1">
							<label className="block font-medium mb-1">Messages Endpoint URL</label>
						</VSCodeTextField>
						<VSCodeTextField
							value={apiConfiguration?.anthropicModelOverride || ""}
							type="text"
							onInput={handleInputChange("anthropicModelOverride")}
							placeholder="your-deployment-name"
							className="w-full">
							<label className="block font-medium mb-1">Deployment Name (Model Override)</label>
						</VSCodeTextField>
						<div className="flex flex-col gap-1">
							<label className="block font-medium mb-1">Auth Header</label>
							<Select
								value={anthropicAuthHeaderMode}
								onValueChange={(value) =>
									setApiConfigurationField(
										"anthropicAuthHeaderMode",
										value as ProviderSettings["anthropicAuthHeaderMode"],
									)
								}>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="x-api-key">x-api-key</SelectItem>
									<SelectItem value="api-key">api-key</SelectItem>
									<SelectItem value="bearer">Authorization: Bearer</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				) : (
					<>
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
					</>
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
