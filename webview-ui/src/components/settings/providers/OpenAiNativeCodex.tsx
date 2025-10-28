import React from "react"
import { VSCodeTextField, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { type ProviderSettings } from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"

interface OpenAiNativeCodexProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const OpenAiNativeCodex: React.FC<OpenAiNativeCodexProps> = ({ apiConfiguration, setApiConfigurationField }) => {
	const { t } = useAppTranslation()
	const defaultPath = "~/.codex/auth.json"

	const handleInputChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const element = e.target as HTMLInputElement
		setApiConfigurationField("openAiNativeCodexOauthPath", element.value)
	}

	return (
		<div className="flex flex-col gap-4">
			<div>
				<VSCodeTextField
					value={apiConfiguration?.openAiNativeCodexOauthPath || ""}
					className="w-full mt-1"
					type="text"
					onInput={handleInputChange}
					placeholder={defaultPath}>
					<label className="block font-medium mb-1">
						{t("settings:providers.openAiNativeCodex.oauthPathLabel")}
					</label>
				</VSCodeTextField>

				<p className="text-xs mt-1 text-vscode-descriptionForeground">
					{t("settings:providers.openAiNativeCodex.oauthPathDescription", { defaultPath })}
				</p>

				<div className="text-xs text-vscode-descriptionForeground mt-3">
					{t("settings:providers.openAiNativeCodex.oauthCliDescription")}
				</div>

				<div className="text-xs text-vscode-descriptionForeground mt-2">
					{t("settings:providers.openAiNativeCodex.oauthConnectDescription")}
				</div>

				<VSCodeLink
					href="https://chatgpt.com"
					className="text-vscode-textLink-foreground mt-2 inline-block text-xs">
					{t("settings:providers.openAiNativeCodex.learnMoreLinkText")}
				</VSCodeLink>
			</div>
		</div>
	)
}
