import React from "react"
import { VSCodeTextField, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { ExternalLinkIcon } from "@radix-ui/react-icons"

import { type ProviderSettings } from "@roo-code/types"

interface ClaudeCodeAcpProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const ClaudeCodeAcp: React.FC<ClaudeCodeAcpProps> = ({ apiConfiguration, setApiConfigurationField }) => {
	const handleExecutablePathChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const element = e.target as HTMLInputElement
		setApiConfigurationField("claudeCodeAcpExecutablePath", element.value)
	}

	const handleWorkingDirectoryChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const element = e.target as HTMLInputElement
		setApiConfigurationField("claudeCodeAcpWorkingDirectory", element.value)
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="bg-vscode-textBlockQuote-background border border-vscode-textBlockQuote-border p-3 rounded">
				<p className="text-xs text-vscode-descriptionForeground">
					Claude Code (ACP) uses the Agent Client Protocol to communicate with Claude Code. Authentication is
					handled by the Claude Code CLI - make sure you&apos;re logged in.
				</p>
			</div>

			<div>
				<VSCodeTextField
					value={apiConfiguration?.claudeCodeAcpExecutablePath || ""}
					className="w-full mt-1"
					type="text"
					onInput={handleExecutablePathChange}
					placeholder="npx (default)">
					Executable Path (Optional)
				</VSCodeTextField>

				<p className="text-xs mt-1 text-vscode-descriptionForeground">
					Path to a custom claude-code-acp executable. Leave empty to use npx (recommended).
				</p>
			</div>

			<div>
				<VSCodeTextField
					value={apiConfiguration?.claudeCodeAcpWorkingDirectory || ""}
					className="w-full mt-1"
					type="text"
					onInput={handleWorkingDirectoryChange}
					placeholder="(current workspace)">
					Working Directory (Optional)
				</VSCodeTextField>

				<p className="text-xs mt-1 text-vscode-descriptionForeground">
					Working directory for Claude Code sessions. Leave empty to use the current workspace.
				</p>
			</div>

			<div className="border-t border-vscode-panel-border pt-3 mt-2">
				<p className="text-xs text-vscode-descriptionForeground font-medium mb-2">Authentication</p>
				<div className="text-xs text-vscode-descriptionForeground space-y-1">
					<p>Claude Code ACP uses your existing Claude Code CLI authentication. To set up:</p>
					<ol className="list-decimal list-inside space-y-1 mt-2">
						<li>
							Install Claude Code CLI:{" "}
							<code className="bg-vscode-textCodeBlock-background px-1 rounded">
								curl -fsSL https://claude.ai/install.sh | bash
							</code>
						</li>
						<li>
							Run <code className="bg-vscode-textCodeBlock-background px-1 rounded">claude</code> and
							follow the login prompts
						</li>
						<li>Select Claude Code (ACP) as your provider in Roo Code</li>
					</ol>
				</div>

				<div className="flex gap-3 mt-3">
					<VSCodeLink
						href="https://code.claude.com/docs/en/overview"
						className="text-xs inline-flex items-center gap-1">
						Claude Code Docs
						<ExternalLinkIcon className="w-3 h-3" />
					</VSCodeLink>
					<VSCodeLink
						href="https://agentclientprotocol.com/"
						className="text-xs inline-flex items-center gap-1">
						ACP Protocol
						<ExternalLinkIcon className="w-3 h-3" />
					</VSCodeLink>
				</div>
			</div>

			<div className="bg-vscode-inputValidation-infoBackground border border-vscode-inputValidation-infoBorder p-3 rounded text-xs">
				<p className="font-medium mb-1">Supported Authentication Methods:</p>
				<ul className="list-disc list-inside text-vscode-descriptionForeground">
					<li>Claude.ai login (Pro, Max, Teams, Enterprise)</li>
					<li>Anthropic API key</li>
					<li>Amazon Bedrock</li>
					<li>Google Vertex AI</li>
					<li>Microsoft Azure</li>
				</ul>
			</div>
		</div>
	)
}
