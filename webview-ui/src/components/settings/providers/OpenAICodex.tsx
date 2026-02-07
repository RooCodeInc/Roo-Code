import React from "react"

import { type ProviderSettings, openAiCodexDefaultModelId, openAiCodexModels } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"
import { vscode } from "@src/utils/vscode"

import { ModelPicker } from "../ModelPicker"
import { OpenAICodexRateLimitDashboard } from "./OpenAICodexRateLimitDashboard"

interface OpenAICodexProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
	openAiCodexIsAuthenticated?: boolean
	openAiCodexAccountEmail?: string | null
	currentApiConfigName?: string
}

export const OpenAICodex: React.FC<OpenAICodexProps> = ({
	apiConfiguration,
	setApiConfigurationField,
	simplifySettings,
	openAiCodexIsAuthenticated = false,
	openAiCodexAccountEmail,
	currentApiConfigName,
}) => {
	const { t } = useAppTranslation()

	return (
		<div className="flex flex-col gap-4">
			{/* Authentication Section */}
			<div className="flex flex-col gap-2">
				{openAiCodexIsAuthenticated ? (
					<div className="flex flex-col gap-2">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex flex-col gap-1">
								<div className="text-sm font-medium text-vscode-foreground">
									{t("settings:providers.openAiCodex.connectedLabel", {
										defaultValue: "Connected",
									})}
								</div>
								{openAiCodexAccountEmail ? (
									<div className="text-sm text-vscode-descriptionForeground">
										{openAiCodexAccountEmail}
									</div>
								) : null}
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="secondary"
									size="sm"
									onClick={() => vscode.postMessage({ type: "openAiCodexSignIn" })}>
									{t("settings:providers.openAiCodex.reauthButton", {
										defaultValue: "Reconnect account",
									})}
								</Button>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => vscode.postMessage({ type: "openAiCodexSignOut" })}>
									{t("settings:providers.openAiCodex.signOutButton", {
										defaultValue: "Sign Out",
									})}
								</Button>
							</div>
						</div>
					</div>
				) : (
					<Button
						variant="primary"
						onClick={() => vscode.postMessage({ type: "openAiCodexSignIn" })}
						className="w-fit">
						{t("settings:providers.openAiCodex.signInButton", {
							defaultValue: "Sign in to OpenAI Codex",
						})}
					</Button>
				)}
			</div>

			{/* Rate Limit Dashboard - only shown when authenticated */}
			<OpenAICodexRateLimitDashboard
				isAuthenticated={openAiCodexIsAuthenticated}
				currentApiConfigName={currentApiConfigName}
			/>

			{/* Model Picker */}
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={openAiCodexDefaultModelId}
				models={openAiCodexModels}
				modelIdKey="apiModelId"
				serviceName="OpenAI - ChatGPT Plus/Pro"
				serviceUrl="https://chatgpt.com"
				simplifySettings={simplifySettings}
				hidePricing
			/>
		</div>
	)
}
