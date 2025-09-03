import React, { useState, useEffect } from "react"
import { VSCodeButton, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"

interface McpRecommendation {
	serverName: string
	config: any
	confidence: number
	reason: string
	dependencies: Array<{
		name: string
		type: string
		version?: string
	}>
}

interface McpRecommendationsProps {
	onApply?: () => void
}

const McpRecommendations: React.FC<McpRecommendationsProps> = ({ onApply }) => {
	const { t } = useAppTranslation()
	const [recommendations, setRecommendations] = useState<McpRecommendation[]>([])
	const [selectedRecommendations, setSelectedRecommendations] = useState<Set<string>>(new Set())
	const [isLoading, setIsLoading] = useState(false)
	const [showRecommendations, setShowRecommendations] = useState(false)

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "recommendedMcpConfigs") {
				setRecommendations(message.recommendations || [])
				// Auto-select high confidence recommendations
				const autoSelected = new Set<string>()
				message.recommendations?.forEach((rec: McpRecommendation) => {
					if (rec.confidence >= 85) {
						autoSelected.add(rec.serverName)
					}
				})
				setSelectedRecommendations(autoSelected)
				setIsLoading(false)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleAnalyze = () => {
		setIsLoading(true)
		setShowRecommendations(true)
		vscode.postMessage({ type: "getRecommendedMcpConfigs" })
	}

	const handleApplyRecommendations = () => {
		const selectedRecs = recommendations.filter((rec) => selectedRecommendations.has(rec.serverName))
		vscode.postMessage({
			type: "applyRecommendedMcpConfigs",
			recommendations: selectedRecs,
			target: "project",
		})
		onApply?.()
		setShowRecommendations(false)
	}

	const toggleRecommendation = (serverName: string) => {
		const newSelected = new Set(selectedRecommendations)
		if (newSelected.has(serverName)) {
			newSelected.delete(serverName)
		} else {
			newSelected.add(serverName)
		}
		setSelectedRecommendations(newSelected)
	}

	const getConfidenceColor = (confidence: number) => {
		if (confidence >= 90) return "var(--vscode-testing-iconPassed)"
		if (confidence >= 70) return "var(--vscode-editorWarning-foreground)"
		return "var(--vscode-editorError-foreground)"
	}

	const getConfidenceLabel = (confidence: number) => {
		if (confidence >= 90) return t("mcp:recommendations.confidence.high")
		if (confidence >= 70) return t("mcp:recommendations.confidence.medium")
		return t("mcp:recommendations.confidence.low")
	}

	return (
		<div style={{ marginBottom: "20px" }}>
			{!showRecommendations ? (
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<VSCodeButton onClick={handleAnalyze} disabled={isLoading}>
						<span className="codicon codicon-lightbulb" style={{ marginRight: "6px" }}></span>
						{t("mcp:recommendations.analyze")}
					</VSCodeButton>
					<span style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
						{t("mcp:recommendations.analyzeDescription")}
					</span>
				</div>
			) : (
				<div
					style={{
						border: "1px solid var(--vscode-panel-border)",
						borderRadius: "4px",
						padding: "12px",
						marginTop: "10px",
					}}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "12px",
						}}>
						<h4 style={{ margin: 0 }}>{t("mcp:recommendations.title")}</h4>
						<VSCodeButton appearance="icon" onClick={() => setShowRecommendations(false)}>
							<span className="codicon codicon-close"></span>
						</VSCodeButton>
					</div>

					{isLoading ? (
						<div style={{ textAlign: "center", padding: "20px" }}>
							<span className="codicon codicon-loading codicon-modifier-spin"></span>
							<p>{t("mcp:recommendations.analyzing")}</p>
						</div>
					) : recommendations.length === 0 ? (
						<p style={{ color: "var(--vscode-descriptionForeground)" }}>
							{t("mcp:recommendations.noRecommendations")}
						</p>
					) : (
						<>
							<div style={{ marginBottom: "12px" }}>
								{recommendations.map((rec) => (
									<div
										key={rec.serverName}
										style={{
											padding: "8px",
											marginBottom: "8px",
											border: "1px solid var(--vscode-panel-border)",
											borderRadius: "4px",
											backgroundColor: selectedRecommendations.has(rec.serverName)
												? "var(--vscode-list-activeSelectionBackground)"
												: "transparent",
										}}>
										<div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
											<VSCodeCheckbox
												checked={selectedRecommendations.has(rec.serverName)}
												onChange={() => toggleRecommendation(rec.serverName)}>
												<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
													<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
														<strong>{rec.serverName}</strong>
														<span
															style={{
																fontSize: "11px",
																padding: "2px 6px",
																borderRadius: "3px",
																backgroundColor: getConfidenceColor(rec.confidence),
																color: "var(--vscode-editor-background)",
															}}>
															{rec.confidence}% {getConfidenceLabel(rec.confidence)}
														</span>
													</div>
													<span
														style={{
															fontSize: "12px",
															color: "var(--vscode-descriptionForeground)",
														}}>
														{rec.reason}
													</span>
													{rec.dependencies.length > 0 && (
														<div
															style={{
																fontSize: "11px",
																color: "var(--vscode-descriptionForeground)",
															}}>
															{t("mcp:recommendations.dependencies")}:{" "}
															{rec.dependencies.map((dep) => dep.name).join(", ")}
														</div>
													)}
												</div>
											</VSCodeCheckbox>
										</div>
									</div>
								))}
							</div>

							<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
								<VSCodeButton appearance="secondary" onClick={() => setShowRecommendations(false)}>
									{t("mcp:recommendations.cancel")}
								</VSCodeButton>
								<VSCodeButton
									onClick={handleApplyRecommendations}
									disabled={selectedRecommendations.size === 0}>
									{t("mcp:recommendations.apply", { count: selectedRecommendations.size })}
								</VSCodeButton>
							</div>
						</>
					)}
				</div>
			)}
		</div>
	)
}

export default McpRecommendations
