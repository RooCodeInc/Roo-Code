import { useState, useCallback, useEffect, useRef } from "react"
import { useEvent } from "react-use"
import { Checkbox } from "vscrui"
import { VSCodeButton, VSCodeCheckbox, VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import {
	type ProviderSettings,
	type ModelInfo,
	type ReasoningEffort,
	azureOpenAiDefaultApiVersion,
	zgsmModelsConfig as zgsmModels,
	zgsmDefaultModelId,
	OrganizationAllowList,
} from "@roo-code/types"

import { ExtensionMessage } from "@roo/ExtensionMessage"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button, StandardTooltip } from "@src/components/ui"

import { convertHeadersToObject } from "../utils/headers"
import { inputEventTransform, noTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"
import { R1FormatSetting } from "../R1FormatSetting"
import { ThinkingBudget } from "../ThinkingBudget"
import { SetCachedStateField } from "../types"
import { isValidUrl } from "@/utils/validate"
import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { delay } from "lodash-es"

type OpenAICompatibleProps = {
	fromWelcomeView?: boolean
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	useZgsmCustomConfig?: boolean
	setCachedStateField: SetCachedStateField<"useZgsmCustomConfig">
	refetchRouterModels?: () => void
}

export const ZgsmAI = ({
	apiConfiguration,
	fromWelcomeView,
	setApiConfigurationField,
	setCachedStateField,
	organizationAllowList,
	modelValidationError,
	useZgsmCustomConfig,
	refetchRouterModels,
}: OpenAICompatibleProps) => {
	const { t } = useAppTranslation()
	const [refetchingModels, setRefetchingModels] = useState(false)
	const [azureApiVersionSelected, setAzureApiVersionSelected] = useState(!!apiConfiguration?.azureApiVersion)
	const [openAiLegacyFormatSelected, setOpenAiLegacyFormatSelected] = useState(!!apiConfiguration?.openAiLegacyFormat)

	// Use `ref` to track whether `includeMaxTokens` has been explicitly set by the user.
	const includeMaxTokensInitializedRef = useRef(Object.hasOwn(apiConfiguration, "includeMaxTokens"))

	const [openAiModels, setOpenAiModels] = useState<Record<string, ModelInfo> | null>(null)

	const [customHeaders, setCustomHeaders] = useState<[string, string][]>(() => {
		const headers = apiConfiguration?.openAiHeaders || {}
		return Object.entries(headers)
	})

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

	// Helper to convert array of tuples to object

	// Add effect to update the parent component's state when local headers change
	useEffect(() => {
		const timer = setTimeout(() => {
			const headerObject = convertHeadersToObject(customHeaders)
			setApiConfigurationField("openAiHeaders", headerObject)
		}, 300)

		return () => clearTimeout(timer)
	}, [customHeaders, setApiConfigurationField])

	useEffect(() => {
		// Set the default value only when useZgsmCustomConfig is first enabled and includeMaxTokens has never been set before.
		// Use ref to track whether includeMaxTokens has been explicitly set by the user, avoiding overriding the user's explicit selection.
		if (
			useZgsmCustomConfig &&
			!includeMaxTokensInitializedRef.current &&
			apiConfiguration?.includeMaxTokens === undefined
		) {
			setApiConfigurationField("includeMaxTokens", true)
			includeMaxTokensInitializedRef.current = true
		}
	}, [useZgsmCustomConfig, apiConfiguration?.includeMaxTokens, setApiConfigurationField])

	// Marked as initialized when the user manually modifies includeMaxTokens.
	useEffect(() => {
		if (Object.hasOwn(apiConfiguration, "includeMaxTokens")) {
			includeMaxTokensInitializedRef.current = true
		}
	}, [apiConfiguration])

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				const val = transform(event as E)
				if (field === "zgsmBaseUrl" && isValidUrl(val as string)) {
					setApiConfigurationField(field, (val as string).trim().replace(/\/$/, ""))
				} else {
					setApiConfigurationField(field, val)
				}
			},
		[setApiConfigurationField],
	)

	const onMessage = useCallback((event: MessageEvent) => {
		const message: ExtensionMessage = event.data

		switch (message.type) {
			case "zgsmModels": {
				const { fullResponseData = [] } = message
				setOpenAiModels(
					Object.fromEntries(fullResponseData.map((item) => [item.id, { ...(item ?? zgsmModels.default) }])),
				)
				break
			}
		}
	}, [])

	useEvent("message", onMessage)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.zgsmBaseUrl?.trim() || ""}
				type="url"
				onInput={handleInputChange("zgsmBaseUrl")}
				placeholder={t("settings:providers.zgsmDefaultBaseUrl", { zgsmBaseUrl: "https://zgsm.sangfor.com" })}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.zgsmBaseUrl")}</label>
			</VSCodeTextField>
			{!fromWelcomeView && (
				<>
					<VSCodeLink
						className={`forced-color-adjust-none ${apiConfiguration.zgsmAccessToken ? "hidden" : ""}`}
						href="#"
						onClick={(e) => {
							e.preventDefault()

							window.postMessage({
								type: "action",
								action: "cloudButtonClicked",
							})
						}}>
						{t("account:loginForFullFeatures")}
					</VSCodeLink>
					<ModelPicker
						apiConfiguration={apiConfiguration}
						setApiConfigurationField={setApiConfigurationField}
						defaultModelId={zgsmDefaultModelId}
						models={openAiModels}
						modelIdKey="zgsmModelId"
						serviceName="zgsm"
						serviceUrl={apiConfiguration.zgsmBaseUrl?.trim() || ""}
						organizationAllowList={organizationAllowList}
						errorMessage={modelValidationError}
					/>
					<Button
						variant="outline"
						disabled={refetchingModels}
						onClick={() => {
							vscode.postMessage({ type: "flushRouterModels", text: "zgsm" })
							setRefetchingModels(true)
							refetchRouterModels?.()
							delay(() => {
								setRefetchingModels(false)
							}, 1000)
						}}>
						<div className="flex items-center gap-2">
							<span className={cn("codicon codicon-refresh", refetchingModels ? "animate-spin" : "")} />
							{t("settings:providers.refreshModels.label")}
						</div>
					</Button>
					<div>
						<VSCodeCheckbox
							checked={useZgsmCustomConfig}
							onChange={(e: any) => {
								setCachedStateField("useZgsmCustomConfig", e.target.checked)
							}}>
							<label className="block font-medium mb-1">
								{t("settings:providers.useZgsmCustomConfig")}
							</label>
						</VSCodeCheckbox>
					</div>
				</>
			)}
			{!fromWelcomeView && useZgsmCustomConfig && (
				<>
					<R1FormatSetting
						onChange={handleInputChange("openAiR1FormatEnabled", noTransform)}
						openAiR1FormatEnabled={apiConfiguration?.openAiR1FormatEnabled ?? false}
					/>
					<div>
						<Checkbox
							checked={openAiLegacyFormatSelected}
							onChange={(checked: boolean) => {
								setOpenAiLegacyFormatSelected(checked)
								setApiConfigurationField("openAiLegacyFormat", checked)
							}}>
							{t("settings:providers.useLegacyFormat")}
						</Checkbox>
					</div>
					<Checkbox
						checked={apiConfiguration?.openAiStreamingEnabled ?? true}
						onChange={handleInputChange("openAiStreamingEnabled", noTransform)}>
						{t("settings:modelInfo.enableStreaming")}
					</Checkbox>
					<div>
						<Checkbox
							checked={apiConfiguration?.includeMaxTokens ?? true}
							onChange={(checked: boolean) => {
								setApiConfigurationField("includeMaxTokens", checked)
							}}>
							{t("settings:includeMaxOutputTokens")}
						</Checkbox>
						<div className="text-sm text-vscode-descriptionForeground ml-6">
							{t("settings:includeMaxOutputTokensDescription")}
						</div>
					</div>
					<Checkbox
						checked={apiConfiguration?.openAiUseAzure ?? false}
						onChange={handleInputChange("openAiUseAzure", noTransform)}>
						{t("settings:modelInfo.useAzure")}
					</Checkbox>
					<div>
						<Checkbox
							checked={azureApiVersionSelected}
							onChange={(checked: boolean) => {
								setAzureApiVersionSelected(checked)

								if (!checked) {
									setApiConfigurationField("azureApiVersion", "")
								}
							}}>
							{t("settings:modelInfo.azureApiVersion")}
						</Checkbox>
						{azureApiVersionSelected && (
							<VSCodeTextField
								value={apiConfiguration?.azureApiVersion || ""}
								onInput={handleInputChange("azureApiVersion")}
								placeholder={`Default: ${azureOpenAiDefaultApiVersion}`}
								className="w-full mt-1"
							/>
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

					<div className="flex flex-col gap-1">
						<Checkbox
							checked={apiConfiguration.enableReasoningEffort ?? false}
							onChange={(checked: boolean) => {
								setApiConfigurationField("enableReasoningEffort", checked)

								if (!checked) {
									const { reasoningEffort: _, ...zgsmAiCustomModelInfo } =
										apiConfiguration.zgsmAiCustomModelInfo || zgsmModels.default

									setApiConfigurationField("zgsmAiCustomModelInfo", zgsmAiCustomModelInfo)
								}
							}}>
							{t("settings:providers.setReasoningLevel")}
						</Checkbox>
						{!!apiConfiguration.enableReasoningEffort && (
							<ThinkingBudget
								apiConfiguration={{
									...apiConfiguration,
									reasoningEffort: apiConfiguration.zgsmAiCustomModelInfo?.reasoningEffort,
								}}
								setApiConfigurationField={(field, value) => {
									if (field === "reasoningEffort") {
										const zgsmAiCustomModelInfo =
											apiConfiguration.zgsmAiCustomModelInfo || zgsmModels.default

										setApiConfigurationField("zgsmAiCustomModelInfo", {
											...zgsmAiCustomModelInfo,
											reasoningEffort: value as ReasoningEffort,
										})
									}
								}}
								modelInfo={{
									...(apiConfiguration.zgsmAiCustomModelInfo || zgsmModels.default),
									supportsReasoningEffort: true,
								}}
							/>
						)}
					</div>
					<div className="flex flex-col gap-3">
						<div className="text-sm text-vscode-descriptionForeground whitespace-pre-line">
							{t("settings:providers.customModel.capabilities")}
						</div>

						<div>
							<VSCodeTextField
								value={
									apiConfiguration?.zgsmAiCustomModelInfo?.maxTokens?.toString() ||
									zgsmModels.default.maxTokens?.toString() ||
									""
								}
								type="text"
								style={{
									borderColor: (() => {
										const value = apiConfiguration?.zgsmAiCustomModelInfo?.maxTokens

										if (!value) {
											return "var(--vscode-input-border)"
										}

										return value > 0
											? "var(--vscode-charts-green)"
											: "var(--vscode-errorForeground)"
									})(),
								}}
								onInput={handleInputChange("zgsmAiCustomModelInfo", (e) => {
									const value = parseInt((e.target as HTMLInputElement).value)

									return {
										...(apiConfiguration?.zgsmAiCustomModelInfo || zgsmModels.default),
										maxTokens: isNaN(value) ? undefined : value,
									}
								})}
								placeholder={t("settings:placeholders.numbers.maxTokens")}
								className="w-full">
								<label className="block font-medium mb-1">
									{t("settings:providers.customModel.maxTokens.label")}
								</label>
							</VSCodeTextField>
							<div className="text-sm text-vscode-descriptionForeground">
								{t("settings:providers.customModel.maxTokens.description")}
							</div>
						</div>

						<div>
							<VSCodeTextField
								value={
									apiConfiguration?.zgsmAiCustomModelInfo?.contextWindow?.toString() ||
									zgsmModels.default.contextWindow?.toString() ||
									""
								}
								type="text"
								style={{
									borderColor: (() => {
										const value = apiConfiguration?.zgsmAiCustomModelInfo?.contextWindow

										if (!value) {
											return "var(--vscode-input-border)"
										}

										return value > 0
											? "var(--vscode-charts-green)"
											: "var(--vscode-errorForeground)"
									})(),
								}}
								onInput={handleInputChange("zgsmAiCustomModelInfo", (e) => {
									const value = (e.target as HTMLInputElement).value
									const parsed = parseInt(value)

									return {
										...(apiConfiguration?.zgsmAiCustomModelInfo || zgsmModels.default),
										contextWindow: isNaN(parsed) ? zgsmModels.default.contextWindow : parsed,
									}
								})}
								placeholder={t("settings:placeholders.numbers.contextWindow")}
								className="w-full">
								<label className="block font-medium mb-1">
									{t("settings:providers.customModel.contextWindow.label")}
								</label>
							</VSCodeTextField>
							<div className="text-sm text-vscode-descriptionForeground">
								{t("settings:providers.customModel.contextWindow.description")}
							</div>
						</div>

						<div>
							<div className="flex items-center gap-1">
								<Checkbox
									checked={
										apiConfiguration?.zgsmAiCustomModelInfo?.supportsImages ??
										zgsmModels.default.supportsImages
									}
									onChange={handleInputChange("zgsmAiCustomModelInfo", (checked) => {
										return {
											...(apiConfiguration?.zgsmAiCustomModelInfo || zgsmModels.default),
											supportsImages: checked,
										}
									})}>
									<span className="font-medium">
										{t("settings:providers.customModel.imageSupport.label")}
									</span>
								</Checkbox>
								<StandardTooltip content={t("settings:providers.customModel.imageSupport.description")}>
									<i
										className="codicon codicon-info text-vscode-descriptionForeground"
										style={{ fontSize: "12px" }}
									/>
								</StandardTooltip>
							</div>
							<div className="text-sm text-vscode-descriptionForeground pt-1">
								{t("settings:providers.customModel.imageSupport.description")}
							</div>
						</div>

						<div>
							<div className="flex items-center gap-1">
								<Checkbox
									checked={apiConfiguration?.zgsmAiCustomModelInfo?.supportsPromptCache ?? false}
									onChange={handleInputChange("zgsmAiCustomModelInfo", (checked) => {
										return {
											...(apiConfiguration?.zgsmAiCustomModelInfo || zgsmModels.default),
											supportsPromptCache: checked,
										}
									})}>
									<span className="font-medium">
										{t("settings:providers.customModel.promptCache.label")}
									</span>
								</Checkbox>
								<StandardTooltip content={t("settings:providers.customModel.promptCache.description")}>
									<i
										className="codicon codicon-info text-vscode-descriptionForeground"
										style={{ fontSize: "12px" }}
									/>
								</StandardTooltip>
							</div>
							<div className="text-sm text-vscode-descriptionForeground pt-1">
								{t("settings:providers.customModel.promptCache.description")}
							</div>
						</div>

						<div>
							<VSCodeTextField
								value={
									apiConfiguration?.zgsmAiCustomModelInfo?.inputPrice?.toString() ??
									zgsmModels.default.inputPrice?.toString() ??
									""
								}
								type="text"
								style={{
									borderColor: (() => {
										const value = apiConfiguration?.zgsmAiCustomModelInfo?.inputPrice

										if (!value && value !== 0) {
											return "var(--vscode-input-border)"
										}

										return value >= 0
											? "var(--vscode-charts-green)"
											: "var(--vscode-errorForeground)"
									})(),
								}}
								onChange={handleInputChange("zgsmAiCustomModelInfo", (e) => {
									const value = (e.target as HTMLInputElement).value
									const parsed = parseFloat(value)

									return {
										...(apiConfiguration?.zgsmAiCustomModelInfo ?? zgsmModels.default),
										inputPrice: isNaN(parsed) ? zgsmModels.default.inputPrice : parsed,
									}
								})}
								placeholder={t("settings:placeholders.numbers.inputPrice")}
								className="w-full">
								<div className="flex items-center gap-1">
									<label className="block font-medium mb-1">
										{t("settings:providers.customModel.pricing.input.label")}
									</label>
									<StandardTooltip
										content={t("settings:providers.customModel.pricing.input.description")}>
										<i
											className="codicon codicon-info text-vscode-descriptionForeground"
											style={{ fontSize: "12px" }}
										/>
									</StandardTooltip>
								</div>
							</VSCodeTextField>
						</div>

						<div>
							<VSCodeTextField
								value={
									apiConfiguration?.zgsmAiCustomModelInfo?.outputPrice?.toString() ||
									zgsmModels.default.outputPrice?.toString() ||
									""
								}
								type="text"
								style={{
									borderColor: (() => {
										const value = apiConfiguration?.zgsmAiCustomModelInfo?.outputPrice

										if (!value && value !== 0) {
											return "var(--vscode-input-border)"
										}

										return value >= 0
											? "var(--vscode-charts-green)"
											: "var(--vscode-errorForeground)"
									})(),
								}}
								onChange={handleInputChange("zgsmAiCustomModelInfo", (e) => {
									const value = (e.target as HTMLInputElement).value
									const parsed = parseFloat(value)

									return {
										...(apiConfiguration?.zgsmAiCustomModelInfo || zgsmModels.default),
										outputPrice: isNaN(parsed) ? zgsmModels.default.outputPrice : parsed,
									}
								})}
								placeholder={t("settings:placeholders.numbers.outputPrice")}
								className="w-full">
								<div className="flex items-center gap-1">
									<label className="block font-medium mb-1">
										{t("settings:providers.customModel.pricing.output.label")}
									</label>
									<StandardTooltip
										content={t("settings:providers.customModel.pricing.output.description")}>
										<i
											className="codicon codicon-info text-vscode-descriptionForeground"
											style={{ fontSize: "12px" }}
										/>
									</StandardTooltip>
								</div>
							</VSCodeTextField>
						</div>

						{apiConfiguration?.zgsmAiCustomModelInfo?.supportsPromptCache && (
							<>
								<div>
									<VSCodeTextField
										value={
											apiConfiguration?.zgsmAiCustomModelInfo?.cacheReadsPrice?.toString() ?? "0"
										}
										type="text"
										style={{
											borderColor: (() => {
												const value = apiConfiguration?.zgsmAiCustomModelInfo?.cacheReadsPrice

												if (!value && value !== 0) {
													return "var(--vscode-input-border)"
												}

												return value >= 0
													? "var(--vscode-charts-green)"
													: "var(--vscode-errorForeground)"
											})(),
										}}
										onChange={handleInputChange("zgsmAiCustomModelInfo", (e) => {
											const value = (e.target as HTMLInputElement).value
											const parsed = parseFloat(value)

											return {
												...(apiConfiguration?.zgsmAiCustomModelInfo ?? zgsmModels.default),
												cacheReadsPrice: isNaN(parsed) ? 0 : parsed,
											}
										})}
										placeholder={t("settings:placeholders.numbers.inputPrice")}
										className="w-full">
										<div className="flex items-center gap-1">
											<span className="font-medium">
												{t("settings:providers.customModel.pricing.cacheReads.label")}
											</span>
											<StandardTooltip
												content={t(
													"settings:providers.customModel.pricing.cacheReads.description",
												)}>
												<i
													className="codicon codicon-info text-vscode-descriptionForeground"
													style={{ fontSize: "12px" }}
												/>
											</StandardTooltip>
										</div>
									</VSCodeTextField>
								</div>
								<div>
									<VSCodeTextField
										value={
											apiConfiguration?.zgsmAiCustomModelInfo?.cacheWritesPrice?.toString() ?? "0"
										}
										type="text"
										style={{
											borderColor: (() => {
												const value = apiConfiguration?.zgsmAiCustomModelInfo?.cacheWritesPrice

												if (!value && value !== 0) {
													return "var(--vscode-input-border)"
												}

												return value >= 0
													? "var(--vscode-charts-green)"
													: "var(--vscode-errorForeground)"
											})(),
										}}
										onChange={handleInputChange("zgsmAiCustomModelInfo", (e) => {
											const value = (e.target as HTMLInputElement).value
											const parsed = parseFloat(value)

											return {
												...(apiConfiguration?.zgsmAiCustomModelInfo ?? zgsmModels.default),
												cacheWritesPrice: isNaN(parsed) ? 0 : parsed,
											}
										})}
										placeholder={t("settings:placeholders.numbers.cacheWritePrice")}
										className="w-full">
										<div className="flex items-center gap-1">
											<label className="block font-medium mb-1">
												{t("settings:providers.customModel.pricing.cacheWrites.label")}
											</label>
											<StandardTooltip
												content={t(
													"settings:providers.customModel.pricing.cacheWrites.description",
												)}>
												<i
													className="codicon codicon-info text-vscode-descriptionForeground"
													style={{ fontSize: "12px" }}
												/>
											</StandardTooltip>
										</div>
									</VSCodeTextField>
								</div>
							</>
						)}

						<Button
							variant="secondary"
							onClick={() => setApiConfigurationField("zgsmAiCustomModelInfo", zgsmModels.default)}>
							{t("settings:providers.customModel.resetDefaults")}
						</Button>
					</div>
				</>
			)}
		</>
	)
}
