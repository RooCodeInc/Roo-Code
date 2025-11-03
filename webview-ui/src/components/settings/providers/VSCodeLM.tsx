import { useState, useCallback } from "react"
import { useEvent } from "react-use"
import { LanguageModelChatSelector } from "vscode"

import type { ProviderSettings } from "@roo-code/types"

import { ExtensionMessage } from "@roo/ExtensionMessage"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

import { inputEventTransform } from "../transforms"

type VSCodeLMProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const VSCodeLM = ({ apiConfiguration, setApiConfigurationField }: VSCodeLMProps) => {
	const { t } = useAppTranslation()

	const [vsCodeLmModels, setVsCodeLmModels] = useState<LanguageModelChatSelector[]>([])

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
			case "vsCodeLmModels":
				{
					const newModels = message.vsCodeLmModels ?? []
					setVsCodeLmModels(newModels)
				}
				break
		}
	}, [])

	useEvent("message", onMessage)

	return (
		<>
			<div>
				<label className="block font-medium mb-1">{t("settings:providers.vscodeLmModel")}</label>
				{vsCodeLmModels.length > 0 ? (
					<Select
						value={apiConfiguration?.vsCodeLmModelSelector?.id || ""}
						onValueChange={handleInputChange("vsCodeLmModelSelector", (value) => {
							// Find the selected model to get all its properties
							const selectedModel = vsCodeLmModels.find((model) => model.id === value)
							if (selectedModel) {
								return {
									id: selectedModel.id,
									vendor: selectedModel.vendor,
									family: selectedModel.family,
								}
							}
							return { id: value }
						})}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							{vsCodeLmModels.map((model) => (
								<SelectItem key={model.id || `${model.vendor}/${model.family}`} value={model.id || ""}>
									{`${model.vendor} - ${model.family}`}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : (
					<div className="text-sm text-vscode-descriptionForeground">
						{t("settings:providers.vscodeLmDescription")}
					</div>
				)}
			</div>
			<div className="text-sm text-vscode-errorForeground">{t("settings:providers.vscodeLmWarning")}</div>
		</>
	)
}
