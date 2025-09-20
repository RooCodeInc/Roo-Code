import React, { useEffect, useMemo, useState } from "react"
import { VSCodeButton, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@src/utils/vscode"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { Badge, StandardTooltip } from "@src/components/ui"

import {
	type ProviderSettings,
	type CodexCliModelInfo,
	fallbackCodexCliModels,
	normalizeCodexModelId,
	getCodexPreset,
} from "@roo-code/types"

type CodexProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	modelValidationError?: string
}

type CodexCliStatusTone = "success" | "error"

type CodexCliStatusState = {
	message: string
	summary: string
	tone: CodexCliStatusTone
}

const STATUS_COLORS: Record<CodexCliStatusTone, string> = {
	success: "var(--vscode-testing-iconPassed, #3fb950)",
	error: "var(--vscode-testing-iconFailed, #f85149)",
}

export const Codex: React.FC<CodexProps> = ({ apiConfiguration, setApiConfigurationField, modelValidationError }) => {
	const [codexCliStatus, setCodexCliStatus] = useState<CodexCliStatusState | null>(null)
	const [cliModels, setCliModels] = useState<CodexCliModelInfo[]>([])
	const fallbackById = useMemo(
		() => new Map(fallbackCodexCliModels.map((preset) => [normalizeCodexModelId(preset.id), preset])),
		[],
	)

	// Request models on mount
	useEffect(() => {
		vscode.postMessage({ type: "requestCodexModels" })
	}, [])

	// Listen for Codex-specific events
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message: any = event.data
			if (message?.type === "codexModels") {
				const list: CodexCliModelInfo[] = (message.models ?? [])
					.map((item: any) => {
						const rawId = typeof item === "string" ? item : item?.id || item?.name || item?.model || ""
						const id = normalizeCodexModelId(rawId)
						const fallback = fallbackById.get(id)
						const preset = getCodexPreset(id)
						return {
							id,
							label:
								typeof item === "string"
									? fallback?.label || preset?.label || id
									: item?.label || item?.name || fallback?.label || preset?.label || id,
							description:
								typeof item === "string"
									? fallback?.description || preset?.description
									: item?.description || fallback?.description || preset?.description,
							model:
								typeof item === "string"
									? fallback?.model || preset?.cliModel
									: item?.model || fallback?.model || preset?.cliModel,
							effort:
								typeof item === "string"
									? fallback?.effort || preset?.effort
									: item?.effort || fallback?.effort || preset?.effort,
						}
					})
					.filter((item: CodexCliModelInfo) => !!item.id && item.id !== "codex-mini-latest")
				setCliModels(list)
			}
			if (message?.type === "codexCliLoginStatus") {
				const { status, source, path, error, cliPath, auth } = message.payload || {}
				const detected = status === "ok"
				const resolvedPath = cliPath || path
				const segments: string[] = []

				segments.push(detected ? "Detected cli" : "CLI not detected")
				if (source) {
					segments.push(`(Logged in using ${source})`)
				}
				if (resolvedPath) {
					segments.push(`CLI: ${resolvedPath}`)
				}
				if (detected) {
					segments.push(auth ? "Logged in" : "Not logged in")
				} else if (error) {
					segments.push(error)
				}

				const messageText = segments.filter(Boolean).join(" • ")
				const tone: CodexCliStatusTone = detected && auth === true ? "success" : "error"
				const summary = detected ? (auth === true ? "CLI ready" : "CLI needs login") : "CLI not detected"
				setCodexCliStatus({
					message: messageText || error || "CLI status unavailable",
					summary,
					tone,
				})

				// After checking CLI/login, refresh models
				vscode.postMessage({ type: "requestCodexModels" })
			}
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [fallbackById])

	const models = useMemo<CodexCliModelInfo[]>(() => {
		if (cliModels.length > 0) {
			return cliModels
		}
		return fallbackCodexCliModels
	}, [cliModels])

	const selectedModel = apiConfiguration.apiModelId || models[0]?.id || fallbackCodexCliModels[0].id
	const activeModel = models.find((model) => model.id === selectedModel)

	useEffect(() => {
		if (!models.length) return
		if (!apiConfiguration.apiModelId || !models.some((model) => model.id === apiConfiguration.apiModelId)) {
			setApiConfigurationField("apiModelId", models[0].id)
		}
	}, [apiConfiguration.apiModelId, models, setApiConfigurationField])

	return (
		<div className="flex flex-col gap-3">
			<div className="text-sm text-vscode-descriptionForeground">
				Codex uses your local Codex CLI login automatically. Leave Base URL and API Key blank.
			</div>

			<div className="flex items-center gap-2">
				<VSCodeButtonLink href="https://github.com/openai/codex/tree/main/codex-cli" appearance="secondary">
					Install Codex CLI
				</VSCodeButtonLink>
				<VSCodeButton appearance="secondary" onClick={() => vscode.postMessage({ type: "codexCheckCliLogin" })}>
					Check Codex CLI
				</VSCodeButton>
				<VSCodeButton appearance="secondary" onClick={() => vscode.postMessage({ type: "codexRunCliLogin" })}>
					Run &quot;codex login&quot;
				</VSCodeButton>
				{codexCliStatus && (
					<StandardTooltip content={codexCliStatus.message}>
						<Badge
							variant="outline"
							className="text-xs font-medium"
							style={{
								backgroundColor: `color-mix(in srgb, ${STATUS_COLORS[codexCliStatus.tone]} 30%, transparent)`,
								borderColor: `color-mix(in srgb, ${STATUS_COLORS[codexCliStatus.tone]} 45%, transparent)`,
								color: "var(--vscode-editor-foreground)",
							}}>
							{codexCliStatus.summary}
						</Badge>
					</StandardTooltip>
				)}
			</div>

			<div>
				<label className="block font-medium mb-1">Model</label>
				<VSCodeDropdown
					value={selectedModel}
					onChange={(event) => {
						const value = (event.target as HTMLSelectElement).value
						setApiConfigurationField("apiModelId", value)
					}}>
					{models.map((model) => (
						<VSCodeOption key={model.id} value={model.id} title={model.description || model.id}>
							{model.label || model.id}
						</VSCodeOption>
					))}
				</VSCodeDropdown>
				{modelValidationError && (
					<div className="text-sm text-[var(--vscode-errorForeground)] mt-1">{modelValidationError}</div>
				)}
			</div>
			{activeModel?.description && (
				<div className="text-sm text-vscode-descriptionForeground">{activeModel.description}</div>
			)}
		</div>
	)
}
