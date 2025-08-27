import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, mistralDefaultModelId, mistralModels } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { Checkbox } from "@src/components/ui"

import { inputEventTransform } from "../transforms"

type MistralProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
}

export const Mistral = ({ apiConfiguration, setApiConfigurationField }: MistralProps) => {
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

	// Check if the current model is magistral-medium-latest
	const isMagistralMedium =
		apiConfiguration?.apiModelId === "magistral-medium-latest" ||
		(!apiConfiguration?.apiModelId && mistralDefaultModelId === "magistral-medium-latest")

	// Get the model info for magistral-medium-latest
	const magistralMediumModel = mistralModels["magistral-medium-latest"]
	const hasLargeContext = magistralMediumModel && magistralMediumModel.contextWindow >= 100000

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.mistralApiKey || ""}
				type="password"
				onInput={handleInputChange("mistralApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<span className="font-medium">{t("settings:providers.mistralApiKey")}</span>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.mistralApiKey && (
				<VSCodeButtonLink href="https://console.mistral.ai/" appearance="secondary">
					{t("settings:providers.getMistralApiKey")}
				</VSCodeButtonLink>
			)}
			{isMagistralMedium && hasLargeContext && (
				<div className="flex flex-col gap-2">
					<Checkbox
						checked={apiConfiguration?.useMaximumContextWindow || false}
						onCheckedChange={(checked) =>
							setApiConfigurationField("useMaximumContextWindow", checked === true)
						}>
						{t("settings:providers.mistral.useMaximumContextWindow")}
					</Checkbox>
					{apiConfiguration?.useMaximumContextWindow && (
						<div className="flex items-start gap-2 p-2 rounded-md bg-[color-mix(in_srgb,var(--vscode-editorWarning-foreground)_20%,transparent)] border border-[var(--vscode-editorWarning-foreground)]">
							<span className="codicon codicon-warning text-[var(--vscode-editorWarning-foreground)] mt-0.5"></span>
							<div className="text-sm text-[var(--vscode-editorWarning-foreground)]">
								{t("settings:providers.mistral.contextWindowWarning")}
							</div>
						</div>
					)}
				</div>
			)}
			{(apiConfiguration?.apiModelId?.startsWith("codestral-") ||
				(!apiConfiguration?.apiModelId && mistralDefaultModelId.startsWith("codestral-"))) && (
				<>
					<VSCodeTextField
						value={apiConfiguration?.mistralCodestralUrl || ""}
						type="url"
						onInput={handleInputChange("mistralCodestralUrl")}
						placeholder="https://codestral.mistral.ai"
						className="w-full">
						<label className="block font-medium mb-1">{t("settings:providers.codestralBaseUrl")}</label>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground -mt-2">
						{t("settings:providers.codestralBaseUrlDesc")}
					</div>
				</>
			)}
		</>
	)
}
