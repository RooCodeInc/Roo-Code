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
	openAiCodexAuthenticatedEmail?: string
	profileId?: string
}

export const OpenAICodex: React.FC<OpenAICodexProps> = ({
	apiConfiguration,
	setApiConfigurationField,
	simplifySettings,
	openAiCodexIsAuthenticated = false,
	openAiCodexAuthenticatedEmail,
	profileId,
}) => {
	const { t } = useAppTranslation()

	return (
		<div className="flex flex-col gap-4">
			{/* Authentication Section */}
			<div className="flex flex-col gap-2">
				{openAiCodexIsAuthenticated ? (
					<div className="flex flex-col gap-2">
						{openAiCodexAuthenticatedEmail && (
							<p className="text-sm text-vscode-descriptionForeground">
								{t("settings:providers.openAiCodex.signedInAs", {
									defaultValue: "Signed in as {{email}}",
									email: openAiCodexAuthenticatedEmail,
								})}
							</p>
						)}
						<div className="flex justify-end">
							<Button
								variant="secondary"
								size="sm"
								onClick={() => vscode.postMessage({ type: "openAiCodexSignOut", profileId })}>
								{t("settings:providers.openAiCodex.signOutButton", {
									defaultValue: "Sign Out",
								})}
							</Button>
						</div>
					</div>
				) : (
					<Button
						variant="primary"
						onClick={() => vscode.postMessage({ type: "openAiCodexSignIn", profileId })}
						className="w-fit">
						{t("settings:providers.openAiCodex.signInButton", {
							defaultValue: "Sign in to OpenAI Codex",
						})}
					</Button>
				)}
			</div>

			{/* Rate Limit Dashboard - only shown when authenticated */}
			<OpenAICodexRateLimitDashboard isAuthenticated={openAiCodexIsAuthenticated} profileId={profileId} />

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
