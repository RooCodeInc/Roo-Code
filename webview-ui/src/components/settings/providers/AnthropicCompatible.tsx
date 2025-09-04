import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, openAiModelInfoSaneDefaults } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { Button, StandardTooltip } from "@src/components/ui"

import { inputEventTransform, noTransform } from "../transforms"

type AnthropicCompatibleProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const AnthropicCompatible = ({ apiConfiguration, setApiConfigurationField }: AnthropicCompatibleProps) => {
	const { t } = useAppTranslation()

	const [anthropicBaseUrlSelected, setAnthropicBaseUrlSelected] = useState(!!apiConfiguration?.anthropicBaseUrl)

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
				<label className="block font-medium mb-1">{t("settings:providers.anthropicCompatibleApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.apiKey && (
				<VSCodeButtonLink href="https://console.anthropic.com/settings/keys" appearance="secondary">
					{t("settings:providers.getAnthropicApiKey")}
				</VSCodeButtonLink>
			)}
			<VSCodeTextField
				value={apiConfiguration?.apiModelId || ""}
				type="text"
				onInput={handleInputChange("apiModelId")}
				placeholder="claude-3-5-sonnet-20241022"
				className="w-full">
				<label className="block font-medium mb-1">Model Name</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				Enter the model name (e.g., claude-3-5-sonnet-20241022)
			</div>
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

			<div className="flex flex-col gap-3">
				<div className="text-sm text-vscode-descriptionForeground whitespace-pre-line">
					Custom Model Configuration
				</div>

				<div>
					<VSCodeTextField
						value={
							apiConfiguration?.anthropicCustomModelInfo?.contextWindow?.toString() ||
							openAiModelInfoSaneDefaults.contextWindow?.toString() ||
							""
						}
						type="text"
						style={{
							borderColor: (() => {
								const value = apiConfiguration?.anthropicCustomModelInfo?.contextWindow

								if (!value) {
									return "var(--vscode-input-border)"
								}

								return value > 0 ? "var(--vscode-charts-green)" : "var(--vscode-errorForeground)"
							})(),
						}}
						onInput={handleInputChange("anthropicCustomModelInfo", (e) => {
							const value = (e.target as HTMLInputElement).value
							const parsed = parseInt(value)

							return {
								...(apiConfiguration?.anthropicCustomModelInfo || openAiModelInfoSaneDefaults),
								contextWindow: isNaN(parsed) ? openAiModelInfoSaneDefaults.contextWindow : parsed,
							}
						})}
						placeholder="200000"
						className="w-full">
						<label className="block font-medium mb-1">Context Window Size</label>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground">
						Enter the context window size (max tokens the model can process)
					</div>
				</div>

				<div>
					<div className="flex items-center gap-1">
						<Checkbox
							checked={
								apiConfiguration?.anthropicCustomModelInfo?.supportsImages ??
								openAiModelInfoSaneDefaults.supportsImages
							}
							onChange={handleInputChange("anthropicCustomModelInfo", (checked) => {
								return {
									...(apiConfiguration?.anthropicCustomModelInfo || openAiModelInfoSaneDefaults),
									supportsImages: checked,
								}
							})}>
							<span className="font-medium">Supports Images</span>
						</Checkbox>
						<StandardTooltip content="Enable image support for this model">
							<i
								className="codicon codicon-info text-vscode-descriptionForeground"
								style={{ fontSize: "12px" }}
							/>
						</StandardTooltip>
					</div>
					<div className="text-sm text-vscode-descriptionForeground pt-1">
						Enable image support for this model
					</div>
				</div>

				<div>
					<div className="flex items-center gap-1">
						<Checkbox
							checked={apiConfiguration?.anthropicCustomModelInfo?.supportsComputerUse ?? false}
							onChange={handleInputChange("anthropicCustomModelInfo", (checked) => {
								return {
									...(apiConfiguration?.anthropicCustomModelInfo || openAiModelInfoSaneDefaults),
									supportsComputerUse: checked,
								}
							})}>
							<span className="font-medium">Supports Computer Use</span>
						</Checkbox>
						<StandardTooltip content="Enable computer use capabilities for this model">
							<i
								className="codicon codicon-info text-vscode-descriptionForeground"
								style={{ fontSize: "12px" }}
							/>
						</StandardTooltip>
					</div>
					<div className="text-sm text-vscode-descriptionForeground pt-1">
						Enable computer use capabilities for this model
					</div>
				</div>

				<div>
					<div className="flex items-center gap-1">
						<Checkbox
							checked={apiConfiguration?.anthropicCustomModelInfo?.supportsPromptCache ?? false}
							onChange={handleInputChange("anthropicCustomModelInfo", (checked) => {
								return {
									...(apiConfiguration?.anthropicCustomModelInfo || openAiModelInfoSaneDefaults),
									supportsPromptCache: checked,
								}
							})}>
							<span className="font-medium">Supports Prompt Caching</span>
						</Checkbox>
						<StandardTooltip content="Enable prompt caching for this model">
							<i
								className="codicon codicon-info text-vscode-descriptionForeground"
								style={{ fontSize: "12px" }}
							/>
						</StandardTooltip>
					</div>
					<div className="text-sm text-vscode-descriptionForeground pt-1">
						Enable prompt caching for this model
					</div>
				</div>

				<div>
					<VSCodeTextField
						value={
							apiConfiguration?.anthropicCustomModelInfo?.maxTokens?.toString() ||
							openAiModelInfoSaneDefaults.maxTokens?.toString() ||
							""
						}
						type="text"
						style={{
							borderColor: (() => {
								const value = apiConfiguration?.anthropicCustomModelInfo?.maxTokens

								if (!value) {
									return "var(--vscode-input-border)"
								}

								return value > 0 ? "var(--vscode-charts-green)" : "var(--vscode-errorForeground)"
							})(),
						}}
						onInput={handleInputChange("anthropicCustomModelInfo", (e) => {
							const value = parseInt((e.target as HTMLInputElement).value)

							return {
								...(apiConfiguration?.anthropicCustomModelInfo || openAiModelInfoSaneDefaults),
								maxTokens: isNaN(value) ? undefined : value,
							}
						})}
						placeholder="8192"
						className="w-full">
						<label className="block font-medium mb-1">Max Output Tokens</label>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground">
						Maximum number of tokens the model can generate
					</div>
				</div>

				<Button
					variant="secondary"
					onClick={() => setApiConfigurationField("anthropicCustomModelInfo", openAiModelInfoSaneDefaults)}>
					Reset to Defaults
				</Button>
			</div>
		</>
	)
}
