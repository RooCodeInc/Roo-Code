import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useEvent } from "react-use"
import { Trans } from "react-i18next"
import {
	VSCodeTextField,
	VSCodeRadioGroup,
	VSCodeRadio,
	VSCodeCheckbox,
	VSCodeLink,
} from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings, ExtensionMessage, ModelRecord } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useRouterModels } from "@src/components/ui/hooks/useRouterModels"
import { vscode } from "@src/utils/vscode"
import { Button } from "@src/components/ui/button"

import { inputEventTransform } from "../transforms"

type OllamaProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Ollama = ({ apiConfiguration, setApiConfigurationField }: OllamaProps) => {
	const { t } = useAppTranslation()

	const [ollamaModels, setOllamaModels] = useState<ModelRecord>({})
	const [modelsWithTools, setModelsWithTools] = useState<
		Array<{
			name: string
			contextWindow: number
			size?: number
			quantizationLevel?: string
			family?: string
			supportsImages: boolean
			modelInfo: any
		}>
	>([])
	const [modelsWithoutTools, setModelsWithoutTools] = useState<string[]>([])
	const [testingConnection, setTestingConnection] = useState(false)
	const [testResult, setTestResult] = useState<{ success: boolean; message: string; durationMs?: number } | null>(
		null,
	)
	const [refreshingModels, setRefreshingModels] = useState(false)
	const [refreshResult, setRefreshResult] = useState<{
		success: boolean
		message: string
		durationMs?: number
	} | null>(null)
	const [showAdvanced, setShowAdvanced] = useState(false)

	const routerModels = useRouterModels()

	const testResultTimerRef = useRef<NodeJS.Timeout>()
	const refreshResultTimerRef = useRef<NodeJS.Timeout>()

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

	const onMessage = useCallback((event: MessageEvent) => {
		const message: ExtensionMessage = event.data

		switch (message.type) {
			case "ollamaModels":
				{
					const newModels = message.ollamaModels ?? {}
					setOllamaModels(newModels)
					if (message.ollamaModelsWithTools) {
						setModelsWithTools(message.ollamaModelsWithTools)
					}
					setModelsWithoutTools(message.modelsWithoutTools ?? [])
				}
				break
			case "ollamaConnectionTestResult":
				setTestResult({
					success: message.success ?? false,
					message: message.message ?? "Unknown error",
					durationMs: message.durationMs,
				})
				setTestingConnection(false)
				if (testResultTimerRef.current) {
					clearTimeout(testResultTimerRef.current)
				}
				testResultTimerRef.current = setTimeout(() => setTestResult(null), 5000)
				break
			case "ollamaModelsRefreshResult":
				setRefreshResult({
					success: message.success ?? false,
					message: message.message ?? "Unknown error",
					durationMs: message.durationMs,
				})
				setRefreshingModels(false)
				if (message.ollamaModelsWithTools) {
					setModelsWithTools(message.ollamaModelsWithTools)
				}
				if (message.modelsWithoutTools) {
					setModelsWithoutTools(message.modelsWithoutTools)
				}
				if (refreshResultTimerRef.current) {
					clearTimeout(refreshResultTimerRef.current)
				}
				refreshResultTimerRef.current = setTimeout(() => setRefreshResult(null), 5000)
				break
		}
	}, [])

	const handleTestConnection = useCallback(() => {
		setTestingConnection(true)
		setTestResult(null)
		vscode.postMessage({
			type: "testOllamaConnection",
			ollamaBaseUrl: apiConfiguration?.ollamaBaseUrl || "",
			ollamaApiKey: apiConfiguration?.ollamaApiKey || "",
		})
	}, [apiConfiguration?.ollamaBaseUrl, apiConfiguration?.ollamaApiKey])

	const handleRefreshModels = useCallback(() => {
		setRefreshingModels(true)
		setRefreshResult(null)
		vscode.postMessage({
			type: "refreshOllamaModels",
			ollamaBaseUrl: apiConfiguration?.ollamaBaseUrl || "",
			ollamaApiKey: apiConfiguration?.ollamaApiKey || "",
		})
	}, [apiConfiguration?.ollamaBaseUrl, apiConfiguration?.ollamaApiKey])

	useEffect(() => {
		return () => {
			if (testResultTimerRef.current) {
				clearTimeout(testResultTimerRef.current)
			}
			if (refreshResultTimerRef.current) {
				clearTimeout(refreshResultTimerRef.current)
			}
		}
	}, [])

	useEvent("message", onMessage)

	// Refresh models on mount
	useEffect(() => {
		// Request fresh models - the handler now flushes cache automatically
		vscode.postMessage({ type: "requestOllamaModels" })
	}, [])

	// Check if the selected model exists in the fetched models
	const modelNotAvailable = useMemo(() => {
		const selectedModel = apiConfiguration?.ollamaModelId
		if (!selectedModel) return false

		// Check if model exists in local ollama models
		if (Object.keys(ollamaModels).length > 0 && selectedModel in ollamaModels) {
			return false // Model is available locally
		}

		// If we have router models data for Ollama
		if (routerModels.data?.ollama) {
			const availableModels = Object.keys(routerModels.data.ollama)
			// Show warning if model is not in the list (regardless of how many models there are)
			return !availableModels.includes(selectedModel)
		}

		// If neither source has loaded yet, don't show warning
		return false
	}, [apiConfiguration?.ollamaModelId, routerModels.data, ollamaModels])

	// Sort models with tools by name for consistent ordering
	const sortedModelsWithTools = useMemo(() => {
		return [...modelsWithTools].sort((a, b) => a.name.localeCompare(b.name))
	}, [modelsWithTools])

	return (
		<>
			<div className="flex items-center gap-2">
				<VSCodeTextField
					value={apiConfiguration?.ollamaBaseUrl || ""}
					type="url"
					onInput={handleInputChange("ollamaBaseUrl")}
					placeholder={t("settings:defaults.ollamaUrl")}
					className="flex-1">
					<label className="block font-medium mb-1">{t("settings:providers.ollama.baseUrl")}</label>
				</VSCodeTextField>
				<Button onClick={handleTestConnection} disabled={testingConnection} variant="outline" className="mt-6">
					{testingConnection ? t("settings:providers.ollama.testing") : t("settings:providers.ollama.test")}
				</Button>
			</div>
			{testResult && (
				<div
					className={`p-2 rounded-xs text-sm ${
						testResult.success ? "bg-green-800/20 text-green-400" : "bg-red-800/20 text-red-400"
					}`}>
					<div>{testResult.message}</div>
					{testResult.durationMs !== undefined && (
						<div className="text-xs mt-1 opacity-80">Completed in {testResult.durationMs}ms</div>
					)}
				</div>
			)}
			{apiConfiguration?.ollamaBaseUrl && (
				<VSCodeTextField
					value={apiConfiguration?.ollamaApiKey || ""}
					type="password"
					onInput={handleInputChange("ollamaApiKey")}
					placeholder={t("settings:placeholders.apiKey")}
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.ollama.apiKey")}</label>
					<div className="text-xs text-vscode-descriptionForeground mt-1">
						{t("settings:providers.ollama.apiKeyHelp")}
					</div>
				</VSCodeTextField>
			)}
			<div className="flex items-center gap-2">
				<VSCodeTextField
					value={apiConfiguration?.ollamaModelId || ""}
					onInput={handleInputChange("ollamaModelId")}
					placeholder={t("settings:placeholders.modelId.ollama")}
					className="flex-1">
					<label className="block font-medium mb-1">{t("settings:providers.ollama.modelId")}</label>
				</VSCodeTextField>
				<Button onClick={handleRefreshModels} disabled={refreshingModels} variant="outline" className="mt-6">
					{refreshingModels
						? t("settings:providers.ollama.refreshing")
						: t("settings:providers.ollama.refreshModels")}
				</Button>
			</div>
			{refreshResult && (
				<div
					className={`p-2 rounded-xs text-sm ${
						refreshResult.success ? "bg-green-800/20 text-green-400" : "bg-red-800/20 text-red-400"
					}`}>
					<div>{refreshResult.message}</div>
					{refreshResult.durationMs !== undefined && (
						<div className="text-xs mt-1 opacity-80">Completed in {refreshResult.durationMs}ms</div>
					)}
				</div>
			)}
			{modelNotAvailable && (
				<div className="flex flex-col gap-2 text-vscode-errorForeground text-sm">
					<div className="flex flex-row items-center gap-1">
						<div className="codicon codicon-close" />
						<div>
							{t("settings:validation.modelAvailability", { modelId: apiConfiguration?.ollamaModelId })}
						</div>
					</div>
				</div>
			)}
			{/* Tools Support Section */}
			{modelsWithTools.length > 0 && (
				<div className="flex flex-col gap-2 mt-4">
					<div className="text-sm font-medium text-vscode-foreground">
						{t("settings:providers.ollama.toolsSupport")} ({modelsWithTools.length}{" "}
						{t("settings:providers.ollama.models", { count: modelsWithTools.length })})
					</div>
					<VSCodeRadioGroup
						value={apiConfiguration?.ollamaModelId || ""}
						onChange={(e: Event | React.FormEvent<HTMLElement>) => {
							const target = ((e as CustomEvent)?.detail?.target ||
								(e.target as HTMLInputElement)) as HTMLInputElement
							if (target?.value) {
								setApiConfigurationField("ollamaModelId", target.value)
							}
						}}>
						<div className="overflow-x-auto">
							<table className="w-full border-collapse text-sm">
								<thead>
									<tr className="border-b border-vscode-foreground/10">
										<th className="text-left py-2 px-3 font-medium text-vscode-foreground">
											Model Name
										</th>
										<th className="text-left py-2 px-3 font-medium text-vscode-foreground">
											Context
										</th>
										<th className="text-left py-2 px-3 font-medium text-vscode-foreground">Size</th>
										<th className="text-left py-2 px-3 font-medium text-vscode-foreground">
											Quantization
										</th>
										<th className="text-left py-2 px-3 font-medium text-vscode-foreground">
											Family
										</th>
										<th className="text-left py-2 px-3 font-medium text-vscode-foreground">
											Images
										</th>
									</tr>
								</thead>
								<tbody>
									{sortedModelsWithTools.map((model) => {
										const formatSize = (bytes?: number): string => {
											if (!bytes) return "-"
											const gb = bytes / (1024 * 1024 * 1024)
											if (gb >= 1) {
												return `${gb.toFixed(1)} GB`
											}
											const mb = bytes / (1024 * 1024)
											return `${mb.toFixed(1)} MB`
										}
										return (
											<tr
												key={model.name}
												className="border-b border-vscode-foreground/5 hover:bg-vscode-foreground/5">
												<td className="py-2 px-3">
													<VSCodeRadio
														value={model.name}
														checked={apiConfiguration?.ollamaModelId === model.name}>
														{model.name}
													</VSCodeRadio>
												</td>
												<td className="py-2 px-3 text-vscode-descriptionForeground">
													{model.contextWindow.toLocaleString()}
												</td>
												<td className="py-2 px-3 text-vscode-descriptionForeground">
													{formatSize(model.size)}
												</td>
												<td className="py-2 px-3 text-vscode-descriptionForeground">
													{model.quantizationLevel || "-"}
												</td>
												<td className="py-2 px-3 text-vscode-descriptionForeground">
													{model.family || "-"}
												</td>
												<td className="py-2 px-3 text-vscode-descriptionForeground">
													{model.supportsImages ? "Yes" : "No"}
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</div>
					</VSCodeRadioGroup>
				</div>
			)}
			{/* No Tools Support Section */}
			{modelsWithoutTools.length > 0 && (
				<div className="flex flex-col gap-2 mt-4">
					<div className="text-sm font-medium text-vscode-descriptionForeground">
						{t("settings:providers.ollama.noToolsSupport")} ({modelsWithoutTools.length}{" "}
						{t("settings:providers.ollama.models", { count: modelsWithoutTools.length })})
					</div>
					<div className="text-xs text-vscode-descriptionForeground mb-2">
						{t("settings:providers.ollama.noToolsSupportHelp")}
					</div>
					<div className="flex flex-col gap-1 pl-4">
						{modelsWithoutTools.map((model) => (
							<div
								key={model}
								className="text-sm text-vscode-descriptionForeground flex items-center gap-2">
								<span className="codicon codicon-circle-small" />
								<span>{model}</span>
							</div>
						))}
					</div>
				</div>
			)}
			<VSCodeTextField
				value={apiConfiguration?.ollamaNumCtx?.toString() || ""}
				onInput={(e: any) => {
					const value = e.target?.value
					if (value === "") {
						setApiConfigurationField("ollamaNumCtx", undefined)
					} else {
						const numValue = parseInt(value, 10)
						if (!isNaN(numValue) && numValue >= 128) {
							setApiConfigurationField("ollamaNumCtx", numValue)
						}
					}
				}}
				placeholder="e.g., 4096"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.ollama.numCtx")}</label>
				<div className="text-xs text-vscode-descriptionForeground mt-1">
					{t("settings:providers.ollama.numCtxHelp")}
				</div>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground mt-4">
				<Trans
					i18nKey="settings:providers.ollama.description"
					components={{
						quickstartLink: <VSCodeLink href="https://docs.ollama.com/quickstart" />,
					}}
				/>
			</div>
			<div className="text-sm text-vscode-descriptionForeground">
				<span className="text-vscode-errorForeground">{t("settings:providers.ollama.warning")}</span>
			</div>
			<button
				onClick={() => setShowAdvanced(!showAdvanced)}
				className="flex items-center gap-2 text-vscode-foreground hover:text-vscode-foreground/80 mt-4">
				<span className={`codicon ${showAdvanced ? "codicon-chevron-down" : "codicon-chevron-right"}`} />
				{t("settings:providers.ollama.connectionSettings")}
			</button>
			{showAdvanced && (
				<div className="flex flex-col gap-3 pl-4 border-l-2 border-vscode-foreground/10 mt-2">
					<VSCodeCheckbox checked={true} disabled={true}>
						<label className="block font-medium mb-1">{t("settings:providers.ollama.streaming")}</label>
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							{t("settings:providers.ollama.streamingHelp")}
						</div>
					</VSCodeCheckbox>

					<VSCodeTextField
						value={apiConfiguration?.ollamaRequestTimeout?.toString() || "3600000"}
						onInput={(e: any) => {
							const value = e.target?.value
							if (value === "") {
								setApiConfigurationField("ollamaRequestTimeout", undefined)
							} else {
								const numValue = parseInt(value, 10)
								if (!isNaN(numValue) && numValue >= 1000 && numValue <= 7200000) {
									setApiConfigurationField("ollamaRequestTimeout", numValue)
								}
							}
						}}
						className="w-full">
						<label className="block font-medium mb-1">
							{t("settings:providers.ollama.requestTimeout")}
						</label>
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							{t("settings:providers.ollama.requestTimeoutHelp")}
						</div>
					</VSCodeTextField>

					<VSCodeTextField
						value={apiConfiguration?.ollamaModelDiscoveryTimeout?.toString() || "10000"}
						onInput={(e: any) => {
							const value = e.target?.value
							if (value === "") {
								setApiConfigurationField("ollamaModelDiscoveryTimeout", undefined)
							} else {
								const numValue = parseInt(value, 10)
								if (!isNaN(numValue) && numValue >= 1000 && numValue <= 600000) {
									setApiConfigurationField("ollamaModelDiscoveryTimeout", numValue)
								}
							}
						}}
						className="w-full">
						<label className="block font-medium mb-1">
							{t("settings:providers.ollama.modelDiscoveryTimeout")}
						</label>
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							{t("settings:providers.ollama.modelDiscoveryTimeoutHelp")}
						</div>
					</VSCodeTextField>

					<VSCodeTextField
						value={apiConfiguration?.ollamaMaxRetries?.toString() || "0"}
						onInput={(e: any) => {
							const value = e.target?.value
							if (value === "") {
								setApiConfigurationField("ollamaMaxRetries", undefined)
							} else {
								const numValue = parseInt(value, 10)
								if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
									setApiConfigurationField("ollamaMaxRetries", numValue)
								}
							}
						}}
						className="w-full">
						<label className="block font-medium mb-1">{t("settings:providers.ollama.maxRetries")}</label>
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							{t("settings:providers.ollama.maxRetriesHelp")}
						</div>
					</VSCodeTextField>

					<VSCodeTextField
						value={apiConfiguration?.ollamaRetryDelay?.toString() || "1000"}
						onInput={(e: any) => {
							const value = e.target?.value
							if (value === "") {
								setApiConfigurationField("ollamaRetryDelay", undefined)
							} else {
								const numValue = parseInt(value, 10)
								if (!isNaN(numValue) && numValue >= 100 && numValue <= 10000) {
									setApiConfigurationField("ollamaRetryDelay", numValue)
								}
							}
						}}
						className="w-full">
						<label className="block font-medium mb-1">{t("settings:providers.ollama.retryDelay")}</label>
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							{t("settings:providers.ollama.retryDelayHelp")}
						</div>
					</VSCodeTextField>

					<VSCodeCheckbox
						checked={apiConfiguration?.ollamaEnableLogging ?? false}
						onChange={(e: any) => {
							setApiConfigurationField("ollamaEnableLogging", e.target.checked)
						}}>
						<label className="block font-medium mb-1">{t("settings:providers.ollama.enableLogging")}</label>
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							{t("settings:providers.ollama.enableLoggingHelp")}
						</div>
					</VSCodeCheckbox>
				</div>
			)}
		</>
	)
}
