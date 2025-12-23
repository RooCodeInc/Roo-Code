import { useCallback, useEffect, useRef, useState } from "react"
import { VSCodeLink, VSCodeProgressRing, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

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
import { ArrowLeft, ArrowRight, BadgeInfo, TriangleAlert } from "lucide-react"
import { buildDocLink } from "@/utils/docLinks"

type ProviderOption = "roo" | "custom"

const WelcomeViewProvider = () => {
	const { apiConfiguration, currentApiConfigName, setApiConfiguration, uriScheme, cloudIsAuthenticated } =
		useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [selectedProvider, setSelectedProvider] = useState<ProviderOption>("roo")
	const [authInProgress, setAuthInProgress] = useState(false)
	const [showManualEntry, setShowManualEntry] = useState(false)
	const [manualUrl, setManualUrl] = useState("")
	const [manualErrorMessage, setManualErrorMessage] = useState<boolean | undefined>(undefined)
	const manualUrlInputRef = useRef<HTMLInputElement | null>(null)

	// When auth completes during the provider signup flow, save the Roo config
	// This will cause showWelcome to become false and navigate to chat
	useEffect(() => {
		if (cloudIsAuthenticated && authInProgress) {
			// Auth completed from provider signup flow - save the config now
			const rooConfig: ProviderSettings = {
				apiProvider: "roo",
			}
			vscode.postMessage({
				type: "upsertApiConfiguration",
				text: currentApiConfigName,
				apiConfiguration: rooConfig,
			})
			setAuthInProgress(false)
			setShowManualEntry(false)
		}
	}, [cloudIsAuthenticated, authInProgress, currentApiConfigName])

	// Focus the manual URL input when it becomes visible
	useEffect(() => {
		if (showManualEntry && manualUrlInputRef.current) {
			setTimeout(() => {
				manualUrlInputRef.current?.focus()
			}, 50)
		}
	}, [showManualEntry])

	// Memoize the setApiConfigurationField function to pass to ApiOptions
	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setApiConfiguration({ [field]: value })
		},
		[setApiConfiguration], // setApiConfiguration from context is stable
	)

	const handleGetStarted = useCallback(() => {
		if (selectedProvider === "roo") {
			// Trigger cloud sign-in with provider signup flow
			// NOTE: We intentionally do NOT save the API configuration yet.
			// The configuration will be saved by the extension after auth completes.
			// This keeps showWelcome true so we can show the waiting state.
			vscode.postMessage({ type: "rooCloudSignIn", useProviderSignup: true })

			// Show the waiting state
			setAuthInProgress(true)
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

	const handleGoBack = useCallback(() => {
		setAuthInProgress(false)
		setShowManualEntry(false)
		setManualUrl("")
		setManualErrorMessage(false)
	}, [])

	const handleManualUrlChange = (e: any) => {
		const url = e.target.value
		setManualUrl(url)

		// Auto-trigger authentication when a complete URL is pasted
		setTimeout(() => {
			if (url.trim() && url.includes("://") && url.includes("/auth/clerk/callback")) {
				setManualErrorMessage(false)
				vscode.postMessage({ type: "rooCloudManualUrl", text: url.trim() })
			}
		}, 100)
	}

	const handleSubmit = useCallback(() => {
		const url = manualUrl.trim()
		if (url && url.includes("://") && url.includes("/auth/clerk/callback")) {
			setManualErrorMessage(false)
			vscode.postMessage({ type: "rooCloudManualUrl", text: url })
		} else {
			setManualErrorMessage(true)
		}
	}, [manualUrl])

	const handleOpenSignupUrl = () => {
		vscode.postMessage({ type: "rooCloudSignIn", useProviderSignup: true })
	}

	const handleUseAnotherProvider = useCallback(() => {
		setSelectedProvider("custom")
	}, [])

	const handleGoWithRooProvider = useCallback(() => {
		setSelectedProvider("roo")
	}, [])

	// Render the waiting for cloud state
	if (authInProgress) {
		return (
			<Tab>
				<TabContent className="flex flex-col gap-4 p-6 justify-center">
					<div className="flex flex-col items-start gap-4 pt-8">
						<VSCodeProgressRing className="size-6" />
						<h2 className="mt-0 mb-0 text-xl font-semibold">{t("welcome:waitingForCloud.heading")}</h2>
						<p className="text-vscode-descriptionForeground mt-0">
							{t("welcome:waitingForCloud.description")}
						</p>

						<div className="flex gap-2 items-start pr-4 text-vscode-descriptionForeground">
							<BadgeInfo className="size-4 inline shrink-0" />
							<p className="m-0">
								<Trans
									i18nKey="welcome:waitingForCloud.noPrompt"
									components={{
										clickHere: (
											<button
												onClick={handleOpenSignupUrl}
												className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground underline cursor-pointer bg-transparent border-none p-0"
											/>
										),
									}}
								/>
							</p>
						</div>

						<div className="flex gap-2 items-start pr-4 text-vscode-descriptionForeground">
							<TriangleAlert className="size-4 inline shrink-0" />
							<div>
								{!showManualEntry ? (
									<p className="m-0">
										<Trans
											i18nKey="welcome:waitingForCloud.havingTrouble"
											components={{
												clickHere: (
													<button
														onClick={() => setShowManualEntry(true)}
														className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground underline cursor-pointer bg-transparent border-none p-0	"
													/>
												),
											}}
										/>
									</p>
								) : (
									<div className="w-full max-w-sm">
										<p className="text-vscode-descriptionForeground mt-0">
											{t("welcome:waitingForCloud.pasteUrl")}
										</p>
										<div className="flex gap-2 items-center">
											<VSCodeTextField
												ref={manualUrlInputRef as any}
												value={manualUrl}
												onKeyUp={handleManualUrlChange}
												placeholder="vscode://RooVeterinaryInc.roo-cline/auth/clerk/callback?state=..."
												className="flex-1"
											/>
											<Button
												onClick={handleSubmit}
												disabled={manualUrl.length < 40}
												variant="secondary">
												<ArrowRight className="size-4" />
											</Button>
										</div>
										<p className="mt-2">
											<Trans
												i18nKey="welcome:waitingForCloud.docsLink"
												components={{
													DocsLink: (
														<a
															href={buildDocLink("roo-code-cloud/login", "setup")}
															target="_blank"
															rel="noopener noreferrer"
															className="text-vscode-textLink-foreground hover:underline">
															{t("common:docsLink.label")}
														</a>
													),
												}}
											/>
										</p>
										{manualUrl && manualErrorMessage && (
											<p className="text-vscode-errorForeground mt-2">
												{t("welcome:waitingForCloud.invalidURL")}
											</p>
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					<div className="mt-4">
						<Button onClick={handleGoBack} variant="secondary">
							<ArrowLeft className="size-4" />
							{t("welcome:waitingForCloud.goBack")}
						</Button>
					</div>
				</TabContent>
			</Tab>
		)
	}

	return (
		<Tab>
			<TabContent className="flex flex-col gap-4 p-6 justify-center">
				<RooHero />
				<h2 className="mt-0 mb-0 text-xl">{t("welcome:greeting")}</h2>

				{selectedProvider === "roo" ? (
					<>
						<div className="space-y-4 leading-normal">
							<p className="text-base text-vscode-foreground">
								<Trans i18nKey="welcome:introduction" />
							</p>
							<p className="font-semibold">
								<Trans i18nKey="welcome:chooseProvider" />
							</p>
							<p className="font-semibold pl-3 py-0 border-l-2 border-vscode-panel-border">
								{t("welcome:providerSignup.rooCloudDescription")}{" "}
								<VSCodeLink
									href="https://docs.roocode.com/roo-code-provider/overview?utm_source=extension&utm_medium=welcome-screen&utm_campaign=provider-signup&utm_content=learn-more"
									className="cursor-pointer text-vscode-descriptionForeground">
									{t("welcome:providerSignup.learnMore")}
								</VSCodeLink>
							</p>
						</div>

						<div className="mt-4 flex gap-2 items-center">
							<Button onClick={handleGetStarted} variant="primary">
								{t("welcome:providerSignup.getStarted")}
							</Button>
							<VSCodeLink onClick={handleUseAnotherProvider} className="cursor-pointer">
								{t("welcome:providerSignup.useAnotherProvider")}
							</VSCodeLink>
						</div>
					</>
				) : (
					<>
						<div className="mb-4">
							<div className="text-sm">
								<p className="text-base text-vscode-descriptionForeground">
									{t("welcome:providerSignup.noApiKeys")}
									<VSCodeLink onClick={handleGoWithRooProvider} className="cursor-pointer">
										{t("welcome:providerSignup.backToRoo")}
									</VSCodeLink>
								</p>
							</div>
							<ApiOptions
								fromWelcomeView
								apiConfiguration={apiConfiguration || {}}
								uriScheme={uriScheme}
								setApiConfigurationField={setApiConfigurationFieldForApiOptions}
								errorMessage={errorMessage}
								setErrorMessage={setErrorMessage}
							/>
						</div>

						<div className="-mt-2 mb-4">
							<Button onClick={handleGetStarted} variant="primary">
								{t("welcome:providerSignup.getStarted")} →
							</Button>
						</div>
					</>
				)}
			</TabContent>
		</Tab>
	)
}

export default WelcomeViewProvider
