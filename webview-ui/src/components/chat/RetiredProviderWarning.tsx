import React from "react"

import { isRetiredProvider } from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"

export const RetiredProviderWarning: React.FC = () => {
	const { apiConfiguration } = useExtensionState()

	const provider = apiConfiguration?.apiProvider
	if (!provider || !isRetiredProvider(provider)) {
		return null
	}

	return (
		<div className="flex flex-col gap-1.5 px-4 py-3 mb-2 text-sm rounded border border-vscode-inputValidation-warningBorder bg-vscode-inputValidation-warningBackground text-vscode-foreground">
			<div className="flex items-center gap-2 font-bold">
				<span className="codicon codicon-warning text-vscode-editorWarning-foreground" />
				<span>Provider No Longer Supported</span>
			</div>
			<p className="m-0 leading-relaxed">
				Sorry, this provider is no longer supported. We saw very few Roo users actually using it and we need to
				reduce the surface area of our codebase so we can keep shipping fast and serving our community well in
				this space. It was a really hard decision but it lets us focus on what matters most to you. It sucks, we
				know.
			</p>
			<p className="m-0 leading-relaxed font-medium">
				Please select a different provider in your API profile settings.
			</p>
		</div>
	)
}

export default RetiredProviderWarning
