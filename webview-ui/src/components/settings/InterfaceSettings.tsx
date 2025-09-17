import React from "react"
import { Type } from "lucide-react"
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

interface InterfaceSettingsProps {
	interfaceTextSize?: "small" | "medium" | "large"
	setCachedStateField: SetCachedStateField<"interfaceTextSize">
}

export const InterfaceSettings = ({ interfaceTextSize = "medium", setCachedStateField }: InterfaceSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Type className="w-4" />
					<div>{t("settings:interface.title")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="dropdown-container">
					<label htmlFor="interface-text-size">{t("settings:interface.textSize.label")}</label>
					<VSCodeDropdown
						id="interface-text-size"
						value={interfaceTextSize}
						onChange={(e) => {
							const value = (e.target as HTMLSelectElement).value as "small" | "medium" | "large"
							setCachedStateField("interfaceTextSize", value)
						}}>
						<VSCodeOption value="small">{t("settings:interface.textSize.small")}</VSCodeOption>
						<VSCodeOption value="medium">{t("settings:interface.textSize.medium")}</VSCodeOption>
						<VSCodeOption value="large">{t("settings:interface.textSize.large")}</VSCodeOption>
					</VSCodeDropdown>
					<p className="text-xs text-vscode-descriptionForeground mt-1">
						{t("settings:interface.textSize.description")}
					</p>
				</div>
			</Section>
		</div>
	)
}
