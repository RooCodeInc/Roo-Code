import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { Glasses } from "lucide-react"
import { telemetryClient } from "@/utils/TelemetryClient"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface UISettingsProps extends HTMLAttributes<HTMLDivElement> {
	reasoningBlockCollapsed: boolean
	chatMessageFontSize: string
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const UISettings = ({
	reasoningBlockCollapsed,
	chatMessageFontSize,
	setCachedStateField,
	...props
}: UISettingsProps) => {
	const { t } = useAppTranslation()

	const handleReasoningBlockCollapsedChange = (value: boolean) => {
		setCachedStateField("reasoningBlockCollapsed", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_collapse_thinking_changed", {
			enabled: value,
		})
	}

	const handleChatMessageFontSizeChange = (value: string) => {
		setCachedStateField("chatMessageFontSize", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_chat_font_size_changed", {
			size: value,
		})
	}

	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Glasses className="w-4" />
					<div>{t("settings:sections.ui")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-6">
					{/* Collapse Thinking Messages Setting */}
					<div className="flex flex-col gap-1">
						<VSCodeCheckbox
							checked={reasoningBlockCollapsed}
							onChange={(e: any) => handleReasoningBlockCollapsedChange(e.target.checked)}
							data-testid="collapse-thinking-checkbox">
							<span className="font-medium">{t("settings:ui.collapseThinking.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
							{t("settings:ui.collapseThinking.description")}
						</div>
					</div>

					{/* Chat Message Font Size Setting */}
					<div className="flex flex-col gap-1">
						<label className="font-medium">Chat Message Font Size</label>
						<VSCodeDropdown
							value={chatMessageFontSize || "default"}
							onChange={(e: any) => handleChatMessageFontSizeChange(e.target.value)}
							data-testid="chat-font-size-dropdown">
							<VSCodeOption value="default">Default</VSCodeOption>
							<VSCodeOption value="extra-small">Extra Small (90%)</VSCodeOption>
							<VSCodeOption value="small">Small (95%)</VSCodeOption>
							<VSCodeOption value="large">Large (105%)</VSCodeOption>
							<VSCodeOption value="extra-large">Extra Large (110%)</VSCodeOption>
						</VSCodeDropdown>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							Adjust the font size for messages in the chat view
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
