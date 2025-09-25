import React from "react"
import { VSCodeTextField, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { type ProviderSettings } from "@roo-code/types"

interface OpenAiNativeCodexProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const OpenAiNativeCodex: React.FC<OpenAiNativeCodexProps> = ({ apiConfiguration, setApiConfigurationField }) => {
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
					OAuth Credentials Path
				</VSCodeTextField>

				<p className="text-xs mt-1 text-vscode-descriptionForeground">
					Path to your ChatGPT Codex auth.json credentials. Defaults to ~/.codex/auth.json if left empty
					(Windows: C:\\Users\\USERNAME\\.codex\\auth.json).
				</p>

				<div className="text-xs text-vscode-descriptionForeground mt-3">
					ChatGPT Codex uses your ChatGPT web credentials via the official Codex CLI. Authenticate with the
					Codex CLI so that auth.json is created. If you use a custom location, set the full file path here.
				</div>

				<div className="text-xs text-vscode-descriptionForeground mt-2">
					After authentication, Roo will read the access token from auth.json and connect to ChatGPT Responses
					(Codex).
				</div>

				<VSCodeLink
					href="https://chatgpt.com"
					className="text-vscode-textLink-foreground mt-2 inline-block text-xs">
					Learn more about ChatGPT
				</VSCodeLink>
			</div>
		</div>
	)
}
