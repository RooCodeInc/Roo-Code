import { useCallback, useState, useMemo, useEffect } from "react"
import { useEvent } from "react-use"
import { Trans } from "react-i18next"
import { VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings, ExtensionMessage, ModelRecord } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useRouterModels } from "@src/components/ui/hooks/useRouterModels"
import { vscode } from "@src/utils/vscode"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type AtomicChatProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const AtomicChat = ({ apiConfiguration, setApiConfigurationField }: AtomicChatProps) => {
	const { t } = useAppTranslation()

	const [atomicChatModels, setAtomicChatModels] = useState<ModelRecord>({})
	const routerModels = useRouterModels()

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	const onMessage = useCallback((event: MessageEvent) => {
		const message: ExtensionMessage = event.data

		switch (message.type) {
			case "atomicChatModels":
				setAtomicChatModels(message.atomicChatModels ?? {})
				break
		}
	}, [])

	useEvent("message", onMessage)

	useEffect(() => {
		vscode.postMessage({ type: "requestAtomicChatModels" })
	}, [])

	const modelNotAvailableError = useMemo(() => {
		const selectedModel = apiConfiguration?.atomicChatModelId
		if (!selectedModel) return undefined

		if (Object.keys(atomicChatModels).length > 0 && selectedModel in atomicChatModels) {
			return undefined
		}

		if (routerModels.data?.["atomic-chat"]) {
			const availableModels = Object.keys(routerModels.data["atomic-chat"])
			if (!availableModels.includes(selectedModel)) {
				return t("settings:validation.modelAvailability", { modelId: selectedModel })
			}
		}

		return undefined
	}, [apiConfiguration?.atomicChatModelId, routerModels.data, atomicChatModels, t])

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.atomicChatBaseUrl || ""}
				type="url"
				onInput={handleInputChange("atomicChatBaseUrl")}
				placeholder={t("settings:defaults.atomicChatUrl")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.atomicChat.baseUrl")}</label>
			</VSCodeTextField>
			<VSCodeTextField
				value={apiConfiguration?.atomicChatApiKey || ""}
				type="password"
				onInput={handleInputChange("atomicChatApiKey")}
				placeholder={t("settings:providers.atomicChat.apiKeyPlaceholder")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.atomicChat.apiKey")}</label>
			</VSCodeTextField>
			<div className="text-xs text-vscode-descriptionForeground mb-2">
				{t("settings:providers.atomicChat.apiKeyHelp")}
			</div>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId=""
				models={atomicChatModels}
				modelIdKey="atomicChatModelId"
				serviceName="Atomic Chat"
				serviceUrl="https://github.com/AtomicBot-ai/Atomic-Chat"
				errorMessage={modelNotAvailableError}
				hidePricing
			/>
			<div className="text-sm text-vscode-descriptionForeground">
				<Trans
					i18nKey="settings:providers.atomicChat.description"
					components={{
						a: <VSCodeLink href="https://atomic.chat/" />,
						b: <VSCodeLink href="https://github.com/AtomicBot-ai/Atomic-Chat" />,
						span: (
							<span className="text-vscode-errorForeground ml-1">
								<span className="font-medium">Note:</span>
							</span>
						),
					}}
				/>
			</div>
		</>
	)
}
