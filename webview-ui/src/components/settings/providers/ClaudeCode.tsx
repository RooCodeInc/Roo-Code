import React, { useState, useEffect } from "react"
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
	const [manualAuthCode, setManualAuthCode] = useState("")
	const [isManualAuthPending, setIsManualAuthPending] = useState(false)

	// Listen for manual auth started message
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "claudeCodeManualAuthStarted") {
				setIsManualAuthPending(true)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleStartManualAuth = () => {
		setShowManualAuth(true)
		setManualAuthCode("")
		vscode.postMessage({ type: "claudeCodeStartManualAuth" })
	}

	const handleSubmitManualCode = () => {
		if (manualAuthCode.trim()) {
			vscode.postMessage({ type: "claudeCodeSubmitManualCode", text: manualAuthCode.trim() })
			setManualAuthCode("")
			setShowManualAuth(false)
			setIsManualAuthPending(false)
		}
	}

	const handleCancelManualAuth = () => {
		setShowManualAuth(false)
		setManualAuthCode("")
		setIsManualAuthPending(false)
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
							{isManualAuthPending ? (
								<>
									{t("settings:providers.claudeCode.manualAuthInstructions", {
										defaultValue:
											"A browser window has opened. After authorizing, copy the code from the page and paste it below:",
									})}
								</>
							) : (
								<>
									{t("settings:providers.claudeCode.manualAuthClickStart", {
										defaultValue:
											"Click 'Start Manual Sign In' to open the authorization page in your browser.",
									})}
								</>
							)}
						</div>
						{!isManualAuthPending && (
							<Button variant="primary" onClick={handleStartManualAuth} className="w-fit">
								{t("settings:providers.claudeCode.startManualSignIn", {
									defaultValue: "Start Manual Sign In",
								})}
							</Button>
						)}
						{isManualAuthPending && (
							<>
								<VSCodeTextField
									value={manualAuthCode}
									onInput={(e: React.ChangeEvent<HTMLInputElement>) =>
										setManualAuthCode(e.target.value)
									}
									placeholder={t("settings:providers.claudeCode.authCodePlaceholder", {
										defaultValue: "Paste authorization code here",
									})}
								/>
								<div className="flex gap-2">
									<Button
										variant="primary"
										onClick={handleSubmitManualCode}
										disabled={!manualAuthCode.trim()}>
										{t("settings:providers.claudeCode.submitCode", {
											defaultValue: "Submit Code",
										})}
									</Button>
									<Button variant="secondary" onClick={handleCancelManualAuth}>
										{t("common:actions.cancel", {
											defaultValue: "Cancel",
										})}
									</Button>
								</div>
							</>
						)}
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
							type="button"
							onClick={() => setShowManualAuth(true)}
							className="text-xs text-vscode-textLink-foreground hover:underline cursor-pointer w-fit bg-transparent border-none p-0">
							{t("settings:providers.claudeCode.useManualSignIn", {
								defaultValue: "Using a remote environment? Sign in manually",
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
