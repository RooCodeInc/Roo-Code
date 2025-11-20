import { HTMLAttributes, useEffect, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Glasses, Palette } from "lucide-react"
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
	const [colorInputValue, setColorInputValue] = useState(accentColor || "")
	const [colorError, setColorError] = useState<string | null>(null)

	// Sync local state with prop changes
	useEffect(() => {
		setColorInputValue(accentColor || "")
	}, [accentColor])

	const handleReasoningBlockCollapsedChange = (value: boolean) => {
		setCachedStateField("reasoningBlockCollapsed", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_collapse_thinking_changed", {
			enabled: value,
		})
	}

	const validateColor = (color: string): boolean => {
		if (!color || color.trim() === "") {
			return true // Empty is valid (uses default)
		}
		// Validate hex color format (#RGB, #RRGGBB, #RGBA, #RRGGBBAA)
		const hexRegex = /^#([0-9A-F]{3}){1,2}([0-9A-F]{2})?$/i
		return hexRegex.test(color)
	}

	const handleAccentColorChange = (value: string) => {
		setColorInputValue(value)

		if (validateColor(value)) {
			setColorError(null)
			setCachedStateField("accentColor", value || undefined)

			// Apply the color immediately to CSS
			if (value && value.trim()) {
				document.documentElement.style.setProperty("--custom-accent-color", value)
			} else {
				document.documentElement.style.removeProperty("--custom-accent-color")
			}

			// Track telemetry event
			telemetryClient.capture("ui_settings_accent_color_changed", {
				hasCustomColor: !!value,
			})
		} else {
			setColorError("Invalid color format. Use hex format (e.g., #007ACC)")
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
					<div className="flex flex-col gap-1">
						<label className="flex items-center gap-2 font-medium">
							<Palette className="w-4 h-4" />
							{t("settings:ui.accentColor.label")}
						</label>
						<div className="flex items-center gap-2 ml-6">
							<VSCodeTextField
								value={colorInputValue}
								placeholder="#007ACC"
								onInput={(e: any) => handleAccentColorChange(e.target.value)}
								data-testid="accent-color-input"
								className="flex-1"
								style={{ maxWidth: "200px" }}
							/>
							{colorInputValue && (
								<div
									className="w-8 h-8 rounded border border-vscode-input-border"
									style={{
										backgroundColor: validateColor(colorInputValue) ? colorInputValue : "transparent",
										boxShadow: validateColor(colorInputValue) ? "0 0 0 1px rgba(0,0,0,0.1) inset" : "none"
									}}
									title={colorInputValue}
								/>
							)}
						</div>
						<div className="text-vscode-descriptionForeground text-sm ml-6 mt-1">
							{colorError ? (
								<span className="text-vscode-errorForeground">{colorError}</span>
							) : (
								<span>{t("settings:ui.accentColor.description")}</span>
							)}
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
