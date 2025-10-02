import React, { useEffect, useState } from "react"
import { VSCodeButton, VSCodeDivider, VSCodeRadio, VSCodeRadioGroup } from "@vscode/webview-ui-toolkit/react"
import { Database } from "lucide-react"

import { vscode } from "@src/utils/vscode"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

interface Provider {
	id: string
	name: string
	description: string
	enabled: boolean
	priority: number
}

export const CondensationProviderSettings: React.FC = () => {
	const [providers, setProviders] = useState<Provider[]>([])
	const [defaultProviderId, setDefaultProviderId] = useState<string>("")

	useEffect(() => {
		// Request initial data
		vscode.postMessage({ type: "getCondensationProviders" })

		// Listen for updates
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "condensationProviders") {
				setProviders(message.providers || [])
				setDefaultProviderId(message.defaultProviderId || "")
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleDefaultProviderChange = (providerId: string) => {
		vscode.postMessage({
			type: "setDefaultCondensationProvider",
			providerId,
		})
	}

	const handleToggleEnabled = (providerId: string, currentEnabled: boolean) => {
		vscode.postMessage({
			type: "updateCondensationProviderConfig",
			providerId,
			enabled: !currentEnabled,
		})
	}

	return (
		<div>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Database className="w-4" />
					<div>Context Condensation Providers</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="condensation-provider-settings">
					<p className="text-sm text-vscode-descriptionForeground mb-4">
						Choose how the AI summarizes conversation history when context grows too large. The Native
						provider uses the Anthropic API to generate intelligent summaries.
					</p>

					<VSCodeDivider />

					{providers.length > 0 ? (
						<div className="mt-4">
							<h4 className="mb-3 font-medium">Default Provider</h4>
							<VSCodeRadioGroup value={defaultProviderId}>
								{providers.map((provider) => (
									<div key={provider.id} className="mb-3">
										<VSCodeRadio
											value={provider.id}
											disabled={!provider.enabled}
											onChange={() => handleDefaultProviderChange(provider.id)}
											checked={defaultProviderId === provider.id}>
											<div className="flex items-center justify-between w-full">
												<div className="flex-1">
													<div className="font-medium">{provider.name}</div>
													<div className="text-xs text-vscode-descriptionForeground mt-1">
														{provider.description}
													</div>
												</div>
												<VSCodeButton
													appearance="secondary"
													onClick={(e) => {
														e.stopPropagation()
														handleToggleEnabled(provider.id, provider.enabled)
													}}
													className="ml-4">
													{provider.enabled ? "Enabled" : "Disabled"}
												</VSCodeButton>
											</div>
										</VSCodeRadio>
									</div>
								))}
							</VSCodeRadioGroup>
						</div>
					) : (
						<div className="mt-4 text-sm text-vscode-descriptionForeground">
							No condensation providers available.
						</div>
					)}

					<div className="mt-6 p-3 bg-vscode-textBlockQuote-background rounded text-xs text-vscode-descriptionForeground">
						<p className="mb-2">
							<strong>Native Provider:</strong> Uses the Anthropic API to generate intelligent summaries
							of conversation history. This is the recommended provider for most use cases.
						</p>
						<p className="mb-0">
							When enabled, context condensation automatically activates when your conversation history
							exceeds the configured threshold, helping to maintain context while staying within API token
							limits.
						</p>
					</div>
				</div>
			</Section>
		</div>
	)
}
