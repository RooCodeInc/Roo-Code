import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings, ModelInfo } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"

import { inputEventTransform, noTransform } from "../transforms"

type AnthropicProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Anthropic = ({ apiConfiguration, setApiConfigurationField }: AnthropicProps) => {
	const { t } = useAppTranslation()
	const selectedModel = useSelectedModel(apiConfiguration)

	const [anthropicBaseUrlSelected, setAnthropicBaseUrlSelected] = useState(!!apiConfiguration?.anthropicBaseUrl)
	const [useCustomModelName, setUseCustomModelName] = useState(!!apiConfiguration?.anthropicCustomModelName)

	// Check if the current model supports 1M context beta
	const supports1MContextBeta =
		selectedModel?.id === "claude-sonnet-4-20250514" || selectedModel?.id === "claude-sonnet-4-5"

	// Get current custom model info or create default
	const customModelInfo = apiConfiguration?.anthropicCustomModelInfo ?? {
		contextWindow: 200000,
		maxTokens: 48000,
		maxThinkingTokens: 16000,
		supportsImages: true,
		supportsPromptCache: true,
	}

	// Helper to update a specific field in anthropicCustomModelInfo
	const updateCustomModelInfo = useCallback(
		(field: keyof ModelInfo, value: ModelInfo[keyof ModelInfo]) => {
			const currentInfo = apiConfiguration?.anthropicCustomModelInfo ?? {
				contextWindow: 200000,
				maxTokens: 48000,
				maxThinkingTokens: 16000,
				supportsImages: true,
				supportsPromptCache: true,
			}
			setApiConfigurationField("anthropicCustomModelInfo", {
				...currentInfo,
				[field]: value,
			})
		},
		[apiConfiguration?.anthropicCustomModelInfo, setApiConfigurationField],
	)

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
			<div>
				<Checkbox
					checked={anthropicBaseUrlSelected}
					onChange={(checked: boolean) => {
						setAnthropicBaseUrlSelected(checked)

						if (!checked) {
							setApiConfigurationField("anthropicBaseUrl", "")
							setApiConfigurationField("anthropicUseAuthToken", false)
							setUseCustomModelName(false)
							setApiConfigurationField("anthropicCustomModelName", "")
							setApiConfigurationField("anthropicCustomModelInfo", undefined)
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
						<Checkbox
							checked={useCustomModelName}
							onChange={(checked: boolean) => {
								setUseCustomModelName(checked)
								if (!checked) {
									setApiConfigurationField("anthropicCustomModelName", "")
									setApiConfigurationField("anthropicCustomModelInfo", undefined)
								}
							}}
							className="w-full mt-1">
							{t("settings:providers.useCustomModelName")}
						</Checkbox>
						{useCustomModelName && (
							<>
								<VSCodeTextField
									value={apiConfiguration?.anthropicCustomModelName || ""}
									onInput={handleInputChange("anthropicCustomModelName")}
									placeholder={t("settings:placeholders.customModelName")}
									className="w-full mt-1"
								/>
								<div className="text-sm text-vscode-descriptionForeground mt-2 mb-1">
									{t("settings:providers.anthropic.capabilityOverrides")}
								</div>
								<div className="flex flex-col gap-1 ml-2">
									<Checkbox
										checked={customModelInfo.supportsImages ?? true}
										onChange={(checked: boolean) => {
											updateCustomModelInfo("supportsImages", checked)
										}}>
										{t("settings:providers.anthropic.supportsImages")}
									</Checkbox>
									<Checkbox
										checked={customModelInfo.supportsPromptCache ?? true}
										onChange={(checked: boolean) => {
											updateCustomModelInfo("supportsPromptCache", checked)
										}}>
										{t("settings:providers.anthropic.supportsPromptCache")}
									</Checkbox>
									<Checkbox
										checked={customModelInfo.supportsReasoningBudget ?? false}
										onChange={(checked: boolean) => {
											updateCustomModelInfo("supportsReasoningBudget", checked)
										}}>
										{t("settings:providers.anthropic.supportsThinking")}
									</Checkbox>
									<div className="flex items-center gap-2 mt-1">
										<label className="text-sm whitespace-nowrap">
											{t("settings:providers.anthropic.contextWindow")}
										</label>
										<VSCodeTextField
											value={customModelInfo.contextWindow?.toString() || ""}
											onInput={(e) => {
												const value = parseInt((e.target as HTMLInputElement).value)
												updateCustomModelInfo("contextWindow", isNaN(value) ? undefined : value)
											}}
											placeholder="200000"
											className="w-32"
										/>
									</div>
									<div className="flex items-center gap-2 mt-1">
										<label className="text-sm whitespace-nowrap">
											{t("settings:providers.anthropic.maxOutputTokens")}
										</label>
										<VSCodeTextField
											value={customModelInfo.maxTokens?.toString() || ""}
											onInput={(e) => {
												const value = parseInt((e.target as HTMLInputElement).value)
												updateCustomModelInfo("maxTokens", isNaN(value) ? undefined : value)
											}}
											placeholder="48000"
											className="w-32"
										/>
									</div>
									<div className="flex items-center gap-2 mt-1">
										<label className="text-sm whitespace-nowrap">
											{t("settings:providers.anthropic.maxThinkingTokens")}
										</label>
										<VSCodeTextField
											value={customModelInfo.maxThinkingTokens?.toString() || ""}
											onInput={(e) => {
												const value = parseInt((e.target as HTMLInputElement).value)
												updateCustomModelInfo(
													"maxThinkingTokens",
													isNaN(value) ? undefined : value,
												)
											}}
											placeholder="16000"
											className="w-32"
										/>
									</div>
								</div>
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
