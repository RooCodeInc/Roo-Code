import type { GlobalSettings } from "@roo-code/types"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"
import { StandardTooltip } from "@/components/ui"
import { autoApproveSettingsConfig, AutoApproveSetting } from "../settings/AutoApproveToggle"
import { KEYBOARD_SHORTCUTS_DISPLAY, DEFAULT_KEYBOARD_CONFIG } from "@/constants/autoApproveConstants"

type AutoApproveToggles = Pick<
	GlobalSettings,
	| "alwaysAllowReadOnly"
	| "alwaysAllowWrite"
	| "alwaysAllowBrowser"
	| "alwaysApproveResubmit"
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "alwaysAllowSubtasks"
	| "alwaysAllowExecute"
	| "alwaysAllowFollowupQuestions"
	| "alwaysAllowUpdateTodoList"
>

type AutoApproveToggleDropdownProps = AutoApproveToggles & {
	onToggle: (key: AutoApproveSetting, value: boolean) => void
}

export const AutoApproveToggleDropdown = ({ onToggle, ...props }: AutoApproveToggleDropdownProps) => {
	const { t } = useAppTranslation()

	// Split settings into two columns for better layout
	const settings = Object.values(autoApproveSettingsConfig)
	const halfLength = Math.ceil(settings.length / 2)
	const leftColumn = settings.slice(0, halfLength)
	const rightColumn = settings.slice(halfLength)

	const renderToggleItem = ({
		key,
		descriptionKey,
		labelKey,
		icon,
		testId,
	}: (typeof autoApproveSettingsConfig)[AutoApproveSetting]) => {
		// Get the appropriate keyboard shortcut display based on configuration
		const shortcutDisplay = DEFAULT_KEYBOARD_CONFIG.useCtrlShiftKey
			? KEYBOARD_SHORTCUTS_DISPLAY[key].replace("Alt+", "Ctrl+Shift+")
			: KEYBOARD_SHORTCUTS_DISPLAY[key]

		const tooltipContent = DEFAULT_KEYBOARD_CONFIG.enabled
			? `${t(descriptionKey || "")} (${shortcutDisplay})`
			: t(descriptionKey || "")
		return (
			<StandardTooltip key={key} content={tooltipContent}>
				<button
					onClick={() => onToggle(key, !props[key])}
					aria-label={t(labelKey)}
					aria-pressed={!!props[key]}
					data-testid={testId}
					className={cn(
						"w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left",
						"transition-colors hover:bg-vscode-list-hoverBackground cursor-pointer",
						props[key]
							? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
							: "opacity-70",
					)}>
					<span className={cn("codicon", `codicon-${icon}`, "text-sm flex-shrink-0")} />
					<span className="flex-1 truncate">{t(labelKey)}</span>
					{DEFAULT_KEYBOARD_CONFIG.enabled && (
						<span
							className={cn(
								"text-[10px] px-1 rounded",
								"bg-vscode-badge-background text-vscode-badge-foreground opacity-60",
							)}>
							{shortcutDisplay.replace("Alt+", "⌥").replace("Ctrl+Shift+", "⌃⇧")}
						</span>
					)}
				</button>
			</StandardTooltip>
		)
	}

	return (
		<>
			<div className="flex flex-col gap-1">{leftColumn.map(renderToggleItem)}</div>
			<div className="flex flex-col gap-1">{rightColumn.map(renderToggleItem)}</div>
		</>
	)
}
