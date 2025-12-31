import { useCallback, useState } from "react"
import { Trans } from "react-i18next"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { Tab, TabContent } from "../common/Tab"

import RooHero from "./RooHero"

const WelcomeView = () => {
	const { apiConfiguration, currentApiConfigName } = useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

	const handleSubmit = useCallback(() => {
		const error = apiConfiguration ? validateApiConfiguration(apiConfiguration) : undefined

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
	}, [apiConfiguration, currentApiConfigName])

	return (
		<Tab>
			<TabContent className="flex flex-col gap-5 p-16">
				<RooHero />
				<p>
					<Trans
						i18nKey="welcome:landing.introduction"
						components={{
							docsLink: (
								<VSCodeLink href="https://docs.datacoves.com/docs/how-tos/vs-code/datacoves-copilot/v2" />
							),
						}}
					/>
				</p>

				<div className="flex flex-col gap-4 mt-2">
					<div className="flex items-start gap-3">
						<span className="codicon codicon-account text-lg mt-0.5" />
						<div>
							<span className="font-semibold">{t("welcome:landing.features.modes.title")}: </span>
							<span className="opacity-80">{t("welcome:landing.features.modes.description")}</span>
						</div>
					</div>
					<div className="flex items-start gap-3">
						<span className="codicon codicon-list-tree text-lg mt-0.5" />
						<div>
							<span className="font-semibold">{t("welcome:landing.features.orchestration.title")}: </span>
							<span className="opacity-80">
								{t("welcome:landing.features.orchestration.description")}
							</span>
						</div>
					</div>
				</div>
			</TabContent>
			<div className="sticky bottom-0 bg-vscode-sideBar-background p-5">
				<div className="flex flex-col gap-1">
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
						{t("welcome:landing.getStarted")}
					</VSCodeButton>
					{errorMessage && <div className="text-vscode-errorForeground">{errorMessage}</div>}
				</div>
			</div>
		</Tab>
	)
}

export default WelcomeView
