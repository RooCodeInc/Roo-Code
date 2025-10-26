import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Glasses } from "lucide-react"
import { telemetryClient } from "@/utils/TelemetryClient"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface UISettingsProps extends HTMLAttributes<HTMLDivElement> {
	taskTitlesEnabled: boolean
	reasoningBlockCollapsed: boolean
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const UISettings = ({
	taskTitlesEnabled,
	reasoningBlockCollapsed,
	setCachedStateField,
	...props
}: UISettingsProps) => {
	const { t } = useAppTranslation()

	const handleTaskTitlesEnabledChange = (value: boolean) => {
		setCachedStateField("taskTitlesEnabled", value)
		telemetryClient.capture("ui_settings_task_titles_enabled_changed", {
			enabled: value,
		})
	}

	const handleReasoningBlockCollapsedChange = (value: boolean) => {
		setCachedStateField("reasoningBlockCollapsed", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_collapse_thinking_changed", {
			enabled: value,
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
					<div className="flex flex-col gap-1">
						<VSCodeCheckbox
							checked={taskTitlesEnabled}
							onChange={(e: any) => handleTaskTitlesEnabledChange(e.target.checked)}
							data-testid="enable-task-titles-checkbox">
							<span className="font-medium">{t("settings:ui.taskTitles.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
							{t("settings:ui.taskTitles.description")}
						</div>
					</div>

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
				</div>
			</Section>
		</div>
	)
}
