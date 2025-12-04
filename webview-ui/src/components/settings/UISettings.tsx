import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Glasses } from "lucide-react"
import { telemetryClient } from "@/utils/TelemetryClient"

import { Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface UISettingsProps extends HTMLAttributes<HTMLDivElement> {
	reasoningBlockCollapsed: boolean
	maxTasksHomeScreen: number
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const UISettings = ({
	reasoningBlockCollapsed,
	maxTasksHomeScreen,
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

	const handleMaxTasksHomeScreenChange = (value: number) => {
		setCachedStateField("maxTasksHomeScreen", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_max_tasks_home_screen_changed", {
			value: value,
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

					{/* Maximum Tasks in Home Screen Setting */}
					<div className="flex flex-col gap-1">
						<label className="block font-medium mb-1">{t("settings:ui.maxTasksHomeScreen.label")}</label>
						<div className="flex items-center gap-2">
							<Slider
								min={0}
								max={20}
								step={1}
								value={[maxTasksHomeScreen]}
								onValueChange={([value]) => handleMaxTasksHomeScreenChange(value)}
								data-testid="max-tasks-home-screen-slider"
							/>
							<span className="w-10">{maxTasksHomeScreen}</span>
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
