import { useCallback, useState } from "react"
import knuthShuffle from "knuth-shuffle-seeded"
import { Trans } from "react-i18next"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import pkceChallenge from "pkce-challenge"

import type { ProviderSettings } from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getRequestyAuthUrl, getOpenRouterAuthUrl, getHuggingFaceAuthUrl } from "@src/oauth/urls"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"

import RooHero from "./RooHero"

const WelcomeView = () => {
	const { apiConfiguration, currentApiConfigName, setApiConfiguration, uriScheme, machineId } = useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

	// Memoize the setApiConfigurationField function to pass to ApiOptions
	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setApiConfiguration({ [field]: value })
		},
		[setApiConfiguration], // setApiConfiguration from context is stable
	)

	const handleSubmit = useCallback(() => {
		const error = apiConfiguration ? validateApiConfiguration(apiConfiguration) : undefined

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
	}, [apiConfiguration, currentApiConfigName])

	// Using a lazy initializer so it reads once at mount
	const [imagesBaseUri] = useState(() => {
		const w = window as any
		return w.IMAGES_BASE_URI || ""
	})

	// Handle Hugging Face OAuth with PKCE
	const handleHuggingFaceOAuth = useCallback(async () => {
		try {
			// Generate PKCE challenge using the library
			const pkce = await pkceChallenge()
			const state = crypto.randomUUID() // Use built-in UUID for state

			// Store verifier/state in extension (secrets)
			vscode.postMessage({
				type: "storeHuggingFacePkce",
				values: { verifier: pkce.code_verifier, state },
			})

			const authUrl = getHuggingFaceAuthUrl(uriScheme, pkce.code_challenge, state)

			// Open externally via extension
			vscode.postMessage({ type: "openExternal", url: authUrl })
		} catch (e) {
			console.error("Failed to start Hugging Face OAuth:", e)
		}
	}, [uriScheme])

	// Handle provider click
	const handleProviderClick = useCallback(
		(provider: any) => {
			if (provider.slug === "hf") {
				// Hugging Face needs special handling for PKCE
				handleHuggingFaceOAuth()
			} else {
				// Other providers can use direct links
				vscode.postMessage({ type: "openExternal", url: provider.authUrl })
			}
		},
		[handleHuggingFaceOAuth],
	)

	return (
		<Tab>
			<TabContent className="flex flex-col gap-2 p-6">
				<RooHero />
				<h2 className="mt-0 mb-0 text-xl text-center">{t("welcome:greeting")}</h2>

				<div className="text-base text-vscode-foreground py-0 px-0 mb-2">
					<p className="mb-3 leading-relaxed">
						<Trans i18nKey="welcome:introduction" />
					</p>
					<p className="mb-3 leading-relaxed">
						<Trans i18nKey="welcome:chooseProvider" />
						&nbsp;
						<Trans i18nKey="welcome:startRouter" />
					</p>

					<div>
						{/* Define the providers */}
						{(() => {
							// Provider card configuration
							const providers = [
								{
									slug: "requesty",
									name: "Requesty",
									description: t("welcome:routers.requesty.description"),
									incentive: t("welcome:routers.requesty.incentive"),
									authUrl: getRequestyAuthUrl(uriScheme),
								},
								{
									slug: "openrouter",
									name: "OpenRouter",
									description: t("welcome:routers.openrouter.description"),
									authUrl: getOpenRouterAuthUrl(uriScheme),
								},
								{
									slug: "hf",
									name: "Hugging Face",
									description: t("welcome:routers.huggingface.description"),
									authUrl: getHuggingFaceAuthUrl(uriScheme),
								},
							]

							// Shuffle providers based on machine ID (will be consistent for the same machine)
							const orderedProviders = [...providers]
							knuthShuffle(orderedProviders, (machineId as any) || Date.now())

							// Render the provider cards
							return orderedProviders.map((provider, index) => (
								<div
									key={index}
									onClick={(e) => {
										e.preventDefault()
										handleProviderClick(provider)
									}}
									className="relative flex-1 border border-vscode-panel-border hover:bg-secondary rounded-md py-3 px-4 mb-2 flex flex-row gap-3 cursor-pointer transition-all no-underline text-inherit"
									role="button"
									tabIndex={0}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault()
											handleProviderClick(provider)
										}
									}}>
									{provider.incentive && (
										<div className="absolute top-0 right-0 bg-vscode-badge-background text-vscode-badge-foreground px-1.5 py-0.5 rounded-bl rounded-tr-md text-[10px] font-medium">
											{provider.incentive}
										</div>
									)}
									<div className="w-8 h-8 flex-shrink-0">
										<img
											src={`${imagesBaseUri}/${provider.slug}.png`}
											alt={provider.name}
											className="w-full h-full object-contain"
										/>
									</div>
									<div>
										<div className="text-sm font-medium text-vscode-foreground">
											{provider.name}
										</div>
										<div className="text-xs text-vscode-descriptionForeground">
											{provider.description}
										</div>
									</div>
								</div>
							))
						})()}
					</div>

					<p className="text-base mt-4 mb-3">{t("welcome:startCustom")}</p>
					<ApiOptions
						fromWelcomeView
						apiConfiguration={apiConfiguration || {}}
						uriScheme={uriScheme}
						setApiConfigurationField={setApiConfigurationFieldForApiOptions}
						errorMessage={errorMessage}
						setErrorMessage={setErrorMessage}
					/>
				</div>
			</TabContent>
			<div className="sticky bottom-0 bg-vscode-sideBar-background p-4 border-t border-vscode-panel-border">
				<div className="flex flex-col gap-2">
					<div className="flex justify-end">
						<VSCodeLink
							href="#"
							onClick={(e) => {
								e.preventDefault()
								vscode.postMessage({ type: "importSettings" })
							}}
							className="text-sm">
							{t("welcome:importSettings")}
						</VSCodeLink>
					</div>
					<VSCodeButton onClick={handleSubmit} appearance="primary">
						{t("welcome:start")}
					</VSCodeButton>
					{errorMessage && <div className="text-vscode-errorForeground">{errorMessage}</div>}
				</div>
			</div>
		</Tab>
	)
}

export default WelcomeView
