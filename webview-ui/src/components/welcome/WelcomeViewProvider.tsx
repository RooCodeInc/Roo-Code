import { useCallback, useState } from "react"
import { Trans } from "react-i18next"
import { ArrowLeft, Brain } from "lucide-react"

import { openRouterDefaultModelId, type ProviderSettings } from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"

import RooHero from "./RooHero"

const DEFAULT_WELCOME_API_CONFIGURATION: ProviderSettings = {
	apiProvider: "openrouter",
	openRouterModelId: openRouterDefaultModelId,
}

const getWelcomeApiConfiguration = (apiConfiguration?: ProviderSettings): ProviderSettings => {
	if (!apiConfiguration?.apiProvider) {
		return DEFAULT_WELCOME_API_CONFIGURATION
	}

	if (apiConfiguration.apiProvider === "anthropic" && !apiConfiguration.apiKey) {
		return DEFAULT_WELCOME_API_CONFIGURATION
	}

	return apiConfiguration
}

const WelcomeViewProvider = () => {
	const { apiConfiguration, currentApiConfigName, setApiConfiguration, uriScheme } = useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [showProviderSetup, setShowProviderSetup] = useState(false)
	const [welcomeApiConfiguration, setWelcomeApiConfiguration] = useState<ProviderSettings>()
	const effectiveApiConfiguration = welcomeApiConfiguration ?? getWelcomeApiConfiguration(apiConfiguration)

	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setWelcomeApiConfiguration((current) => ({
				...(current ?? effectiveApiConfiguration),
				[field]: value,
			}))
			setApiConfiguration({ [field]: value })
		},
		[effectiveApiConfiguration, setApiConfiguration],
	)

	const handleGetStarted = useCallback(() => {
		if (!showProviderSetup) {
			const initialApiConfiguration = getWelcomeApiConfiguration(apiConfiguration)
			setWelcomeApiConfiguration(initialApiConfiguration)

			setApiConfiguration(initialApiConfiguration)

			setShowProviderSetup(true)
			return
		}

		const error = validateApiConfiguration(effectiveApiConfiguration)

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		vscode.postMessage({
			type: "upsertApiConfiguration",
			text: currentApiConfigName,
			apiConfiguration: effectiveApiConfiguration,
		})
	}, [showProviderSetup, apiConfiguration, setApiConfiguration, effectiveApiConfiguration, currentApiConfigName])

	if (!showProviderSetup) {
		return (
			<Tab>
				<TabContent className="relative flex flex-col gap-4 p-6 justify-center">
					<RooHero />
					<h2 className="mt-0 mb-0 text-xl">{t("welcome:landing.greeting")}</h2>

					<div className="space-y-4 leading-normal">
						<p className="text-base text-vscode-foreground">
							<Trans i18nKey="welcome:landing.introduction" />
						</p>
					</div>

					<div className="mt-2 flex gap-2 items-center">
						<Button onClick={handleGetStarted} variant="primary">
							{t("welcome:landing.getStarted")}
						</Button>
					</div>

					<div className="absolute bottom-6 left-6">
						<button
							onClick={() => vscode.postMessage({ type: "importSettings" })}
							className="cursor-pointer bg-transparent border-none p-0 text-vscode-foreground hover:underline">
							{t("welcome:importSettings")}
						</button>
					</div>
				</TabContent>
			</Tab>
		)
	}

	return (
		<Tab>
			<TabContent className="flex flex-col gap-4 p-6 justify-center">
				<Brain className="size-8" strokeWidth={1.5} />
				<h2 className="mt-0 mb-0 text-xl">{t("welcome:providerSignup.heading")}</h2>

				<p className="text-base text-vscode-foreground">
					<Trans i18nKey="welcome:providerSignup.chooseProvider" />
				</p>

				<div className="mb-8 border-l-2 border-vscode-panel-border pl-6 ml-[7px]">
					<ApiOptions
						fromWelcomeView
						apiConfiguration={effectiveApiConfiguration}
						uriScheme={uriScheme}
						setApiConfigurationField={setApiConfigurationFieldForApiOptions}
						errorMessage={errorMessage}
						setErrorMessage={setErrorMessage}
					/>
				</div>

				<div className="-mt-4 flex gap-2">
					<Button onClick={() => setShowProviderSetup(false)} variant="secondary">
						<ArrowLeft className="size-4" />
						{t("welcome:providerSignup.goBack")}
					</Button>
					<Button onClick={handleGetStarted} variant="primary">
						{t("welcome:providerSignup.finish")} →
					</Button>
				</div>
			</TabContent>
		</Tab>
	)
}

export default WelcomeViewProvider
