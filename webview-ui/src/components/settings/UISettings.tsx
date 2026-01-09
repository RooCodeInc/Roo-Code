import { HTMLAttributes, useMemo, useState, useCallback, useEffect } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Glasses, RotateCcw } from "lucide-react"
import { telemetryClient } from "@/utils/TelemetryClient"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface UISettingsProps extends HTMLAttributes<HTMLDivElement> {
	reasoningBlockCollapsed: boolean
	enterBehavior: "send" | "newline"
	chatFontSizeMultiplier: number
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const UISettings = ({
	reasoningBlockCollapsed,
	enterBehavior,
	chatFontSizeMultiplier,
	setCachedStateField,
	...props
}: UISettingsProps) => {
	const { t } = useAppTranslation()

	// Local state for the input value to allow typing freely
	const [localMultiplier, setLocalMultiplier] = useState(chatFontSizeMultiplier.toString())

	// Sync local state when prop changes (e.g., from commands)
	useEffect(() => {
		setLocalMultiplier(chatFontSizeMultiplier.toString())
	}, [chatFontSizeMultiplier])

	// Detect platform for dynamic modifier key display
	const primaryMod = useMemo(() => {
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
		return isMac ? "⌘" : "Ctrl"
	}, [])

	const handleReasoningBlockCollapsedChange = (value: boolean) => {
		setCachedStateField("reasoningBlockCollapsed", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_collapse_thinking_changed", {
			enabled: value,
		})
	}

	const handleEnterBehaviorChange = (requireCtrlEnter: boolean) => {
		const newBehavior = requireCtrlEnter ? "newline" : "send"
		setCachedStateField("enterBehavior", newBehavior)

		// Track telemetry event
		telemetryClient.capture("ui_settings_enter_behavior_changed", {
			behavior: newBehavior,
		})
	}

	const handleFontSizeMultiplierChange = useCallback(
		(value: string) => {
			setLocalMultiplier(value)

			// Parse and validate the value
			const numValue = parseFloat(value)
			if (!isNaN(numValue)) {
				// Clamp the value between 0.5 and 2
				const clampedValue = Math.max(0.5, Math.min(2, numValue))
				setCachedStateField("chatFontSizeMultiplier", clampedValue)

				// Track telemetry event
				telemetryClient.capture("ui_settings_chat_font_size_changed", {
					multiplier: clampedValue,
				})
			}
		},
		[setCachedStateField],
	)

	const handleFontSizeMultiplierBlur = useCallback(() => {
		// On blur, ensure the display value matches the clamped value
		const numValue = parseFloat(localMultiplier)
		if (isNaN(numValue)) {
			setLocalMultiplier(chatFontSizeMultiplier.toString())
		} else {
			const clampedValue = Math.max(0.5, Math.min(2, numValue))
			setLocalMultiplier(clampedValue.toString())
		}
	}, [localMultiplier, chatFontSizeMultiplier])

	const handleResetFontSize = useCallback(() => {
		setCachedStateField("chatFontSizeMultiplier", 1)
		setLocalMultiplier("1")

		// Track telemetry event
		telemetryClient.capture("ui_settings_chat_font_size_reset", {})
	}, [setCachedStateField])

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

					{/* Enter Key Behavior Setting */}
					<div className="flex flex-col gap-1">
						<VSCodeCheckbox
							checked={enterBehavior === "newline"}
							onChange={(e: any) => handleEnterBehaviorChange(e.target.checked)}
							data-testid="enter-behavior-checkbox">
							<span className="font-medium">
								{t("settings:ui.requireCtrlEnterToSend.label", { primaryMod })}
							</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
							{t("settings:ui.requireCtrlEnterToSend.description", { primaryMod })}
						</div>
					</div>

					{/* Chat Font Size Multiplier Setting */}
					<div className="flex flex-col gap-1">
						<label className="font-medium" htmlFor="chat-font-size-input">
							{t("settings:ui.chatFontSizeMultiplier.label")}
						</label>
						<div className="flex items-center gap-2">
							<input
								id="chat-font-size-input"
								type="number"
								min="0.5"
								max="2"
								step="0.1"
								value={localMultiplier}
								onChange={(e) => handleFontSizeMultiplierChange(e.target.value)}
								onBlur={handleFontSizeMultiplierBlur}
								className="w-20 px-2 py-1 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded"
								data-testid="chat-font-size-input"
							/>
							<button
								onClick={handleResetFontSize}
								className="flex items-center gap-1 px-2 py-1 text-sm bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground hover:bg-vscode-button-secondaryHoverBackground rounded"
								title={t("settings:ui.chatFontSizeMultiplier.reset")}
								data-testid="chat-font-size-reset-button">
								<RotateCcw className="w-3 h-3" />
								{t("settings:ui.chatFontSizeMultiplier.reset")}
							</button>
						</div>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							{t("settings:ui.chatFontSizeMultiplier.description")}
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
