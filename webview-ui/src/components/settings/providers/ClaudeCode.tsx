import React, { useState, useEffect, useCallback } from "react"
import { type ProviderSettings, claudeCodeDefaultModelId, claudeCodeModels } from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button, VSCodeTextField } from "@src/components/ui"
import { vscode } from "@src/utils/vscode"
import { ModelPicker } from "../ModelPicker"
import { ClaudeCodeRateLimitDashboard } from "./ClaudeCodeRateLimitDashboard"

interface ClaudeCodeProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
	claudeCodeIsAuthenticated?: boolean
}

export const ClaudeCode: React.FC<ClaudeCodeProps> = ({
	apiConfiguration,
	setApiConfigurationField,
	simplifySettings,
	claudeCodeIsAuthenticated = false,
}) => {
	const { t } = useAppTranslation()
	const [showManualAuth, setShowManualAuth] = useState(false)
	const [manualCode, setManualCode] = useState("")
	const [oobFlowStarted, setOobFlowStarted] = useState(false)
	const [isExchanging, setIsExchanging] = useState(false)
	const [exchangeError, setExchangeError] = useState<string | null>(null)

	// Handle messages from extension
	const handleMessage = useCallback((event: MessageEvent) => {
		const message = event.data
		if (message.type === "claudeCodeOobFlowStarted") {
			if (message.success) {
				setOobFlowStarted(true)
				setExchangeError(null)
			} else {
				setExchangeError(message.error || "Failed to start authentication")
			}
		} else if (message.type === "claudeCodeManualCodeResult") {
			setIsExchanging(false)
			if (message.success) {
				// Reset state on success
				setShowManualAuth(false)
				setManualCode("")
				setOobFlowStarted(false)
				setExchangeError(null)
			} else {
				setExchangeError(message.error || "Failed to exchange code")
			}
		}
	}, [])

	useEffect(() => {
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [handleMessage])

	const handleStartOobFlow = () => {
		setExchangeError(null)
		vscode.postMessage({ type: "claudeCodeStartOobFlow" })
	}

	const handleExchangeCode = () => {
		if (!manualCode.trim()) {
			setExchangeError("Please enter the authorization code")
			return
		}
		setIsExchanging(true)
		setExchangeError(null)
		vscode.postMessage({ type: "claudeCodeExchangeManualCode", text: manualCode.trim() })
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Authentication Section */}
			<div className="flex flex-col gap-2">
				{claudeCodeIsAuthenticated ? (
					<div className="flex justify-end">
						<Button
							variant="secondary"
							size="sm"
							onClick={() => vscode.postMessage({ type: "claudeCodeSignOut" })}>
							{t("settings:providers.claudeCode.signOutButton", {
								defaultValue: "Sign Out",
							})}
						</Button>
					</div>
				) : showManualAuth ? (
					<div className="flex flex-col gap-3">
						<div className="text-sm text-vscode-descriptionForeground">
							{t("settings:providers.claudeCode.manualAuthDescription", {
								defaultValue:
									"For remote environments (GitHub Codespaces, SSH, etc.) where localhost callbacks don't work:",
							})}
						</div>

						{!oobFlowStarted ? (
							<>
								<Button variant="primary" onClick={handleStartOobFlow} className="w-fit">
									{t("settings:providers.claudeCode.openAuthPage", {
										defaultValue: "1. Open Authentication Page",
									})}
								</Button>
								<div className="text-xs text-vscode-descriptionForeground">
									{t("settings:providers.claudeCode.manualAuthStep1", {
										defaultValue:
											"This will open Anthropic's sign-in page. After signing in, you'll see an authorization code.",
									})}
								</div>
							</>
						) : (
							<>
								<div className="flex flex-col gap-2">
									<label className="text-sm font-medium">
										{t("settings:providers.claudeCode.pasteCodeLabel", {
											defaultValue: "2. Paste the authorization code:",
										})}
									</label>
									<VSCodeTextField
										value={manualCode}
										onInput={(e: any) => setManualCode(e.target.value)}
										placeholder={t("settings:providers.claudeCode.codePlaceholder", {
											defaultValue: "Paste your authorization code here",
										})}
										className="w-full"
									/>
								</div>
								<Button
									variant="primary"
									onClick={handleExchangeCode}
									disabled={isExchanging || !manualCode.trim()}
									className="w-fit">
									{isExchanging
										? t("settings:providers.claudeCode.exchangingCode", {
												defaultValue: "Signing in...",
											})
										: t("settings:providers.claudeCode.submitCode", {
												defaultValue: "3. Complete Sign In",
											})}
								</Button>
							</>
						)}

						{exchangeError && <div className="text-sm text-vscode-errorForeground">{exchangeError}</div>}

						<Button
							variant="secondary"
							size="sm"
							onClick={() => {
								setShowManualAuth(false)
								setOobFlowStarted(false)
								setManualCode("")
								setExchangeError(null)
							}}
							className="w-fit">
							{t("settings:providers.claudeCode.backToNormalAuth", {
								defaultValue: "← Back to normal sign in",
							})}
						</Button>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						<Button
							variant="primary"
							onClick={() => vscode.postMessage({ type: "claudeCodeSignIn" })}
							className="w-fit">
							{t("settings:providers.claudeCode.signInButton", {
								defaultValue: "Sign in to Claude Code",
							})}
						</Button>
						<button
							onClick={() => setShowManualAuth(true)}
							className="text-xs text-vscode-textLink-foreground hover:underline cursor-pointer text-left w-fit">
							{t("settings:providers.claudeCode.remoteEnvLink", {
								defaultValue: "Using a remote environment? Click here for manual sign in",
							})}
						</button>
					</div>
				)}
			</div>

			{/* Rate Limit Dashboard - only shown when authenticated */}
			<ClaudeCodeRateLimitDashboard isAuthenticated={claudeCodeIsAuthenticated} />

			{/* Model Picker */}
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={claudeCodeDefaultModelId}
				models={claudeCodeModels}
				modelIdKey="apiModelId"
				serviceName="Claude Code"
				serviceUrl="https://claude.ai"
				simplifySettings={simplifySettings}
				hidePricing
			/>
		</div>
	)
}
