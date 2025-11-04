import { HTMLAttributes, useState, useEffect } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Glasses } from "lucide-react"
import { telemetryClient } from "@/utils/TelemetryClient"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface UISettingsProps extends HTMLAttributes<HTMLDivElement> {
	reasoningBlockCollapsed: boolean
	accentColor?: string
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const UISettings = ({ reasoningBlockCollapsed, accentColor, setCachedStateField, ...props }: UISettingsProps) => {
	const { t } = useAppTranslation()
	const [colorValue, setColorValue] = useState(accentColor || "")

	// Sync local state with prop changes
	useEffect(() => {
		setColorValue(accentColor || "")
	}, [accentColor])

	const handleReasoningBlockCollapsedChange = (value: boolean) => {
		setCachedStateField("reasoningBlockCollapsed", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_collapse_thinking_changed", {
			enabled: value,
		})
	}

	const handleAccentColorChange = (value: string) => {
		setColorValue(value)
		// Only update if it's a valid color or empty
		const trimmedValue = value.trim()
		if (trimmedValue === "" || /^#[0-9A-Fa-f]{6}$/.test(trimmedValue)) {
			setCachedStateField("accentColor", trimmedValue || undefined)

			// Track telemetry event
			telemetryClient.capture("ui_settings_accent_color_changed", {
				hasColor: trimmedValue !== "",
			})
		}
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

					{/* Accent Color Setting */}
					<div className="flex flex-col gap-2">
						<label className="font-medium" htmlFor="accent-color-input">
							Accent Color
						</label>
						<div className="flex items-center gap-2">
							<VSCodeTextField
								id="accent-color-input"
								value={colorValue}
								placeholder="#007ACC"
								onInput={(e: any) => handleAccentColorChange(e.target.value)}
								data-testid="accent-color-input"
								style={{ flex: 1 }}
							/>
							<input
								type="color"
								value={colorValue && /^#[0-9A-Fa-f]{6}$/.test(colorValue) ? colorValue : "#007ACC"}
								onChange={(e) => handleAccentColorChange(e.target.value)}
								className="h-8 w-16 cursor-pointer rounded border border-vscode-input-border"
								data-testid="accent-color-picker"
							/>
						</div>
						<div className="text-vscode-descriptionForeground text-sm">
							Customize the accent color used throughout the extension. Leave empty to use the default theme color. Enter a hex color code (e.g., #007ACC) or use the color picker.
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
