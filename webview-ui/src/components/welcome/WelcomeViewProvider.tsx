import { useCallback, useState } from "react"
import { VSCodeLink, VSCodeRadio, VSCodeRadioGroup, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { telemetryClient } from "@src/utils/TelemetryClient"

import type { ProviderSettings } from "@roo-code/types"
import { TelemetryEventName } from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration, validateZgsmBaseUrl } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"

import RooHero from "./RooHero"
import { Trans } from "react-i18next"
import { inputEventTransform } from "../settings/transforms"
import { ApiErrorMessage } from "../settings/ApiErrorMessage"

type ProviderOption = "zgsm" | "custom"

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
	const [selectedProvider, setSelectedProvider] = useState<ProviderOption>("zgsm")
	const [costrictBaseurl, setCostrictBaseurl] = useState("")

	// Memoize the setApiConfigurationField function to pass to ApiOptions
	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setApiConfiguration({ [field]: value })
		},
		[setApiConfiguration], // setApiConfiguration from context is stable
	)

	const handleGetStarted = useCallback(() => {
		let error = undefined
		if (apiConfiguration.apiProvider === "zgsm") {
			error = t("settings:providers.noProviderMatchFound")
		} else {
			// Use custom provider - validate first
			error = apiConfiguration ? validateApiConfiguration(apiConfiguration) : undefined
		}

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
	}, [apiConfiguration, currentApiConfigName, t])

	const handleInputChange = useCallback((e: any) => {
		e?.preventDefault()

		const val = inputEventTransform(e)

		setCostrictBaseurl(val)
	}, [])

	const handleVisitCloudWebsite = useCallback(() => {
		const error = validateZgsmBaseUrl(costrictBaseurl)

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		// Send telemetry for account connect action
		telemetryClient.capture(TelemetryEventName.ACCOUNT_CONNECT_CLICKED)
		const zgsmBaseUrl = costrictBaseurl.trim().replace(/\/$/, "")
		setApiConfigurationFieldForApiOptions("zgsmBaseUrl", zgsmBaseUrl)

		vscode.postMessage({
			type: "zgsmLogin",
			apiConfiguration: {
				...apiConfiguration,
				zgsmBaseUrl,
				apiProvider: "zgsm",
				zgsmModelId: "Auto",
			},
		})
	}, [apiConfiguration, costrictBaseurl, setApiConfigurationFieldForApiOptions])

	return (
		<Tab>
			<TabContent className="flex flex-col gap-4 p-6 justify-center">
				<RooHero />
				{/* <h2 className="mt-0 mb-0 text-xl">{t("welcome:greeting")}</h2> */}

				<div className="text-base text-vscode-foreground space-y-3">
					{selectedProvider === "zgsm" && (
						<p>
							<Trans i18nKey="welcome:introduction" />
						</p>
					)}
					<p>
						<Trans i18nKey="welcome:chooseProvider" />
						<VSCodeLink
							href="#"
							onClick={(e) => {
								e.preventDefault()
								vscode.postMessage({ type: "importSettings" })
							}}
							className="text-sm">
							{t("welcome:importSettings")}
						</VSCodeLink>
					</p>
				</div>

				<div className="mb-4">
					<VSCodeRadioGroup
						orientation="vertical"
						value={selectedProvider}
						onChange={(e: Event | React.FormEvent<HTMLElement>) => {
							setErrorMessage(undefined)
							const target = ((e as CustomEvent)?.detail?.target ||
								(e.target as HTMLInputElement)) as HTMLInputElement
							setSelectedProvider(target.value as ProviderOption)
						}}>
						<VSCodeRadio value="zgsm" className="flex items-start gap-2 w-full">
							<div className="flex-1 space-y-1 cursor-pointer w-full">
								<p className="text-lg font-semibold block -mt-1">
									{t("welcome:providerSignup.rooCloudProvider")}&nbsp;
									<VSCodeLink href="https://costrict.ai" className="cursor-pointer">
										{t("welcome:providerSignup.learnMore")}
									</VSCodeLink>
								</p>
							</div>
						</VSCodeRadio>
						<VSCodeRadio value="custom" className="flex items-start gap-2 w-full">
							<div className="flex-1 space-y-1 cursor-pointer w-full">
								<p className="text-lg font-semibold block -mt-1">
									{t("welcome:providerSignup.useAnotherProvider")}
								</p>
								<p
									className={`text-base text-vscode-descriptionForeground mt-0 ${selectedProvider === "zgsm" ? "hidden" : ""}`}>
									{t("welcome:providerSignup.useAnotherProviderDescription")}
								</p>
							</div>
						</VSCodeRadio>
					</VSCodeRadioGroup>
					{/* Expand API options only when custom provider is selected, max height is used to force a transition */}
					<div className="mb-8">
						{selectedProvider === "custom" ? (
							<div>
								<p className="text-base text-vscode-descriptionForeground mt-0">
									{t("welcome:providerSignup.noApiKeys")}
								</p>
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
						) : (
							<div>
								<VSCodeTextField
									value={costrictBaseurl}
									type="url"
									onInput={handleInputChange}
									placeholder={t("settings:providers.zgsmDefaultBaseUrl", {
										zgsmBaseUrl: "https://zgsm.sangfor.com",
									})}
									className="w-full">
									<label className="block font-medium mb-1">
										{t("settings:providers.zgsmBaseUrl")}
									</label>
								</VSCodeTextField>
								{errorMessage && <ApiErrorMessage errorMessage={errorMessage} />}
							</div>
						)}
					</div>
				</div>
				<div className="-mt-8">
					{selectedProvider === "zgsm" ? (
						<Button variant="primary" onClick={handleVisitCloudWebsite} className="w-full">
							{t("account:signIn")}
						</Button>
					) : (
						<Button onClick={handleGetStarted} variant="primary" className="w-full">
							{t("welcome:start")}
						</Button>
					)}
				</div>
			</TabContent>
		</Tab>
	)
}

export default WelcomeViewProvider
