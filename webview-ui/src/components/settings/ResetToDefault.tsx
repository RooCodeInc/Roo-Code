import { RotateCcw } from "lucide-react"

import { settingDefaults, type SettingWithDefault } from "@roo-code/types"

import { Button, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"

// Widen literal types to their base types for comparison
type WidenType<T> = T extends boolean ? boolean : T extends number ? number : T extends string ? string : T

interface ResetToDefaultProps<K extends SettingWithDefault> {
	/** The setting key from settingDefaults */
	settingKey: K
	/** The current value of the setting (accepts wider types for flexibility) */
	currentValue: WidenType<(typeof settingDefaults)[K]> | undefined
	/** Callback to reset the value (called with undefined to reset) */
	onReset: () => void
	/** Optional className for the button */
	className?: string
}

/**
 * A small reset button that appears only when a setting differs from its default.
 * Shows a ↺ icon with a tooltip displaying the default value.
 *
 * @example
 * <ResetToDefault
 *   settingKey="browserToolEnabled"
 *   currentValue={browserToolEnabled}
 *   onReset={() => setCachedStateField("browserToolEnabled", undefined)}
 * />
 */
export function ResetToDefault<K extends SettingWithDefault>({
	settingKey,
	currentValue,
	onReset,
	className,
}: ResetToDefaultProps<K>) {
	const { t } = useAppTranslation()
	const defaultValue = settingDefaults[settingKey]

	// Don't show the button if the current value matches the default
	// undefined is treated as "using default"
	const isDefault = currentValue === undefined || currentValue === defaultValue

	if (isDefault) {
		return null
	}

	// Format the default value for display in the tooltip
	const formatDefaultValue = (value: unknown): string => {
		if (typeof value === "boolean") {
			return value ? t("settings:common.true") : t("settings:common.false")
		}
		if (typeof value === "number") {
			return String(value)
		}
		if (typeof value === "string") {
			return value || t("settings:common.empty")
		}
		return JSON.stringify(value)
	}

	const tooltipContent = t("settings:common.resetToDefault", {
		defaultValue: formatDefaultValue(defaultValue),
	})

	return (
		<StandardTooltip content={tooltipContent}>
			<Button
				variant="ghost"
				size="icon"
				className={className ?? "h-6 w-6 p-1"}
				onClick={onReset}
				data-testid={`reset-${settingKey}`}>
				<RotateCcw className="h-3.5 w-3.5 text-vscode-descriptionForeground hover:text-vscode-foreground" />
			</Button>
		</StandardTooltip>
	)
}
