import React, { useState, useEffect, useCallback } from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { RefreshCw, Loader2 } from "lucide-react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { Button } from "@/components/ui"
import type { SerializedCustomToolDefinition } from "@roo-code/types"

interface CustomToolsSettingsProps {
	enabled: boolean
	onChange: (enabled: boolean) => void
}

export const CustomToolsSettings = ({ enabled, onChange }: CustomToolsSettingsProps) => {
	const { t } = useAppTranslation()
	const [tools, setTools] = useState<SerializedCustomToolDefinition[]>([])
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [refreshError, setRefreshError] = useState<string | null>(null)
	const [hasRequested, setHasRequested] = useState(false)

	// Request tools list when enabled
	useEffect(() => {
		if (enabled && !hasRequested) {
			vscode.postMessage({ type: "requestCustomTools" })
			setHasRequested(true)
		}
	}, [enabled, hasRequested])

	// Reset request flag when disabled
	useEffect(() => {
		if (!enabled) {
			setHasRequested(false)
			setTools([])
		}
	}, [enabled])

	// Handle messages from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "customToolsResult") {
				setTools(message.tools || [])
				setIsRefreshing(false)
				if (message.error) {
					setRefreshError(message.error)
				} else {
					setRefreshError(null)
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true)
		setRefreshError(null)
		vscode.postMessage({ type: "refreshCustomTools" })
	}, [])

	return (
		<div className="space-y-4">
			<div>
				<div className="flex items-center gap-2">
					<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
						<span className="font-medium">{t("settings:experimental.CUSTOM_TOOLS.name")}</span>
					</VSCodeCheckbox>
				</div>
				<p className="text-vscode-descriptionForeground text-sm mt-0">
					{t("settings:experimental.CUSTOM_TOOLS.description")}
				</p>
			</div>

			{enabled && (
				<div className="ml-2 space-y-3">
					{/* Header with refresh button */}
					<div className="flex items-center justify-between gap-4">
						<label className="block font-medium">
							{t("settings:experimental.CUSTOM_TOOLS.toolsHeader")}
						</label>
						<Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
							<div className="flex items-center gap-2">
								{isRefreshing ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									<RefreshCw className="w-4 h-4" />
								)}
								{isRefreshing
									? t("settings:experimental.CUSTOM_TOOLS.refreshing")
									: t("settings:experimental.CUSTOM_TOOLS.refreshButton")}
							</div>
						</Button>
					</div>

					{/* Error message */}
					{refreshError && (
						<div className="p-2 bg-vscode-inputValidation-errorBackground text-vscode-errorForeground rounded text-sm border border-vscode-inputValidation-errorBorder">
							{t("settings:experimental.CUSTOM_TOOLS.refreshError")}: {refreshError}
						</div>
					)}

					{/* Tools list */}
					{tools.length === 0 ? (
						<p className="text-vscode-descriptionForeground text-sm italic">
							{t("settings:experimental.CUSTOM_TOOLS.noTools")}
						</p>
					) : (
						<div className="space-y-2">
							{tools.map((tool) => {
								// Parse JSON Schema parameters for friendly display
								const params = tool.parameters
								const properties = params?.properties as
									| Record<string, { type?: string; description?: string }>
									| undefined
								const required = (params?.required as string[] | undefined) || []
								const hasProperties = properties && Object.keys(properties).length > 0

								return (
									<div
										key={tool.name}
										className="p-3 bg-vscode-editor-background border border-vscode-panel-border rounded">
										<div className="font-medium text-vscode-foreground">{tool.name}</div>
										<p className="text-vscode-descriptionForeground text-sm mt-1">
											{tool.description}
										</p>
										{hasProperties && (
											<div className="mt-3">
												<div className="text-xs font-medium text-vscode-foreground mb-2">
													{t("settings:experimental.CUSTOM_TOOLS.toolParameters")}:
												</div>
												<div className="space-y-1">
													{Object.entries(properties).map(([paramName, paramDef]) => (
														<div
															key={paramName}
															className="flex items-start gap-2 text-xs pl-2 py-1 border-l-2 border-vscode-panel-border">
															<code className="text-vscode-textLink-foreground font-mono">
																{paramName}
															</code>
															<span className="text-vscode-descriptionForeground">
																({paramDef.type || "any"})
															</span>
															{required.includes(paramName) && (
																<span className="text-vscode-errorForeground text-[10px] uppercase">
																	required
																</span>
															)}
															{paramDef.description && (
																<span className="text-vscode-descriptionForeground">
																	— {paramDef.description}
																</span>
															)}
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								)
							})}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
