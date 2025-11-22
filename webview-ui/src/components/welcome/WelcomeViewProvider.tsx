import { useCallback, useState } from "react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"

import RooHero from "./RooHero"
import { Trans } from "react-i18next"

type ProviderOption = "roo" | "custom"

const WelcomeViewProvider = () => {
	const {
		apiConfiguration,
		currentApiConfigName,
		setApiConfiguration,
		uriScheme,
		useZgsmCustomConfig,
		setUseZgsmCustomConfig,
	} = useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [selectedProvider, setSelectedProvider] = useState<ProviderOption>("roo")

	// Memoize the setApiConfigurationField function to pass to ApiOptions
	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setApiConfiguration({ [field]: value })
		},
		[setApiConfiguration], // setApiConfiguration from context is stable
	)

	const handleGetStarted = useCallback(() => {
		if (selectedProvider === "roo") {
			// Set the Roo provider configuration
			const rooConfig: ProviderSettings = {
				apiProvider: "roo",
			}

			// Save the Roo provider configuration
			vscode.postMessage({
				type: "upsertApiConfiguration",
				text: currentApiConfigName,
				apiConfiguration: rooConfig,
			})

			// Then trigger cloud sign-in with provider signup flow
			vscode.postMessage({ type: "rooCloudSignIn", useProviderSignup: true })
		} else {
			// Use custom provider - validate first
			const error = apiConfiguration ? validateApiConfiguration(apiConfiguration) : undefined

			if (error) {
				setErrorMessage(error)
				return
			}

			setErrorMessage(undefined)
			vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
		}
	}, [selectedProvider, apiConfiguration, currentApiConfigName])

	return (
		<Tab>
			<TabContent className="flex flex-col gap-4 p-6">
				<RooHero />
				<h2 className="mt-0 mb-0 text-xl">{t("welcome:greeting")}</h2>

				<div className="text-base text-vscode-foreground">
					<p className="mb-3 leading-relaxed">
						<Trans i18nKey="welcome:introduction" />
					</p>
					<p className="mb-0 leading-relaxed">
						<Trans i18nKey="welcome:chooseProvider" />
					</p>
				</div>

				<div className="mb-4">
					{/* Roo Code Cloud Provider Option */}
					<div
						className="flex items-start gap-3 p-4 mb-3 border border-vscode-panel-border rounded-md cursor-pointer hover:bg-vscode-list-hoverBackground"
						onClick={() => setSelectedProvider("roo")}>
						<input
							type="radio"
							name="provider"
							checked={selectedProvider === "roo"}
							onChange={() => setSelectedProvider("roo")}
							className="mt-1"
						/>
						<div className="flex-1">
							<span className="text-sm font-semibold mb-2 block">
								{t("welcome:providerSignup.rooCloudProvider")}
							</span>
							<p className="text-xs text-vscode-descriptionForeground mb-1">
								{t("welcome:providerSignup.rooCloudDescription")} (
								<VSCodeLink
									href="https://roocode.com/provider/pricing?utm_source=extension&utm_medium=welcome-screen&utm_campaign=provider-signup&utm_content=learn-more"
									className="text-xs">
									{t("welcome:providerSignup.learnMore")}
								</VSCodeLink>
								).
							</p>
						</div>
					</div>

					{/* Use Another Provider Option */}
					<div
						className="flex items-start gap-3 p-4 mb-4 border border-vscode-panel-border rounded-md cursor-pointer hover:bg-vscode-list-hoverBackground"
						onClick={() => setSelectedProvider("custom")}>
						<input
							type="radio"
							name="provider"
							checked={selectedProvider === "custom"}
							onChange={() => setSelectedProvider("custom")}
							className="mt-1"
						/>
						<div className="flex-1">
							<span className="text-sm font-semibold mb-2 block">
								{t("welcome:providerSignup.useAnotherProvider")}
							</span>
							<p className="text-xs text-vscode-descriptionForeground mb-1">
								{t("welcome:providerSignup.useAnotherProviderDescription")}
							</p>
						</div>
					</div>

					{/* Show API options only when custom provider is selected */}
					{selectedProvider === "custom" && (
						<div className="mt-4">
							<ApiOptions
								fromWelcomeView
								apiConfiguration={apiConfiguration || {}}
								uriScheme={uriScheme}
								setApiConfigurationField={setApiConfigurationFieldForApiOptions}
								errorMessage={errorMessage}
								setErrorMessage={setErrorMessage}
								useZgsmCustomConfig={useZgsmCustomConfig}
								setCachedStateField={(_, value) => setUseZgsmCustomConfig(value ?? false)}
							/>
						</div>
					)}
				</div>
			</TabContent>
			<div className="sticky bottom-0 bg-vscode-sideBar-background p-4 border-t border-vscode-panel-border">
				<div className="flex flex-col gap-2">
					<Button onClick={handleGetStarted} variant="primary">
						{t("welcome:providerSignup.getStarted")} →
					</Button>
					{errorMessage && selectedProvider === "custom" && (
						<div className="text-vscode-errorForeground text-sm">{errorMessage}</div>
					)}
				</div>
			</div>
		</Tab>
	)
}

export default WelcomeViewProvider
