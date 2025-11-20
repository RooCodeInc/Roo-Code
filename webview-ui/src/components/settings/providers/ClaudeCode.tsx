import React, { useState } from "react"
import { VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { type ProviderSettings } from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Slider } from "@src/components/ui"

interface ClaudeCodeProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	vscode?: any
}

export const ClaudeCode: React.FC<ClaudeCodeProps> = ({ apiConfiguration, setApiConfigurationField, vscode }) => {
	const { t } = useAppTranslation()
	const [isAuthenticating, setIsAuthenticating] = useState(false)

	const handleInputChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const element = e.target as HTMLInputElement
		setApiConfigurationField("claudeCodePath", element.value)
	}

	const handleGetApiKey = () => {
		setIsAuthenticating(true)
		// Open Claude's website to get API key
		vscode?.postMessage({
			type: "openExternal",
			url: "https://console.anthropic.com/settings/keys",
		})
		// Show instructions
		vscode?.postMessage({
			type: "showInformationMessage",
			text: "Please create an API key on the Anthropic Console and paste it in the field above",
		})
		setIsAuthenticating(false)
	}

	const maxOutputTokens = apiConfiguration?.claudeCodeMaxOutputTokens || 8000
	const hasPath = !!apiConfiguration?.claudeCodePath

	return (
		<div className="flex flex-col gap-4">
			<div>
				<div className="flex gap-2 items-end mb-2">
					<VSCodeTextField
						value={apiConfiguration?.claudeCodePath || ""}
						style={{ width: "100%", marginTop: 3 }}
						type="password"
						onInput={handleInputChange}
						placeholder={hasPath ? "••••••••••••••••" : t("settings:providers.claudeCode.placeholder")}>
						{t("settings:providers.claudeCode.pathLabel")}
					</VSCodeTextField>
					<VSCodeButton onClick={handleGetApiKey} disabled={isAuthenticating} appearance="secondary">
						{hasPath
							? t("settings:providers.claudeCode.updateKey")
							: t("settings:providers.claudeCode.getApiKey")}
					</VSCodeButton>
				</div>

				<p
					style={{
						fontSize: "12px",
						marginTop: 3,
						color: "var(--vscode-descriptionForeground)",
					}}>
					{t("settings:providers.claudeCode.description")}
				</p>

				{hasPath && (
					<p
						style={{
							fontSize: "12px",
							marginTop: 3,
							color: "var(--vscode-notificationsInfoIcon-foreground)",
						}}>
						✓ {t("settings:providers.claudeCode.authenticated")}
					</p>
				)}
			</div>

			<div className="flex flex-col gap-1">
				<div className="font-medium">{t("settings:providers.claudeCode.maxTokensLabel")}</div>
				<div className="flex items-center gap-1">
					<Slider
						min={8000}
						max={64000}
						step={1024}
						value={[maxOutputTokens]}
						onValueChange={([value]) => setApiConfigurationField("claudeCodeMaxOutputTokens", value)}
					/>
					<div className="w-16 text-sm text-center">{maxOutputTokens}</div>
				</div>
				<p className="text-sm text-vscode-descriptionForeground mt-1">
					{t("settings:providers.claudeCode.maxTokensDescription")}
				</p>
			</div>
		</div>
	)
}
